import { getSql } from "../db.ts";
import { getPodProvider } from "../pod/index.ts";
import type { CatalogProduct } from "../pod/types.ts";
import { canBuyDesign, parseRecipient } from "./validate.ts";
import { cartDelta, normalizeCartQuantity } from "./cart-qty.ts";
import type { CartLine } from "./models.ts";
import { fileUrl, sumCents, type DesignRow } from "./shared.server.ts";

export async function addToCart(
  userId: string,
  designId: string,
  variantId: string,
): Promise<void> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`select * from designs where id = ${designId}`;
  const design = rows[0];
  if (!design || !canBuyDesign({ ownerId: design.user_id, status: design.status }, userId)) {
    throw new Error("That piece is not for sale.");
  }
  const product = await getPodProvider().getProduct(design.product_id);
  const variant = product.variants.find(
    (item) => item.id === variantId && item.color === design.color_name,
  );
  if (!variant) throw new Error("Pick a size in this color.");
  const id = crypto.randomUUID();
  await sql`
    insert into cart_items (id, user_id, design_id, variant_id, variant_label, quantity)
    values (${id}, ${userId}, ${design.id}, ${variant.id}, ${variant.name}, 1)
    on conflict (user_id, design_id, variant_id)
    do update set quantity = least(10, cart_items.quantity + 1)
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
  quantity: number;
};

export async function cartRows(userId: string): Promise<CartJoin[]> {
  const sql = await getSql();
  return sql<CartJoin>`
    select d.*, c.id as cart_id, c.variant_id as cart_variant_id, c.variant_label as cart_variant_label, c.quantity
    from cart_items c
    join designs d on d.id = c.design_id
    where c.user_id = ${userId}
    order by c.created_at asc
  `;
}

export async function listCart(userId: string): Promise<CartLine[]> {
  const rows = await cartRows(userId);
  const prices = new Map<string, number>();
  const provider = getPodProvider();
  const products = new Map<string, CatalogProduct>();
  for (const row of rows) {
    try {
      let product = products.get(row.product_id);
      if (!product) {
        product = await provider.getProduct(row.product_id);
        products.set(row.product_id, product);
      }
      const variant = product.variants.find((item) => item.id === row.cart_variant_id);
      if (variant?.retailCents != null) prices.set(row.cart_id, variant.retailCents);
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
  const products = new Map<string, CatalogProduct>();
  const lines = [];
  for (const row of rows) {
    if (!row.print_file_id) throw new Error(`${row.title} is missing a print file.`);
    let product = products.get(row.product_id);
    if (!product) {
      product = await provider.getProduct(row.product_id);
      products.set(row.product_id, product);
    }
    const variant = product.variants.find((item) => item.id === row.cart_variant_id);
    if (!variant || variant.retailCents == null)
      throw new Error(`${row.title} is not available in that size.`);
    const area =
      variant.printAreas.find((item) => item.placement === row.placement) ?? variant.printAreas[0];
    lines.push({
      designId: row.id,
      title: row.title,
      variantId: variant.id,
      variantLabel: variant.name,
      quantity: Number(row.quantity),
      unitCents: variant.retailCents,
      placement: row.placement,
      technique: row.technique,
      fileUrl: fileUrl(row.print_file_id),
      printArea: area,
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
