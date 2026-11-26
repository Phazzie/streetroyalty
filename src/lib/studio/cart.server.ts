import { getSql } from "../db.ts";
import { getPodProvider, readPodMode } from "../pod/index.ts";
import type { CatalogProduct } from "../pod/types.ts";
import { isPrintfulPlacementProduct } from "../pod/garment-map.ts";
import { printfulVariantFor } from "../pod/house-blanks.ts";
import {
  AOP_ORDER_CLOSED,
  AOP_TECHNIQUE,
  activePrinter,
  canOrderProduct,
  catalogIdFor,
  catalogLookupId,
  isAopProduct,
  parseStoredGarment,
  resolveTemplateId,
} from "./garments.ts";
import { canBuyDesign, parseRecipient } from "./validate.ts";
import { cartDelta, normalizeCartQuantity } from "./cart-qty.ts";
import type { CartLine } from "./models.ts";
import { designSpots, fileUrl, spotExtraCents, sumCents, type DesignRow } from "./shared.server.ts";

/**
 * Refuses a piece the printer cannot make yet. A known all-over id stays closed
 * until its panel files exist. Anything else is ordered only when it is a
 * sandbox placement blank, or a Printful product whose techniques are placement
 * prints. A bare catalog number is not enough.
 */
function printerNow() {
  return activePrinter(readPodMode(process.env));
}

/**
 * The variant to look up on this printer. A regular piece made while the shop
 * ran in sandbox keeps its sandbox variant id; live, it maps to the same colour
 * and size of the real Printful product.
 */
function variantOnPrinter(printer: string, variantId: string): string {
  if (printer !== "printful") return variantId;
  return printfulVariantFor(variantId) ?? variantId;
}

function findVariant(product: CatalogProduct, printer: string, variantId: string | null | undefined) {
  if (!variantId) return undefined;
  const wanted = variantOnPrinter(printer, variantId);
  return product.variants.find((item) => item.id === wanted);
}

async function assertOrderable(productId: string): Promise<void> {
  const printer = printerNow();
  const templateId = resolveTemplateId(productId) ?? productId;
  if (isAopProduct(templateId) || isAopProduct(productId)) {
    if (!canOrderProduct(templateId, printer)) throw new Error(AOP_ORDER_CLOSED);
    return;
  }
  if (resolveTemplateId(productId)) {
    if (!canOrderProduct(templateId, printer)) {
      throw new Error("This blank is not bound to the printer yet.");
    }
    return;
  }
  const product = await getPodProvider().getProduct(productId);
  const techniques = product.techniques.map((item) => item.key);
  if (product.construction === "aop" || !isPrintfulPlacementProduct(productId, techniques)) {
    throw new Error(AOP_ORDER_CLOSED);
  }
}

export async function addToCart(
  userId: string,
  designId: string,
  variantId: string,
  colorwayId = "",
): Promise<void> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`select * from designs where id = ${designId}`;
  const design = rows[0];
  if (!design || !canBuyDesign({ ownerId: design.user_id, status: design.status }, userId)) {
    throw new Error("That piece is not for sale.");
  }
  const templateId = design.template_id ?? design.product_id;
  await assertOrderable(templateId);
  const printer = printerNow();
  const catalogId = catalogIdFor(printer, templateId, design.provider_catalog_id);
  if (!catalogId) throw new Error("This blank is not bound to the printer yet.");
  const product = await getPodProvider().getProduct(catalogId);
  const variant = findVariant(product, printer, variantId);
  const saved = findVariant(product, printer, design.variant_id);
  if (
    !variant ||
    (saved?.colorCode && variant.colorCode && saved.colorCode !== variant.colorCode)
  ) {
    throw new Error("Pick a size in this color.");
  }
  const colorway = colorwayId
    ? parseStoredGarment(design.garment_json)?.colorways.find((item) => item.id === colorwayId)
    : undefined;
  if (colorwayId && !colorway) throw new Error("That colorway is not on this piece.");
  const label = colorway ? `${variant.name} · ${colorway.name}` : variant.name;
  const id = crypto.randomUUID();
  await sql`
    insert into cart_items (
      id, user_id, design_id, variant_id, variant_label, quantity, colorway_id,
      template_id, provider, provider_catalog_id, provider_variant_id
    )
    values (
      ${id}, ${userId}, ${design.id}, ${variant.id}, ${label}, 1, ${colorwayId},
      ${templateId}, ${printer}, ${catalogId}, ${variant.id}
    )
    on conflict (user_id, design_id, variant_id, colorway_id)
    do update set quantity = least(10, cart_items.quantity + 1), variant_label = excluded.variant_label
  `;
}

