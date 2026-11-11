import type { PodProvider } from "./types.ts";
import { verifyPrintfulSignature } from "./signature.ts";
import { parseStripeEvent, verifyStripeSignature } from "../payments/stripe.ts";

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "submitted"
  | "failed"
  | "needs_review"
  | "canceled"
  | "shipped"
  | "delivered";

export type FulfillmentOrder = {
  id: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid";
  totalCents: number;
  providerOrderId: string | null;
};

export type ProviderEvent = {
  id: string;
  type: string;
  orderExternalId?: string;
  providerOrderId?: string;
  providerStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

export interface OrderStore {
  getOrder(id: string): Promise<FulfillmentOrder | null>;
  findByExternalId(externalId: string): Promise<FulfillmentOrder | null>;
  findByProviderOrderId(providerOrderId: string): Promise<FulfillmentOrder | null>;
  markSubmitted(id: string, providerStatus: string): Promise<void>;
  /** Payment was captured but the printer rejected or dropped the confirm. Retryable. Not a refund. */
  markFulfillmentFailed(id: string, reason: string): Promise<void>;
  /** The captured amount does not match the order. Do not print. A human refunds in Stripe. */
  markNeedsReview(id: string, reason: string): Promise<void>;
  applyProviderUpdate(
    id: string,
    patch: { status?: OrderStatus; providerStatus?: string; trackingNumber?: string; trackingUrl?: string },
  ): Promise<void>;
  hasEvent(id: string): Promise<boolean>;
  recordEvent(id: string, provider: string, type: string): Promise<void>;
}

export type FulfillmentResult =
  | { ok: true; action: "confirmed" | "ignored"; reason?: string }
  | { ok: false; reason: string };

const FORWARD: OrderStatus[] = ["draft", "awaiting_payment", "paid", "submitted", "shipped", "delivered"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "needs_review") return false;
  if (from === "failed" && to === "submitted") return true;
  if (to === "failed" || to === "canceled") return from !== "delivered" && from !== "canceled" && from !== "shipped";
  const fromRank = FORWARD.indexOf(from);
  const toRank = FORWARD.indexOf(to);
  if (fromRank < 0 || toRank < 0) return false;
  return toRank >= fromRank;
}

/**
 * Live Printful orders bill the store wallet the moment they are confirmed.
 * A sandbox payment must never be allowed to do that.
 */
export function assertFulfillmentAllowed(podMode: "live" | "sandbox", paymentsMode: "live" | "sandbox"): void {
  if (podMode === "live" && paymentsMode !== "live") {
    throw new Error("Sandbox payment cannot confirm a live print order.");
  }
}

export function decidePaymentFulfillment(
  order: FulfillmentOrder | null,
  payment: { paid: boolean; amountCents?: number },
): FulfillmentResult {
  if (!order) return { ok: false, reason: "not_found" };
  if (!payment.paid) return { ok: false, reason: "unpaid" };
  if (payment.amountCents != null && payment.amountCents !== order.totalCents) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (order.status === "canceled") return { ok: false, reason: "canceled" };
  if (order.status === "needs_review") return { ok: false, reason: "needs_review" };
  if (order.status === "submitted" || order.status === "shipped" || order.status === "delivered") {
    return { ok: true, action: "ignored", reason: "already_fulfilled" };
  }
  if (order.status === "failed" && order.paymentStatus !== "paid") return { ok: false, reason: "unpaid" };
  if (!order.providerOrderId) return { ok: false, reason: "missing_provider_order" };
  if (!canTransition(order.status, "submitted")) return { ok: false, reason: "illegal_transition" };
  return { ok: true, action: "confirmed" };
}

function alreadyConfirmed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already (confirmed|fulfilled|being fulfilled)|status is (pending|inprocess|in_process)/i.test(message);
}

export async function fulfillPaidOrder(
  store: OrderStore,
  provider: PodProvider,
  input: {
    orderId: string;
    paid: boolean;
    amountCents?: number;
    podMode: "live" | "sandbox";
    paymentsMode: "live" | "sandbox";
  },
): Promise<FulfillmentResult> {
  const order = await store.getOrder(input.orderId);
  const decision = decidePaymentFulfillment(order, { paid: input.paid, amountCents: input.amountCents });
  if (!decision.ok || decision.action === "ignored") return decision;
  assertFulfillmentAllowed(input.podMode, input.paymentsMode);
  const providerOrderId = order?.providerOrderId;
  if (!providerOrderId) return { ok: false, reason: "missing_provider_order" };
  try {
    await provider.confirmOrder(providerOrderId);
  } catch (error) {
    if (!alreadyConfirmed(error)) {
      const message = error instanceof Error ? error.message : "The printer did not accept the order.";
      await store.markFulfillmentFailed(input.orderId, message);
      throw error;
    }
  }
  await store.markSubmitted(input.orderId, "pending");
  return { ok: true, action: "confirmed" };
}

