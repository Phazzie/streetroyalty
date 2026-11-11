import { getRequest } from "@tanstack/react-start/server";
import { getSql, type Sql } from "../db.ts";
import {
  fulfillPaidOrder,
  processPrintfulWebhook,
  processStripeWebhook,
  type FulfillmentOrder,
  type OrderStatus,
  type OrderStore,
} from "../pod/order-flow.ts";
import { getPodProvider, readPaymentsMode, readPodMode, readMarkup } from "../pod/index.ts";
import type { CatalogProduct, Recipient } from "../pod/types.ts";
import { PodError } from "../pod/types.ts";
import { createCheckoutSession, retrieveCheckoutSession } from "../payments/stripe.ts";
import { isPublicHttpUrl, parseLayers, parsePrintFile, parseRecipient, slugify } from "./validate.ts";
import type { CartLine, CollectionRecord, DesignRecord, DesignSummary, OrderSummary, StudioConfig } from "./models.ts";

type DesignRow = {
  id: string;
  user_id: string;
  collection_id: string | null;
  collection_name?: string | null;
  title: string;
  slug: string;
  status: string;
  product_id: string;
  product_name: string;
  product_type: string;
  variant_id: string;
  variant_label: string;
  color_name: string;
  color_hex: string;
  size_label: string;
  placement: string;
  technique: string;
  layers_json: string;
  print_file_id: string | null;
  mockup_url: string | null;
  retail_cents: number;
  currency: string;
  provider_product_id: string | null;
  updated_at: string;
};

function summary(row: DesignRow): DesignSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status === "published" ? "published" : "draft",
    collectionId: row.collection_id,
    collectionName: row.collection_name ?? undefined,
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    variantId: row.variant_id,
    variantLabel: row.variant_label,
    colorName: row.color_name,
    colorHex: row.color_hex,
    sizeLabel: row.size_label,
    placement: row.placement,
    technique: row.technique,
    mockupUrl: row.mockup_url,
    retailCents: Number(row.retail_cents),
    currency: row.currency,
    updatedAt: String(row.updated_at),
  };
}

function record(row: DesignRow): DesignRecord {
  return { ...summary(row), layers: parseLayers(JSON.parse(row.layers_json)), printFileId: row.print_file_id };
}

function origin(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(getRequest().url).origin;
}

function fileUrl(id: string): string {
  return `${origin()}/api/print-files/${id}`;
}

export function readStudioConfig(): StudioConfig {
  const env = process.env;
  return {
    podMode: readPodMode(env),
    paymentsMode: readPaymentsMode(env),
    markup: readMarkup(env),
    currency: "USD",
  };
}

export async function loadCatalog(offset: number, limit: number) {
  const provider = getPodProvider();
  const page = await provider.listProducts({ offset, limit });
  return {
    ...readStudioConfig(),
    provider: provider.id,
    products: page.products.map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      brand: product.brand,
      imageUrl: product.imageUrl,
      placements: product.placements,
      colors: product.colors,
    })),
    total: page.total,
    offset: page.offset,
    limit: page.limit,
  };
}

export async function loadProduct(productId: string): Promise<CatalogProduct & { podMode: StudioConfig["podMode"] }> {
  const product = await getPodProvider().getProduct(productId);
  return { ...product, podMode: readStudioConfig().podMode };
}

async function ownedDesign(sql: Sql, userId: string, designId: string): Promise<DesignRow | null> {
  const rows = await sql<DesignRow>`
    select d.*, c.name as collection_name
    from designs d
    left join collections c on c.id = d.collection_id
    where d.id = ${designId} and d.user_id = ${userId}
  `;
  return rows[0] ?? null;
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
};

