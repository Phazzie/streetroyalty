import { getSql } from "../db.ts";
import { getPodProvider, readPodMode } from "../pod/index.ts";
import { centsToDecimal } from "../pod/money.ts";
import { aopOnSale, AOP_ORDER_CLOSED } from "../pod/aop-printful.ts";
import type { CatalogProduct } from "../pod/types.ts";
import {
  imageDimensions,
  isPublicHttpUrl,
  parseLayers,
  parseMockupUrl,
  parsePrintFile,
  printQualityWarning,
  slugify,
} from "./validate.ts";
import type { CollectionRecord, DesignRecord, DesignSummary, ShopPiece } from "./models.ts";
import {
  activePrinter,
  canonicalTemplateId,
  catalogIdFor,
  catalogLookupId,
  isAopProduct,
  materialLine,
  parseGarment,
  parseStoredGarment,
  resolveTemplateId,
  type GarmentDesign,
  type PrinterId,
} from "./garments.ts";
import {
  designSpots,
  fileUrl,
  ownedDesign,
  readStudioConfig,
  record,
  spotExtraCents,
  summary,
  type DesignRow,
} from "./shared.server.ts";
import type { DesignSpot } from "./models.ts";

function printerNow(): PrinterId {
  return activePrinter(readPodMode(process.env));
}

/** Load the printer's product for a template id or an unmapped catalog id. */
async function openCatalog(productId: string) {
  const printer = printerNow();
  const templateId = resolveTemplateId(productId);
  const catalogId = templateId ? catalogIdFor(printer, templateId) : productId;
  if (!catalogId) throw new Error("That garment is not bound to this printer yet.");
  const provider = getPodProvider();
  const product = await provider.getProduct(catalogId);
  return { provider, printer, templateId: templateId ?? productId, catalogId, product };
}

/** Parse a maker's garment and check it belongs to this all-over product. */
function garmentFor(product: CatalogProduct, input: unknown): GarmentDesign {
  const raw = input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {};
  if (typeof raw.templateId === "string") {
    raw.templateId = canonicalTemplateId(raw.templateId) ?? raw.templateId;
  }
  const garment = parseGarment(raw);
  const expected = product.aopTemplateId ?? canonicalTemplateId(product.id);
  if (!expected || garment.templateId !== expected) {
    throw new Error("Those panels belong to a different garment.");
  }
  return garment;
}

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
  garment?: unknown;
  /**
   * The other spots with art, besides `placement`. Each one names a print file
   * already uploaded with `storePrintFile`, so one save never carries more
   * than one picture.
   */
  spots?: unknown;
};

/** Stores one print file for a spot and returns its id. */
export async function storePrintFile(userId: string, printFile: unknown): Promise<string> {
  const print = parsePrintFile(printFile);
  if (!print) throw new Error("There is no print file to keep.");
  const id = crypto.randomUUID();
  const sql = await getSql();
  await sql`insert into print_files (id, user_id, mime, data_base64) values (${id}, ${userId}, ${print.mime}, ${print.base64})`;
  return id;
}

/** Reads the extra spots a maker sent, keeping only spots this product prints and files this maker owns. */
async function parseExtraSpots(
  userId: string,
  input: unknown,
  product: CatalogProduct,
  primary: string,
): Promise<DesignSpot[]> {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error("The spots did not come through.");
  const seen = new Set([primary]);
  const spots: DesignSpot[] = [];
  const sql = await getSql();
  for (const entry of input.slice(0, product.placements.length)) {
    const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const key = String(item.placement ?? "");
    const placement = product.placements.find((option) => option.placement === key);
    if (!placement) throw new Error("That product does not print there.");
    if (seen.has(key)) continue;
    seen.add(key);
    // A spot with no art is not printed.
    if (!Array.isArray(item.layers) || item.layers.length === 0) continue;
    const layers = parseLayers(item.layers);
    let printFileId: string | null = null;
    if (item.printFileId) {
      const id = String(item.printFileId);
      const owned = await sql<{ id: string }>`
        select id from print_files where id = ${id} and user_id = ${userId} and mime like 'image/%'
      `;
      if (!owned[0]) throw new Error("A print file for one of the spots is missing.");
      printFileId = id;
    }
    spots.push({ placement: key, technique: placement.technique, layers, printFileId });
  }
  return spots;
}