export function parsePrintfulEvent(rawBody: string): ProviderEvent {
  const body = JSON.parse(rawBody) as {
    type?: unknown;
    occurred_at?: unknown;
    data?: { order?: Record<string, unknown>; shipment?: Record<string, unknown> };
  };
  const type = String(body.type ?? "unknown");
  const order = body.data?.order ?? {};
  const shipment = body.data?.shipment ?? {};
  const occurred = String(body.occurred_at ?? "");
  const orderId = order.id != null ? String(order.id) : "";
  const shipmentId = shipment.id != null ? String(shipment.id) : "";
  return {
    id: `${type}:${orderId}:${shipmentId}:${occurred}`,
    type,
    orderExternalId: order.external_id != null && order.external_id !== "" ? String(order.external_id) : undefined,
    providerOrderId: orderId || undefined,
    providerStatus: order.status != null ? String(order.status) : undefined,
    trackingNumber: shipment.tracking_number != null ? String(shipment.tracking_number) : undefined,
    trackingUrl: shipment.tracking_url != null ? String(shipment.tracking_url) : undefined,
  };
}

export function statusFromProviderEvent(event: ProviderEvent): OrderStatus | null {
  switch (event.type) {
    case "shipment_sent":
      return "shipped";
    case "shipment_delivered":
      return "delivered";
    case "order_failed":
    case "shipment_canceled":
      return "failed";
    case "order_canceled":
      return "canceled";
    case "order_created":
    case "order_updated":
    case "order_put_hold":
    case "order_put_hold_approval": {
      const status = (event.providerStatus ?? "").toLowerCase();
      if (status === "fulfilled" || status === "shipped") return "shipped";
      if (status === "canceled" || status === "cancelled") return "canceled";
      if (status === "failed") return "failed";
      if (status === "onhold" || status === "on_hold") return null;
      return null;
    }
    default:
      return null;
  }
}

export async function processPrintfulWebhook(args: {
  rawBody: string;
  signature: string | null;
  secret: string;
  store: OrderStore;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!args.secret) return { status: 503, body: { error: "webhook secret is not configured" } };
  if (!verifyPrintfulSignature(args.rawBody, args.signature, args.secret)) {
    return { status: 401, body: { error: "invalid signature" } };
  }
  let event: ProviderEvent;
  try {
    event = parsePrintfulEvent(args.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid payload" } };
  }
  if (await args.store.hasEvent(event.id)) return { status: 200, body: { duplicate: true } };
  const order =
    (event.orderExternalId ? await args.store.findByExternalId(event.orderExternalId) : null) ??
    (event.providerOrderId ? await args.store.findByProviderOrderId(event.providerOrderId) : null);
  if (!order) {
    await args.store.recordEvent(event.id, "printful", event.type);
    return { status: 200, body: { ignored: true } };
  }
  const next = statusFromProviderEvent(event);
  if (next && canTransition(order.status, next)) {
    await args.store.applyProviderUpdate(order.id, {
      status: next,
      providerStatus: event.providerStatus ?? event.type,
      trackingNumber: event.trackingNumber,
      trackingUrl: event.trackingUrl,
    });
  } else if (event.providerStatus || event.trackingNumber) {
    await args.store.applyProviderUpdate(order.id, {
      providerStatus: event.providerStatus ?? event.type,
      trackingNumber: event.trackingNumber,
      trackingUrl: event.trackingUrl,
    });
  }
  await args.store.recordEvent(event.id, "printful", event.type);
  return { status: 200, body: { ok: true, orderId: order.id, status: next ?? order.status } };
}

export async function processStripeWebhook(args: {
  rawBody: string;
  signature: string | null;
  secret: string;
  store: OrderStore;
  provider: PodProvider;
  podMode: "live" | "sandbox";
  paymentsMode: "live" | "sandbox";
  now?: number;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!args.secret) return { status: 503, body: { error: "webhook secret is not configured" } };
  if (!verifyStripeSignature(args.rawBody, args.signature, args.secret, args.now)) {
    return { status: 401, body: { error: "invalid signature" } };
  }
  let event: ReturnType<typeof parseStripeEvent>;
  try {
    event = parseStripeEvent(args.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid payload" } };
  }
  if (!event.id) return { status: 400, body: { error: "missing event id" } };
  if (await args.store.hasEvent(event.id)) return { status: 200, body: { duplicate: true } };
  const relevant =
    event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  if (!relevant || !event.orderId) {
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: { ignored: true } };
  }
  try {
    const result = await fulfillPaidOrder(args.store, args.provider, {
      orderId: event.orderId,
      paid: event.paid,
      amountCents: event.amountCents,
      podMode: args.podMode,
      paymentsMode: args.paymentsMode,
    });
    if (!result.ok && result.reason === "amount_mismatch") {
      await args.store.markNeedsReview(
        event.orderId,
        "Stripe captured an amount that does not match this order. The print was not submitted. Refund the charge in Stripe.",
      );
    }
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fulfillment failed";
    return { status: 500, body: { error: message } };
  }
}
