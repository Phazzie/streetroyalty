import { getSql } from "../db.ts";
import { getPodProvider } from "../pod/index.ts";
import { centsToDecimal } from "../pod/money.ts";
import {
  imageDimensions,
  isPublicHttpUrl,
  parseLayers,
  parseMockupUrl,
  parsePrintFile,
  printQualityWarning,
  slugify,
} from "./validate.ts";
import type { CollectionRecord, DesignRecord, DesignSummary } from "./models.ts";
import { fileUrl, ownedDesign, readStudioConfig, record, summary, type DesignRow } from "./shared.server.ts";

export async function listCollections(userId: string): Promise<CollectionRecord[]> {
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; count: number }>`
    select c.id, c.name, count(d.id)::int as count
    from collections c
    left join designs d on d.collection_id = c.id
    where c.user_id = ${userId}
    group by c.id, c.name
    order by c.created_at asc
  `;
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }));
}

export async function createCollection(userId: string, name: string): Promise<CollectionRecord> {
  const trimmed = name.trim().slice(0, 60);
  if (trimmed.length < 2) throw new Error("Name the collection.");
  const sql = await getSql();
  const id = crypto.randomUUID();
  await sql`insert into collections (id, user_id, name) values (${id}, ${userId}, ${trimmed})`;
  return { id, name: trimmed, count: 0 };
}

export async function listDesigns(userId: string): Promise<DesignSummary[]> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`
    select d.*, c.name as collection_name
    from designs d
    left join collections c on c.id = d.collection_id
    where d.user_id = ${userId}
    order by d.updated_at desc
  `;
  return rows.map(summary);
}

export async function getDesign(userId: string, designId: string): Promise<DesignRecord> {
  const sql = await getSql();
  const row = await ownedDesign(sql, userId, designId);
  if (!row) throw new Error("That design is not on your rack.");
  return record(row);
}

type SaveInput = {
  id?: string;
  title: string;
  collectionId?: string | null;
  productId: string;
  variantId: string;
  placement: string;
  layers: unknown;
  printFile?: unknown;
  mockupUrl?: string | null;
};

export async function saveDesign(
  userId: string,
  input: SaveInput,
): Promise<DesignRecord & { warnings: string[] }> {
  const title = input.title.trim().slice(0, 80);
  if (title.length < 2) throw new Error("Name the piece.");
  const layers = parseLayers(input.layers);
  const print = parsePrintFile(input.printFile);
  const provider = getPodProvider();
  const product = await provider.getProduct(input.productId);
  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant || variant.retailCents == null)
    throw new Error("That size and color is not in the catalog.");
  const placement = product.placements.find((item) => item.placement === input.placement);
  if (!placement) throw new Error("That product does not print there.");
  const sql = await getSql();
  if (input.collectionId) {
    const owned = await sql<{
      id: string;
    }>`select id from collections where id = ${input.collectionId} and user_id = ${userId}`;
    if (!owned[0]) throw new Error("That collection is not yours.");
  }
  const id = input.id || crypto.randomUUID();
  const existing = input.id ? await ownedDesign(sql, userId, input.id) : null;
  if (input.id && !existing) throw new Error("That design is not on your rack.");
  let printFileId = existing?.print_file_id ?? null;
  if (print) {
    printFileId = crypto.randomUUID();
    await sql`insert into print_files (id, user_id, mime, data_base64) values (${printFileId}, ${userId}, ${print.mime}, ${print.base64})`;
  }
  const mockup = parseMockupUrl(input.mockupUrl) ?? existing?.mockup_url ?? null;
  const warnings: string[] = [];
  if (print) {
    const dims = imageDimensions(print.mime, print.base64);
    const area =
      variant.printAreas.find((item) => item.placement === placement.placement) ??
      variant.printAreas[0];
    if (dims && area) {
      const warning = printQualityWarning(dims, area);
      if (warning) warnings.push(warning);
    }
  }
  const layersJson = JSON.stringify(layers);
  if (existing) {
    await sql`
      update designs set
        title = ${title},
        collection_id = ${input.collectionId || null},
        product_id = ${product.id},
        product_name = ${product.name},
        product_type = ${product.type},
        variant_id = ${variant.id},
        variant_label = ${variant.name},
        color_name = ${variant.color},
        color_hex = ${variant.colorHex},
        size_label = ${variant.size},
        placement = ${placement.placement},
        technique = ${placement.technique},
        layers_json = ${layersJson},
        print_file_id = ${printFileId},
        mockup_url = ${mockup},
        retail_cents = ${variant.retailCents},
        updated_at = now()
      where id = ${existing.id} and user_id = ${userId}
    `;
    const saved = await ownedDesign(sql, userId, existing.id);
    if (!saved) throw new Error("Save did not land.");
    return { ...record(saved), warnings };
  }
  const slug = slugify(title, id);
  await sql`
    insert into designs (
      id, user_id, collection_id, title, slug, status, product_id, product_name, product_type,
      variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
      layers_json, print_file_id, mockup_url, retail_cents, currency
    ) values (
      ${id}, ${userId}, ${input.collectionId || null}, ${title}, ${slug}, 'draft', ${product.id}, ${product.name}, ${product.type},
      ${variant.id}, ${variant.name}, ${variant.color}, ${variant.colorHex}, ${variant.size}, ${placement.placement}, ${placement.technique},
      ${layersJson}, ${printFileId}, ${mockup}, ${variant.retailCents}, 'USD'
    )
  `;
  const saved = await ownedDesign(sql, userId, id);
  if (!saved) throw new Error("Save did not land.");
  return { ...record(saved), warnings };
}

