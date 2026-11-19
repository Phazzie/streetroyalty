import { getSql } from "../db.ts";
import {
  assessSet,
  canonicalTemplateId,
  defaultGarment,
  getTemplate,
  isAopProduct,
  parseColorwayBlob,
  parseColorways,
  parseStoredGarment,
  productForTemplate,
  setPartner,
  variantForPrinter,
  withSharedColorways,
  type Colorway,
  type GarmentDesign,
  type PrinterId,
} from "./garments.ts";
import { getDesign, publishDesign, saveDesign } from "./designs.server.ts";
import { slugify } from "./validate.ts";
import { readStudioConfig } from "./shared.server.ts";

export type GarmentSetRecord = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  provider: string;
  colorways: Colorway[];
  activeColorwayId: string;
  pieces: {
    id: string;
    title: string;
    slug: string;
    productId: string;
    productType: string;
    status: string;
    garment: GarmentDesign;
  }[];
};

type SetRow = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  status: string;
  provider: string;
  colorways_json: string;
  piece_ids_json: string;
};

function maker(): PrinterId {
  return readStudioConfig().podMode === "live" ? "printful" : "sandbox";
}

async function hydrate(row: SetRow): Promise<GarmentSetRecord> {
  const blob = parseColorwayBlob(row.colorways_json);
  const ids = JSON.parse(row.piece_ids_json) as string[];
  const pieces = [];
  for (const id of ids) {
    const sql = await getSql();
    const found = await sql<{
      id: string;
      title: string;
      slug: string;
      product_id: string;
      template_id: string | null;
      product_type: string;
      status: string;
      garment_json: string | null;
      user_id: string;
    }>`select id, title, slug, product_id, template_id, product_type, status, garment_json, user_id from designs where id = ${id}`;
    const piece = found[0];
    if (!piece || piece.user_id !== row.user_id) throw new Error("A piece of this set is missing.");
    const stored = parseStoredGarment(piece.garment_json);
    const templateId =
      canonicalTemplateId(piece.template_id ?? "") ?? stored?.templateId ?? null;
    if (!templateId || !getTemplate(templateId)) {
      throw new Error("That garment template is not in the studio.");
    }
    const garment = stored ?? defaultGarment(templateId);
    pieces.push({
      id: piece.id,
      title: piece.title,
      slug: piece.slug,
      productId: piece.product_id,
      productType: piece.product_type,
      status: piece.status,
      garment: withSharedColorways(garment, blob.colorways, blob.activeColorwayId),
    });
  }
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status === "published" ? "published" : "draft",
    provider: row.provider,
    colorways: blob.colorways,
    activeColorwayId: blob.activeColorwayId,
    pieces,
  };
}

export async function getOwnedSet(userId: string, setId: string): Promise<GarmentSetRecord> {
  const sql = await getSql();
  const rows =
    await sql<SetRow>`select * from garment_sets where id = ${setId} and user_id = ${userId}`;
  const row = rows[0];
  if (!row) throw new Error("That set is not yours.");
  return hydrate(row);
}

export async function getSetBySlug(slug: string): Promise<GarmentSetRecord | null> {
  const sql = await getSql();
  const rows =
    await sql<SetRow>`select * from garment_sets where slug = ${slug} and status = 'published'`;
  const row = rows[0];
  if (!row) return null;
  return hydrate(row);
}

/**
 * A design can point at a set id whose row never landed (the process died after
 * the claim). That id is not a set. Clear it so the piece can be paired again.
 * A row that does exist is left alone, including one another request just claimed.
 */
async function releaseMissingSet(userId: string, designId: string, setId: string): Promise<boolean> {
  const sql = await getSql();
  const found = await sql<{ id: string }>`
    select id from garment_sets where id = ${setId} and user_id = ${userId}
  `;
  if (found[0]) return false;
  await sql`
    update designs set set_id = null
    where id = ${designId} and user_id = ${userId} and set_id = ${setId}
  `;
  return true;
}