export async function updateCart(userId: string, cartId: string, quantity: number): Promise<void> {
  const sql = await getSql();
  const next = normalizeCartQuantity(quantity);
  if (next == null) {
    await sql`delete from cart_items where id = ${cartId} and user_id = ${userId}`;
    return;
  }
  await sql`update cart_items set quantity = ${next} where id = ${cartId} and user_id = ${userId}`;
}

/** Apply +1 or -1 in the database so two clicks cannot both write the same stale count. */
export async function nudgeCart(userId: string, cartId: string, delta: number): Promise<void> {
  const step = cartDelta(delta);
  const sql = await getSql();
  const bumped = await sql<{ id: string }>`
    update cart_items
    set quantity = least(10, quantity + ${step})
    where id = ${cartId} and user_id = ${userId} and quantity + ${step} >= 1
    returning id
  `;
  if (bumped.length === 0 && step < 0) {
    await sql`delete from cart_items where id = ${cartId} and user_id = ${userId} and quantity <= 1`;
  }
}

type CartJoin = DesignRow & {
  cart_id: string;
  cart_variant_id: string;
  cart_variant_label: string;
  cart_colorway_id: string;
  quantity: number;
};

async function readCartRows(userId: string): Promise<CartJoin[]> {
  const sql = await getSql();
  return sql<CartJoin>`
    select d.*, c.id as cart_id, c.variant_id as cart_variant_id, c.variant_label as cart_variant_label, c.colorway_id as cart_colorway_id, c.quantity
    from cart_items c
    join designs d on d.id = c.design_id
    where c.user_id = ${userId}
    order by c.created_at asc
  `;
}

/**
 * The cart on its way to the printer, for pricing, shipping quotes and
 * checkout. A line the printer cannot make yet, such as an all-over piece
 * added before ordering closed, stops it here. The cart view reads
 * `readCartRows` so that line can still be seen and removed.
 */
function rowTemplate(row: { template_id?: string | null; product_id: string }): string {
  return row.template_id ?? row.product_id;
}

export async function cartRows(userId: string): Promise<CartJoin[]> {
  const rows = await readCartRows(userId);
  for (const row of rows) await assertOrderable(rowTemplate(row));
  return rows;
}

export async function listCart(userId: string): Promise<CartLine[]> {
  const rows = await readCartRows(userId);
  const prices = new Map<string, number>();
  const provider = getPodProvider();
  const products = new Map<string, CatalogProduct>();
  for (const row of rows) {
    try {
      const catalogId = catalogLookupId(printerNow(), rowTemplate(row), row.provider_catalog_id);
      if (!catalogId) continue;
      let product = products.get(catalogId);
      if (!product) {
        product = await provider.getProduct(catalogId);
        products.set(catalogId, product);
      }
      const variant = findVariant(product, printerNow(), row.cart_variant_id);
      if (variant?.retailCents != null) {
        const extra = isAopProduct(rowTemplate(row))
          ? 0
          : spotExtraCents(product, designSpots(row).map((spot) => spot.placement));
        prices.set(row.cart_id, variant.retailCents + extra);
      }
    } catch {
      /* Catalog lookups can fail in the cart view. Checkout prices the order again. */
    }
  }
  return rows.map((row) => ({
    id: row.cart_id,
    designId: row.id,
    title: row.title,
    slug: row.slug,
    mockupUrl: row.mockup_url,
    variantId: row.cart_variant_id,
    variantLabel: row.cart_variant_label,
    quantity: Number(row.quantity),
    unitCents: prices.get(row.cart_id) ?? Number(row.retail_cents),
  }));
}