export async function saveDesign(userId: string, input: SaveInput): Promise<DesignRecord> {
  const title = input.title.trim().slice(0, 80);
  if (title.length < 2) throw new Error("Name the piece.");
  const layers = parseLayers(input.layers);
  const print = parsePrintFile(input.printFile);
  const provider = getPodProvider();
  const product = await provider.getProduct(input.productId);
  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant || variant.retailCents == null) throw new Error("That size and color is not in the catalog.");
  const placement = product.placements.find((item) => item.placement === input.placement);
  if (!placement) throw new Error("That product does not print there.");
  const sql = await getSql();
  if (input.collectionId) {
    const owned = await sql<{ id: string }>`select id from collections where id = ${input.collectionId} and user_id = ${userId}`;
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
  const mockup = input.mockupUrl?.slice(0, 2_000_000) || existing?.mockup_url || null;
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
    return record(saved);
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
  return record(saved);
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
  const area = variant.printAreas.find((item) => item.placement === placement.placement) ?? variant.printAreas[0];
  let publicUrl: string | undefined;
  if (readStudioConfig().podMode === "live") {
    const print = parsePrintFile(input.printFile);
    if (!print || !input.userId) throw new Error("Sign in and export the print file before asking Printful for a mockup.");
    const sql = await getSql();
    const fileId = crypto.randomUUID();
    await sql`insert into print_files (id, user_id, mime, data_base64) values (${fileId}, ${input.userId}, ${print.mime}, ${print.base64})`;
    publicUrl = fileUrl(fileId);
    if (!isPublicHttpUrl(publicUrl)) {
      throw new Error("Printful has to download the print file. Set APP_PUBLIC_URL to the public https origin.");
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
    if (!isPublicHttpUrl(url)) throw new Error("Set APP_PUBLIC_URL so Printful can fetch the print file.");
    const synced = await getPodProvider().syncProduct({
      externalId: row.id,
      name: row.title,
      thumbnailUrl: row.mockup_url.startsWith("http") ? row.mockup_url : undefined,
      existingId: providerProductId ?? undefined,
      variants: [
        {
          catalogVariantId: row.variant_id,
          retailPrice: (row.retail_cents / 100).toFixed(2),
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

export async function getShopDesign(slug: string): Promise<DesignSummary & { sizes: { variantId: string; label: string; retailCents: number }[] }> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`select * from designs where slug = ${slug} and status = 'published'`;
  const row = rows[0];
  if (!row) throw new Error("That piece is not on the rack.");
  const product = await getPodProvider().getProduct(row.product_id);
  const sizes = product.variants
    .filter((variant) => variant.color === row.color_name && variant.retailCents != null)
    .map((variant) => ({ variantId: variant.id, label: variant.size, retailCents: variant.retailCents ?? Number(row.retail_cents) }));
  if (!sizes.some((size) => size.variantId === row.variant_id)) {
    sizes.push({ variantId: row.variant_id, label: row.size_label, retailCents: Number(row.retail_cents) });
  }
  return { ...summary(row), sizes };
}

export async function readPrintFile(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await getSql();
  const rows = await sql<{ mime: string; data_base64: string }>`select mime, data_base64 from print_files where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  const binary = atob(row.data_base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: row.mime, bytes };
}

export async function addToCart(userId: string, designId: string, variantId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<DesignRow>`
    select * from designs where id = ${designId} and (user_id = ${userId} or status = 'published')
  `;
  const design = rows[0];
  if (!design) throw new Error("That piece is not for sale.");
  const product = await getPodProvider().getProduct(design.product_id);
  const variant = product.variants.find((item) => item.id === variantId && item.color === design.color_name);
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
  const next = Math.round(quantity);
  if (next <= 0) {
    await sql`delete from cart_items where id = ${cartId} and user_id = ${userId}`;
    return;
  }
  await sql`update cart_items set quantity = ${Math.min(10, next)} where id = ${cartId} and user_id = ${userId}`;
}

type CartJoin = DesignRow & { cart_id: string; cart_variant_id: string; cart_variant_label: string; quantity: number };

async function cartRows(userId: string): Promise<CartJoin[]> {
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

async function priceCart(userId: string) {
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
    if (!variant || variant.retailCents == null) throw new Error(`${row.title} is not available in that size.`);
    const area = variant.printAreas.find((item) => item.placement === row.placement) ?? variant.printAreas[0];
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
    items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, retailCents: line.unitCents })),
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  return { rates, subtotalCents, currency: "USD" as const };
}

export async function startCheckout(userId: string, input: { recipient: unknown; shippingMethod: string }) {
  const recipient: Recipient = parseRecipient(input.recipient);
  const config = readStudioConfig();
  const { provider, lines } = await priceCart(userId);
  if (config.podMode === "live" && lines.some((line) => !isPublicHttpUrl(line.fileUrl))) {
    throw new Error("Set APP_PUBLIC_URL so Printful can download print files.");
  }
  const rates = await provider.shippingRates({
    recipient,
    currency: "USD",
    items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, retailCents: line.unitCents })),
  });
  const rate = rates.find((item) => item.id === input.shippingMethod);
  if (!rate) throw new Error("Pick a shipping method from the quote.");
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  const totalCents = subtotalCents + rate.rateCents;
  const orderId = crypto.randomUUID();
  let draftId: string | null = null;
  try {
    const draft = await provider.createDraftOrder({
      externalId: orderId,
      recipient,
      shippingMethod: rate.id,
      currency: "USD",
      items: lines.map((line) => ({
        externalId: `${orderId}:${line.designId}:${line.variantId}`,
        variantId: line.variantId,
        quantity: line.quantity,
        retailCents: line.unitCents,
        name: line.title,
        placement: line.placement,
        technique: line.technique,
        fileUrl: line.fileUrl,
        printArea: line.printArea,
      })),
    });
    draftId = draft.id;
    const sql = await getSql();
    const itemsJson = JSON.stringify(
      lines.map((line) => ({
        title: line.title,
        quantity: line.quantity,
        variantLabel: line.variantLabel,
        unitCents: line.unitCents,
      })),
    );
    await sql`
      insert into orders (
        id, user_id, status, currency, subtotal_cents, shipping_cents, total_cents, shipping_method,
        recipient_json, items_json, provider, provider_order_id, provider_status, payment_provider,
        payment_status, sandbox
      ) values (
        ${orderId}, ${userId}, 'awaiting_payment', 'USD', ${subtotalCents}, ${rate.rateCents}, ${totalCents}, ${rate.id},
        ${JSON.stringify(recipient)}, ${itemsJson}, ${provider.id}, ${draft.id}, 'draft',
        ${config.paymentsMode === "live" ? "stripe" : "sandbox"}, 'unpaid', ${config.podMode === "sandbox"}
      )
    `;
    if (config.paymentsMode === "sandbox") {
      return { mode: "sandbox" as const, orderId, totalCents };
    }
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) throw new Error("STRIPE_SECRET_KEY is required when PAYMENTS_MODE=live.");
    const base = origin();
    const session = await createCheckoutSession(
      {
        orderId,
        currency: "USD",
        lines: [
          ...lines.map((line) => ({ name: line.title, quantity: line.quantity, unitAmountCents: line.unitCents })),
          { name: rate.name, quantity: 1, unitAmountCents: rate.rateCents },
        ],
        successUrl: `${base}/orders?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/checkout?canceled=1`,
        customerEmail: recipient.email,
      },
      { secretKey: secret },
    );
    await sql`update orders set payment_session_id = ${session.id}, updated_at = now() where id = ${orderId} and user_id = ${userId}`;
    return { mode: "stripe" as const, orderId, url: session.url, totalCents };
  } catch (error) {
    if (draftId) await provider.cancelOrder(draftId).catch(() => undefined);
    const sql = await getSql();
    await sql`update orders set status = 'canceled', updated_at = now() where id = ${orderId} and user_id = ${userId}`;
    if (error instanceof PodError || error instanceof Error) throw error;
    throw new Error("Checkout did not start.");
  }
}

function dbStore(sql: Sql): OrderStore {
  return {
    async getOrder(id) {
      const rows = await sql<FulfillmentOrder & { provider_order_id: string | null; payment_status: string }>`
        select id, status, payment_status, total_cents, provider_order_id from orders where id = ${id}
      `;
      const row = rows[0] as (Record<string, unknown> | undefined);
      if (!row) return null;
      return {
        id: String(row.id),
        status: String(row.status) as OrderStatus,
        paymentStatus: row.payment_status === "paid" ? "paid" : "unpaid",
        totalCents: Number(row.total_cents),
        providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
      };
    },
    async findByExternalId(externalId) {
      return this.getOrder(externalId);
    },
    async findByProviderOrderId(providerOrderId) {
      const rows = await sql<{ id: string }>`select id from orders where provider_order_id = ${providerOrderId} limit 1`;
      if (!rows[0]) return null;
      return this.getOrder(rows[0].id);
    },
    async markSubmitted(id, providerStatus) {
      await sql`
        update orders
        set status = 'submitted', payment_status = 'paid', provider_status = ${providerStatus}, updated_at = now()
        where id = ${id}
      `;
    },
    async applyProviderUpdate(id, patch) {
      await sql`
        update orders set
          status = coalesce(${patch.status ?? null}, status),
          provider_status = coalesce(${patch.providerStatus ?? null}, provider_status),
          tracking_number = coalesce(${patch.trackingNumber ?? null}, tracking_number),
          tracking_url = coalesce(${patch.trackingUrl ?? null}, tracking_url),
          updated_at = now()
        where id = ${id}
      `;
    },
    async hasEvent(id) {
      const rows = await sql<{ id: string }>`select id from webhook_events where id = ${id}`;
      return Boolean(rows[0]);
    },
    async recordEvent(id, provider, type) {
      await sql`
        insert into webhook_events (id, provider, event_type) values (${id}, ${provider}, ${type})
        on conflict (id) do nothing
      `;
    },
  };
}

export async function completeSandboxPayment(userId: string, orderId: string) {
  const config = readStudioConfig();
  if (config.paymentsMode !== "sandbox") throw new Error("Sandbox payment is off.");
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from orders where id = ${orderId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Order not found.");
  const result = await fulfillPaidOrder(dbStore(sql), getPodProvider(), {
    orderId,
    paid: true,
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
  if (!result.ok) throw new Error(`Payment could not submit the print order (${result.reason}).`);
  await sql`delete from cart_items where user_id = ${userId}`;
  return { orderId, status: "submitted" };
}

export async function syncStripeReturn(userId: string, sessionId: string) {
  const config = readStudioConfig();
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (config.paymentsMode !== "live" || !secret) throw new Error("Stripe is not configured.");
  const session = await retrieveCheckoutSession(sessionId, { secretKey: secret });
  if (!session.orderId) throw new Error("That payment is not tied to an order.");
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from orders where id = ${session.orderId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Order not found.");
  const result = await fulfillPaidOrder(dbStore(sql), getPodProvider(), {
    orderId: session.orderId,
    paid: session.paid,
    amountCents: session.amountCents,
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
  if (result.ok) await sql`delete from cart_items where user_id = ${userId}`;
  return result;
}

export async function listOrders(userId: string): Promise<OrderSummary[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, status, payment_status, currency, subtotal_cents, shipping_cents, total_cents, shipping_method,
      provider_order_id, provider_status, tracking_number, tracking_url, sandbox, created_at::text as created_at, items_json
    from orders where user_id = ${userId} order by created_at desc limit 40
  `;
  return rows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    currency: String(row.currency),
    subtotalCents: Number(row.subtotal_cents),
    shippingCents: Number(row.shipping_cents),
    totalCents: Number(row.total_cents),
    shippingMethod: String(row.shipping_method),
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    providerStatus: row.provider_status ? String(row.provider_status) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    sandbox: row.sandbox === true || row.sandbox === "t" || row.sandbox === "true",
    createdAt: String(row.created_at),
    items: JSON.parse(String(row.items_json)) as OrderSummary["items"],
  }));
}

export async function receiveStripeWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  const sql = await getSql();
  const config = readStudioConfig();
  return processStripeWebhook({
    rawBody,
    signature,
    secret: process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "",
    store: dbStore(sql),
    provider: getPodProvider(),
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
}

export async function receivePrintfulWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  const sql = await getSql();
  return processPrintfulWebhook({
    rawBody,
    signature,
    secret: process.env.PRINTFUL_WEBHOOK_SECRET?.trim() ?? "",
    store: dbStore(sql),
  });
}

export async function connectWebhooks() {
  const config = readStudioConfig();
  const url = `${origin()}/api/webhooks/printful`;
  if (config.podMode === "sandbox") {
    return { url, mode: "sandbox" as const, events: [] as string[], secretHex: undefined as string | undefined };
  }
  const registration = await getPodProvider().registerWebhooks(url);
  return { url, mode: "live" as const, events: registration.events, secretHex: registration.secretHex };
}
