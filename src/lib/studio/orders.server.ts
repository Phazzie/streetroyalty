import { getSql, type Sql } from "../db.ts";
import {
  assertLivePaymentHasPrinter,
  fulfillPaidOrder,
  processPrintfulWebhook,
  processStripeWebhook,
  purchasedLineKeys,
  type FulfillmentOrder,
  type OrderStatus,
  type OrderStore,
} from "../pod/order-flow.ts";
import { getPodProvider } from "../pod/index.ts";
import type { Recipient } from "../pod/types.ts";
import { PodError } from "../pod/types.ts";
import { createCheckoutSession, retrieveCheckoutSession } from "../payments/stripe.ts";
import { isPublicHttpUrl, parseRecipient } from "./validate.ts";
import { isStudioAdmin } from "./admin.ts";
import type { OrderSummary } from "./models.ts";
import { priceCart } from "./cart.server.ts";
import { origin, readStudioConfig, sumCents } from "./shared.server.ts";

export async function startCheckout(
  userId: string,
  input: { recipient: unknown; shippingMethod: string },
) {
  const recipient: Recipient = parseRecipient(input.recipient);
  const config = readStudioConfig();
  assertLivePaymentHasPrinter(config.podMode, config.paymentsMode);
  const { provider, lines } = await priceCart(userId);
  if (config.podMode === "live" && lines.some((line) => !isPublicHttpUrl(line.fileUrl))) {
    throw new Error("Set APP_PUBLIC_URL so Printful can download print files.");
  }
  const rates = await provider.shippingRates({
    recipient,
    currency: "USD",
    items: lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      retailCents: line.unitCents,
    })),
  });
  const rate = rates.find((item) => item.id === input.shippingMethod);
  if (!rate) throw new Error("Pick a shipping method from the quote.");
  const subtotalCents = sumCents(lines);
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
        designId: line.designId,
        variantId: line.variantId,
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
          ...lines.map((line) => ({
            name: line.title,
            quantity: line.quantity,
            unitAmountCents: line.unitCents,
          })),
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
      const rows = await sql<
        FulfillmentOrder & { provider_order_id: string | null; payment_status: string }
      >`
        select id, status, payment_status, total_cents, provider_order_id from orders where id = ${id}
      `;
      const row = rows[0] as Record<string, unknown> | undefined;
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
      const rows = await sql<{
        id: string;
      }>`select id from orders where provider_order_id = ${providerOrderId} limit 1`;
      if (!rows[0]) return null;
      return this.getOrder(rows[0].id);
    },
    async markSubmitted(id, providerStatus) {
      await sql`
        update orders
        set status = 'submitted', payment_status = 'paid', failure_reason = null, provider_status = ${providerStatus}, updated_at = now()
        where id = ${id}
      `;
    },
    async markFulfillmentFailed(id, reason) {
      await sql`
        update orders
        set status = 'failed', payment_status = 'paid', failure_reason = ${reason.slice(0, 500)}, updated_at = now()
        where id = ${id} and status not in ('submitted', 'shipped', 'delivered')
      `;
    },
    async markNeedsReview(id, reason) {
      await sql`
        update orders
        set status = 'needs_review', payment_status = 'paid', failure_reason = ${reason.slice(0, 500)}, updated_at = now()
        where id = ${id} and status in ('draft', 'awaiting_payment', 'failed')
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
    async clearPurchasedLines(orderId) {
      const rows = await sql<{ user_id: string; items_json: string }>`
        select user_id, items_json from orders where id = ${orderId}
      `;
      const row = rows[0];
      if (!row) return;
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(row.items_json);
      } catch {
        parsed = [];
      }
      for (const line of purchasedLineKeys(parsed)) {
        await sql`
          delete from cart_items
          where user_id = ${row.user_id} and design_id = ${line.designId} and variant_id = ${line.variantId}
        `;
      }
    },
  };
}

export async function completeSandboxPayment(userId: string, orderId: string) {
  const config = readStudioConfig();
  if (config.paymentsMode !== "sandbox") throw new Error("Sandbox payment is off.");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
  }>`select id from orders where id = ${orderId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Order not found.");
  const result = await fulfillPaidOrder(dbStore(sql), getPodProvider(), {
    orderId,
    paid: true,
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
  if (!result.ok) throw new Error(`Payment could not submit the print order (${result.reason}).`);
  await dbStore(sql).clearPurchasedLines(orderId);
  return { orderId, status: "submitted" };
}

export async function syncStripeReturn(userId: string, sessionId: string) {
  const config = readStudioConfig();
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (config.paymentsMode !== "live" || !secret) throw new Error("Stripe is not configured.");
  const session = await retrieveCheckoutSession(sessionId, { secretKey: secret });
  if (!session.orderId) throw new Error("That payment is not tied to an order.");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
  }>`select id from orders where id = ${session.orderId} and user_id = ${userId}`;
  if (!rows[0]) throw new Error("Order not found.");
  const result = await fulfillPaidOrder(dbStore(sql), getPodProvider(), {
    orderId: session.orderId,
    paid: session.paid,
    amountCents: session.amountCents,
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
  if (result.ok) await dbStore(sql).clearPurchasedLines(session.orderId);
  return result;
}

export async function listOrders(userId: string): Promise<OrderSummary[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, status, payment_status, currency, subtotal_cents, shipping_cents, total_cents, shipping_method,
      provider_order_id, provider_status, tracking_number, tracking_url, sandbox, failure_reason,
      created_at::text as created_at, items_json
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
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    createdAt: String(row.created_at),
    items: JSON.parse(String(row.items_json)) as OrderSummary["items"],
  }));
}

export async function retryFulfillment(userId: string, orderId: string) {
  const config = readStudioConfig();
  const sql = await getSql();
  const rows = await sql<{ status: string; payment_status: string; total_cents: number }>`
    select status, payment_status, total_cents from orders where id = ${orderId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Order not found.");
  if (row.payment_status !== "paid" || row.status !== "failed") {
    throw new Error("This order is not waiting on a print retry.");
  }
  const result = await fulfillPaidOrder(dbStore(sql), getPodProvider(), {
    orderId,
    paid: true,
    amountCents: Number(row.total_cents),
    podMode: config.podMode,
    paymentsMode: config.paymentsMode,
  });
  if (!result.ok) throw new Error(`The printer still did not take the order (${result.reason}).`);
  return { orderId, status: "submitted" as const };
}

export async function receiveStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
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

export async function receivePrintfulWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const sql = await getSql();
  return processPrintfulWebhook({
    rawBody,
    signature,
    secret: process.env.PRINTFUL_WEBHOOK_SECRET?.trim() ?? "",
    store: dbStore(sql),
  });
}

export async function readStudioAccess(userId: string): Promise<{ admin: boolean }> {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  return { admin: isStudioAdmin(rows[0]?.email, process.env.STUDIO_ADMIN_EMAILS) };
}

export async function connectWebhooks(userId: string) {
  const access = await readStudioAccess(userId);
  if (!access.admin) throw new Error("Only a store admin can reconnect Printful webhooks.");
  const config = readStudioConfig();
  const url = `${origin()}/api/webhooks/printful`;
  if (config.podMode === "sandbox") {
    return {
      url,
      mode: "sandbox" as const,
      events: [] as string[],
      secretHex: undefined as string | undefined,
    };
  }
  const registration = await getPodProvider().registerWebhooks(url);
  return {
    url,
    mode: "live" as const,
    events: registration.events,
    secretHex: registration.secretHex,
  };
}