export async function generateMockup(input: {
  productId: string;
  variantId: string;
  placement: string;
  layers: unknown;
  printFile?: unknown;
  userId?: string;
}): Promise<{ mockupUrl: string; status: string }> {
  const layers = parseLayers(input.layers);
  const provider = getPodProvider();
  const product = await provider.getProduct(input.productId);
  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant) throw new Error("Pick a color and size first.");
  const placement = product.placements.find((item) => item.placement === input.placement);
  if (!placement) throw new Error("That placement is not on this product.");
  const area =
    variant.printAreas.find((item) => item.placement === placement.placement) ??
    variant.printAreas[0];
  let publicUrl: string | undefined;
  if (readStudioConfig().podMode === "live") {
    const print = parsePrintFile(input.printFile);
    if (!print || !input.userId)
      throw new Error("Sign in and export the print file before asking Printful for a mockup.");
    const sql = await getSql();
    const fileId = crypto.randomUUID();
    await sql`insert into print_files (id, user_id, mime, data_base64) values (${fileId}, ${input.userId}, ${print.mime}, ${print.base64})`;
    publicUrl = fileUrl(fileId);
    if (!isPublicHttpUrl(publicUrl)) {
      throw new Error(
        "Printful has to download the print file. Set APP_PUBLIC_URL to the public https origin.",
      );
    }
    await provider.uploadFile({ url: publicUrl, filename: `${fileId}.png` });
  }
  const mockup = await provider.createMockup({
    productId: product.id,
    variantId: variant.id,
    placement: placement.placement,
    technique: placement.technique,
    fileUrl: publicUrl,
    colorHex: variant.colorHex,
    productType: product.type,
    layers,
    printArea: area,
  });
  if (mockup.status === "failed") throw new Error(mockup.error || "Mockup failed.");
  if (!mockup.mockupUrl) throw new Error("The mockup is still rendering. Try again in a moment.");
  return { mockupUrl: mockup.mockupUrl, status: mockup.status };
}

export async function publishDesign(userId: string, designId: string): Promise<DesignRecord> {
  const sql = await getSql();
  const row = await ownedDesign(sql, userId, designId);
  if (!row) throw new Error("That design is not on your rack.");
  if (!row.print_file_id) throw new Error("Save a print file before publishing.");
  if (!row.mockup_url) throw new Error("Generate a mockup before publishing.");
  const config = readStudioConfig();
  let providerProductId = row.provider_product_id ?? null;
  if (config.podMode === "live") {
    const url = fileUrl(row.print_file_id);
    if (!isPublicHttpUrl(url))
      throw new Error("Set APP_PUBLIC_URL so Printful can fetch the print file.");
    const synced = await getPodProvider().syncProduct({
      externalId: row.id,
      name: row.title,
      thumbnailUrl: row.mockup_url.startsWith("http") ? row.mockup_url : undefined,
      existingId: providerProductId ?? undefined,
      variants: [
        {
          catalogVariantId: row.variant_id,
          retailPrice: centsToDecimal(Number(row.retail_cents)),
          files: [{ placement: row.placement, url }],
        },
      ],
    });
    providerProductId = synced.id;
  }
  await sql`
    update designs
    set status = 'published', provider_product_id = ${providerProductId}, updated_at = now()
    where id = ${row.id} and user_id = ${userId}
  `;
  const saved = await ownedDesign(sql, userId, row.id);
  if (!saved) throw new Error("Publish did not land.");
  return record(saved);
}

export async function listShop(): Promise<DesignSummary[]> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`
    select * from designs where status = 'published' order by updated_at desc limit 60
  `;
  return rows.map(summary);
}

export async function getShopDesign(
  slug: string,
): Promise<DesignSummary & { sizes: { variantId: string; label: string; retailCents: number }[] }> {
  const sql = await getSql();
  const rows =
    await sql<DesignRow>`select * from designs where slug = ${slug} and status = 'published'`;
  const row = rows[0];
  if (!row) throw new Error("That piece is not on the rack.");
  const product = await getPodProvider().getProduct(row.product_id);
  const sizes = product.variants
    .filter((variant) => variant.color === row.color_name && variant.retailCents != null)
    .map((variant) => ({
      variantId: variant.id,
      label: variant.size,
      retailCents: variant.retailCents ?? Number(row.retail_cents),
    }));
  if (!sizes.some((size) => size.variantId === row.variant_id)) {
    sizes.push({
      variantId: row.variant_id,
      label: row.size_label,
      retailCents: Number(row.retail_cents),
    });
  }
  return { ...summary(row), sizes };
}

export async function readPrintFile(
  id: string,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await getSql();
  const rows = await sql<{
    mime: string;
    data_base64: string;
  }>`select mime, data_base64 from print_files where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  const binary = atob(row.data_base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: row.mime, bytes };
}