/** Pair the saved piece with its partner, sharing colorways, from one maker. */
export async function createMatchedSet(
  userId: string,
  designId: string,
  title?: string,
): Promise<GarmentSetRecord> {
  const source = await getDesign(userId, designId);
  const sourceTemplate = canonicalTemplateId(source.productId);
  if (!sourceTemplate || !isAopProduct(source.productId)) {
    throw new Error("Sets pair all-over garments.");
  }
  if (source.setId) {
    if (!(await releaseMissingSet(userId, source.id, source.setId))) {
      return getOwnedSet(userId, source.setId);
    }
  }
  const partnerTemplate = setPartner(sourceTemplate);
  const providerId = maker();
  const partnerProductId = partnerTemplate ? productForTemplate(providerId, partnerTemplate) : null;
  const partnerVariantId = partnerTemplate ? variantForPrinter(providerId, partnerTemplate) : null;
  if (source.provider !== providerId) {
    throw new Error("This piece was made on a different printer.");
  }
  if (!partnerTemplate || !partnerProductId || !partnerVariantId) {
    throw new Error("This piece has no match on this printer yet.");
  }
  // Every check that can fail goes before the first write, so a refusal leaves nothing behind.
  const name = (title?.trim() || `${source.title} set`).slice(0, 80);
  if (name.length < 2) throw new Error("Name the set.");
  const garment = source.garment ?? defaultGarment(sourceTemplate);
  const partnerGarment = withSharedColorways(
    defaultGarment(partnerTemplate),
    garment.colorways,
    garment.activeColorwayId,
  );
  const verdict = assessSet([
    { provider: providerId, templateId: sourceTemplate, colorways: garment.colorways },
    { provider: providerId, templateId: partnerTemplate, colorways: partnerGarment.colorways },
  ]);
  if (!verdict.ok) throw new Error(verdict.reason);
  const sql = await getSql();
  const id = crypto.randomUUID();
  // Claim the source before any partner exists, so two builds cannot each insert a set.
  const claimed = await sql<{ id: string }>`
    update designs set set_id = ${id}
    where id = ${source.id} and user_id = ${userId} and set_id is null
    returning id
  `;
  if (!claimed[0]) {
    const again = await getDesign(userId, designId);
    if (again.setId) {
      try {
        return await getOwnedSet(userId, again.setId);
      } catch {
        throw new Error("A set is already being made for this piece.");
      }
    }
    throw new Error("A set is already being made for this piece.");
  }
  let partnerId: string | null = null;
  try {
    if (!source.garment) {
      await saveDesign(userId, {
        id: source.id,
        title: source.title,
        collectionId: source.collectionId,
        productId: source.productId,
        variantId: source.variantId,
        placement: source.placement,
        layers: source.layers,
        garment,
      });
    }
    const partner = await saveDesign(userId, {
      title: `${source.title} ${getTemplate(partnerTemplate)?.shortName ?? "Piece"}`.slice(0, 80),
      productId: partnerProductId,
      variantId: partnerVariantId,
      placement: "front",
      layers: [
        {
          id: "mark",
          type: "text",
          text: "SR",
          font: "Archivo Black",
          color:
            garment.colorways.find((item) => item.id === garment.activeColorwayId)?.colors.mark ??
            "#1a1024",
          x: 0.5,
          y: 0.4,
          scale: 1,
          rotation: 0,
        },
      ],
      garment: partnerGarment,
      mockupUrl: null,
    });
    partnerId = partner.id;
    const slug = slugify(name, id);
    const blob = JSON.stringify({
      colorways: garment.colorways,
      activeColorwayId: garment.activeColorwayId,
    });
    await sql`
      insert into garment_sets (id, user_id, title, slug, status, provider, colorways_json, piece_ids_json)
      values (${id}, ${userId}, ${name}, ${slug}, 'draft', ${verdict.provider}, ${blob}, ${JSON.stringify([source.id, partner.id])})
    `;
    await sql`update designs set set_id = ${id} where user_id = ${userId} and id = ${partner.id}`;
  } catch (error) {
    // The driver has no transactions here. Undo by hand so a failed set leaves no stray partner.
    await sql`update designs set set_id = null where user_id = ${userId} and id = ${source.id} and set_id = ${id}`.catch(
      () => undefined,
    );
    await sql`delete from garment_sets where id = ${id} and user_id = ${userId}`.catch(
      () => undefined,
    );
    if (partnerId) {
      await sql`delete from designs where id = ${partnerId} and user_id = ${userId}`.catch(
        () => undefined,
      );
    }
    throw error;
  }
  return getOwnedSet(userId, id);
}

export async function saveSetColorways(
  userId: string,
  setId: string,
  colorways: unknown,
  activeColorwayId: string,
): Promise<GarmentSetRecord> {
  const set = await getOwnedSet(userId, setId);
  const parsed = parseColorways(colorways, activeColorwayId);
  const blob = JSON.stringify({
    colorways: parsed.colorways,
    activeColorwayId: parsed.activeColorwayId,
  });
  const sql = await getSql();
  const written: string[] = [];
  try {
    for (const piece of set.pieces) {
      const next = withSharedColorways(piece.garment, parsed.colorways, parsed.activeColorwayId);
      await sql`update designs set garment_json = ${JSON.stringify(next)}, updated_at = now() where id = ${piece.id} and user_id = ${userId}`;
      written.push(piece.id);
    }
    await sql`
      update garment_sets set colorways_json = ${blob}, updated_at = now()
      where id = ${set.id} and user_id = ${userId}
    `;
  } catch (error) {
    for (const piece of set.pieces) {
      if (!written.includes(piece.id)) continue;
      await sql`update designs set garment_json = ${JSON.stringify(piece.garment)}, updated_at = now() where id = ${piece.id} and user_id = ${userId}`.catch(
        () => undefined,
      );
    }
    throw error;
  }
  return getOwnedSet(userId, set.id);
}

export async function publishSet(userId: string, setId: string): Promise<GarmentSetRecord> {
  const set = await getOwnedSet(userId, setId);
  for (const piece of set.pieces) {
    const design = await getDesign(userId, piece.id);
    if (!design.printFileId)
      throw new Error(`Save a print file for ${piece.title} before the set goes on the rack.`);
    if (!design.mockupUrl)
      throw new Error(`Pull a mockup for ${piece.title} before the set goes on the rack.`);
  }
  for (const piece of set.pieces) {
    if (piece.status !== "published") await publishDesign(userId, piece.id);
  }
  const sql = await getSql();
  await sql`
    update garment_sets set status = 'published', updated_at = now()
    where id = ${set.id} and user_id = ${userId}
  `;
  return getOwnedSet(userId, set.id);
}