export async function priceCart(userId: string) {
  const rows = await cartRows(userId);
  if (rows.length === 0) throw new Error("The cart is empty.");
  const provider = getPodProvider();
  const printer = printerNow();
  const products = new Map<string, CatalogProduct>();
  const lines = [];
  for (const row of rows) {
    if (!row.print_file_id) throw new Error(`${row.title} is missing a print file.`);
    const templateId = rowTemplate(row);
    const catalogId = catalogIdFor(printer, templateId, row.provider_catalog_id ?? row.product_id);
    if (!catalogId) throw new Error(`${row.title} is not bound to this printer yet.`);
    let product = products.get(catalogId);
    if (!product) {
      product = await provider.getProduct(catalogId);
      products.set(catalogId, product);
    }
    const variant = findVariant(product, printer, row.cart_variant_id);
    if (!variant || variant.retailCents == null)
      throw new Error(`${row.title} is not available in that size.`);
    if (!variant.inStock) throw new Error(`${row.title} is out of stock in that size.`);
    const area =
      variant.printAreas.find((item) => item.placement === row.placement) ?? variant.printAreas[0];
    const colorway = row.cart_colorway_id
      ? parseStoredGarment(row.garment_json)?.colorways.find(
          (item) => item.id === row.cart_colorway_id,
        )
      : undefined;
    // The maker dropped or renamed the colorway after it went in the bag. Stop here, the
    // way a size that is gone does, rather than charge for a colorway the order will not name.
    if (row.cart_colorway_id && !colorway)
      throw new Error(`${row.title} no longer comes in that colorway. Remove it and pick again.`);
    const garment = isAopProduct(templateId) ? parseStoredGarment(row.garment_json) : null;
    if (isAopProduct(templateId) && !garment)
      throw new Error(`${row.title} lost its panels. Open it in the studio and save it again.`);
    // A regular piece prints every spot that has art, each from its own file.
    const spots = garment ? [] : designSpots(row);
    if (spots.some((spot) => !spot.printFileId))
      throw new Error(`${row.title} is missing a print file. Open it in the studio and save it again.`);
    const files =
      spots.length > 1
        ? spots.map((spot) => ({
            placement: spot.placement,
            url: fileUrl(spot.printFileId ?? ""),
            area:
              variant.printAreas.find((item) => item.placement === spot.placement) ?? undefined,
          }))
        : undefined;
    const extraCents = spotExtraCents(
      product,
      spots.map((spot) => spot.placement),
    );
    lines.push({
      designId: row.id,
      title: row.title,
      variantId: variant.id,
      variantLabel: colorway ? `${variant.name} · ${colorway.name}` : variant.name,
      quantity: Number(row.quantity),
      unitCents: variant.retailCents + extraCents,
      files,
      placement: row.placement,
      technique: garment ? AOP_TECHNIQUE : row.technique,
      fileUrl: fileUrl(row.print_file_id),
      printArea: area,
      // An all-over line prints every placement. Checkout turns this into one file per placement.
      aop: garment
        ? { garment, colorwayId: colorway?.id ?? null, logoFileId: row.print_file_id }
        : undefined,
      colorwayId: colorway?.id,
      colorwayName: colorway?.name,
      templateId,
      provider: printer,
      providerCatalogId: catalogId,
      providerVariantId: variant.id,
    });
  }
  return { provider, lines };
}

export async function quoteShipping(userId: string, recipientInput: unknown) {
  const recipient = parseRecipient(recipientInput);
  const { provider, lines } = await priceCart(userId);
  const rates = await provider.shippingRates({
    recipient,
    currency: "USD",
    items: lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      retailCents: line.unitCents,
    })),
  });
  return { rates, subtotalCents: sumCents(lines), currency: "USD" as const };
}