export async function saveDesign(
  userId: string,
  input: SaveInput,
): Promise<DesignRecord & { warnings: string[] }> {
  const title = input.title.trim().slice(0, 80);
  if (title.length < 2) throw new Error("Name the piece.");
  const layers = parseLayers(input.layers);
  const print = parsePrintFile(input.printFile);
  const { printer, templateId, catalogId, product } = await openCatalog(input.productId);
  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant || variant.retailCents == null)
    throw new Error("That size and color is not in the catalog.");
  const placement = product.placements.find((item) => item.placement === input.placement);
  if (!placement) throw new Error("That product does not print there.");
  // All-over pieces print from their panels. Only a regular piece carries extra spots.
  const extraSpots = isAopProduct(templateId)
    ? []
    : await parseExtraSpots(userId, input.spots, product, placement.placement);
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
  const spotsJson =
    extraSpots.length > 0
      ? JSON.stringify([
          { placement: placement.placement, technique: placement.technique, layers, printFileId },
          ...extraSpots,
        ])
      : null;
  // Printful charges for each extra spot it prints. The price carries it.
  const retailCents =
    variant.retailCents +
    spotExtraCents(product, [placement.placement, ...extraSpots.map((spot) => spot.placement)]);
  const keptBecauseAop =
    isAopProduct(templateId) ||
    (existing != null && isAopProduct(existing.template_id ?? existing.product_id));
  let garmentJson: string | null = null;
  if (keptBecauseAop) {
    garmentJson =
      input.garment != null && isAopProduct(templateId)
        ? JSON.stringify(
            garmentFor({ ...product, id: templateId, aopTemplateId: templateId }, input.garment),
          )
        : (existing?.garment_json ?? null);
  }
  if (existing) {
    await sql`
      update designs set
        title = ${title},
        collection_id = ${input.collectionId || null},
        product_id = ${templateId},
        template_id = ${templateId},
        provider = ${printer},
        provider_catalog_id = ${catalogId},
        provider_variant_id = ${variant.id},
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
        spots_json = ${spotsJson},
        garment_json = ${garmentJson},
        print_file_id = ${printFileId},
        mockup_url = ${mockup},
        retail_cents = ${retailCents},
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
      id, user_id, collection_id, title, slug, status, product_id, template_id, provider,
      provider_catalog_id, provider_variant_id, product_name, product_type,
      variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
      layers_json, spots_json, garment_json, print_file_id, mockup_url, retail_cents, currency
    ) values (
      ${id}, ${userId}, ${input.collectionId || null}, ${title}, ${slug}, 'draft', ${templateId}, ${templateId}, ${printer},
      ${catalogId}, ${variant.id}, ${product.name}, ${product.type},
      ${variant.id}, ${variant.name}, ${variant.color}, ${variant.colorHex}, ${variant.size}, ${placement.placement}, ${placement.technique},
      ${layersJson}, ${spotsJson}, ${garmentJson}, ${printFileId}, ${mockup}, ${retailCents}, 'USD'
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
  garment?: unknown;
  userId?: string;
}): Promise<{ mockupUrl: string; status: string }> {
  const layers = parseLayers(input.layers);
  const { provider, product } = await openCatalog(input.productId);
  // An all-over mockup is drawn from the maker's own panels. Anything else ignores them.
  const garment =
    isAopProduct(product.id) && input.garment != null
      ? garmentFor(product, input.garment)
      : undefined;
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
    garment,
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
  const spots = designSpots(row);
  if (spots.some((spot) => !spot.printFileId))
    throw new Error("Save the piece again so every spot has its print file.");
  if (!row.mockup_url) throw new Error("Generate a mockup before publishing.");
  // The shop took this piece off the rack after a report. Only the shop can put it back.
  const held = await sql<{ id: string }>`
    select id from reports where kind = 'piece' and target_id = ${row.id} and status = 'removed' limit 1
  `;
  if (held[0])
    throw new Error("The shop took this piece off the rack after a report. Ask the shop.");
  const config = readStudioConfig();
  const templateId = row.template_id ?? row.product_id;
  const printer = printerNow();
  // An all-over piece goes on the rack in either mode but is not synced to a
  // Printful store product: its orders go straight to the catalog with one
  // print file per placement, rendered at checkout from the colorway bought.
  if (isAopProduct(templateId) && !aopOnSale()) throw new Error(AOP_ORDER_CLOSED);
  const holdPrinter = isAopProduct(templateId);
  let providerProductId = row.provider_product_id ?? null;
  if (config.podMode === "live" && !holdPrinter) {
    if (resolveTemplateId(templateId) && !catalogIdFor(printer, templateId)) {
      throw new Error("That garment is not bound to this printer yet.");
    }
    const files = spots.map((spot) => ({
      placement: spot.placement,
      url: fileUrl(spot.printFileId ?? row.print_file_id ?? ""),
    }));
    if (files.some((file) => !isPublicHttpUrl(file.url)))
      throw new Error("Set APP_PUBLIC_URL so Printful can fetch the print file.");
    const synced = await getPodProvider().syncProduct({
      externalId: row.id,
      name: row.title,
      thumbnailUrl: row.mockup_url.startsWith("http") ? row.mockup_url : undefined,
      existingId: providerProductId ?? undefined,
      variants: [
        {
          catalogVariantId: row.provider_variant_id ?? row.variant_id,
          retailPrice: centsToDecimal(Number(row.retail_cents)),
          files,
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

export async function getShopDesign(slug: string): Promise<ShopPiece> {
  const sql = await getSql();
  const rows =
    await sql<DesignRow>`select * from designs where slug = ${slug} and status = 'published'`;
  const row = rows[0];
  if (!row) throw new Error("That piece is not on the rack.");
  const templateId = row.template_id ?? row.product_id;
  const lookup = catalogLookupId(printerNow(), templateId, row.provider_catalog_id);
  let product: CatalogProduct | null = null;
  if (lookup) {
    try {
      product = await getPodProvider().getProduct(lookup);
    } catch {
      product = null;
    }
  }
  const chosen = product?.variants.find((variant) => variant.id === row.variant_id);
  // A piece printed on more than one spot costs what the cart will charge for it.
  const extra =
    product && !isAopProduct(templateId)
      ? spotExtraCents(product, designSpots(row).map((spot) => spot.placement))
      : 0;
  const sizes = (product?.variants ?? [])
    .filter((variant) => {
      if (variant.retailCents == null) return false;
      if (chosen?.colorCode && variant.colorCode) return variant.colorCode === chosen.colorCode;
      return variant.id === row.variant_id;
    })
    .map((variant) => ({
      variantId: variant.id,
      label: variant.size,
      retailCents: variant.retailCents == null ? Number(row.retail_cents) : variant.retailCents + extra,
    }));
  if (!sizes.some((size) => size.variantId === row.variant_id)) {
    sizes.push({
      variantId: row.variant_id,
      label: row.size_label,
      retailCents: Number(row.retail_cents),
    });
  }
  const garment = parseStoredGarment(row.garment_json);
  const colorways = garment?.colorways ?? [];
  const activeColorwayId = garment?.activeColorwayId ?? null;
  return {
    ...summary(row),
    sizes,
    colorways,
    activeColorwayId,
    materialNote: product?.materialNote ?? (materialLine(templateId) || null),
    construction: product?.construction ?? (isAopProduct(templateId) ? "aop" : "placement"),
  };
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
