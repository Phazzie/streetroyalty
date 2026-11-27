import type { PaymentsMode, PodProvider } from "./types.ts";
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

export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "submitted",
  "failed",
  "needs_review",
  "canceled",
  "shipped",
  "delivered",
];

/** An order can be claimed for printing from these. Anything later already went to the printer or was stopped. */
export const CLAIMABLE: OrderStatus[] = ["draft", "awaiting_payment", "failed"];

/**
 * An order can be held for a human from these. Canceled is here because a
 * buyer can still pay a Stripe session for an order that was canceled after
 * the session was made, and that money has to be refunded by someone.
 */
export const HOLDABLE: OrderStatus[] = ["draft", "awaiting_payment", "failed", "canceled"];

/** Another caller holds the print claim right now. Ask again shortly. */
export const IN_PROGRESS = "in_progress";

/** How long a claim holds before another paid signal may take it over, in case the first one died mid-confirm. */
export const CLAIM_HOLD_MS = 2 * 60 * 1000;

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
  /**
   * Take the right to send this order to the printer, in one step, so that two
   * paid signals arriving together cannot both confirm it. True for exactly one
   * caller. The order reads `paid` while the claim is held.
   */
  claimForPrint(id: string): Promise<boolean>;
  markSubmitted(id: string, providerStatus: string): Promise<void>;
  /** Payment was captured but the printer rejected or dropped the confirm. Retryable. Not a refund. */
  markFulfillmentFailed(id: string, reason: string): Promise<void>;
  /** The captured amount does not match the order. Do not print. A human refunds in Stripe. */
  markNeedsReview(id: string, reason: string): Promise<void>;
  /** A status the order cannot legally move to is dropped. Tracking and printer status are kept either way. */
  applyProviderUpdate(
    id: string,
    patch: {
      status?: OrderStatus;
      providerStatus?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    },
  ): Promise<void>;
  hasEvent(id: string): Promise<boolean>;
  recordEvent(id: string, provider: string, type: string): Promise<void>;
  /** Drop the cart rows that this paid order just bought. */
  clearPurchasedLines(orderId: string): Promise<void>;
}

export type FulfillmentResult =
  { ok: true; action: "confirmed" | "ignored"; reason?: string } | { ok: false; reason: string };

const FORWARD: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "submitted",
  "shipped",
  "delivered",
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "needs_review") return false;
  if (from === "failed" && to === "submitted") return true;
  if (to === "failed" || to === "canceled")
    return from !== "delivered" && from !== "canceled" && from !== "shipped";
  const fromRank = FORWARD.indexOf(from);
  const toRank = FORWARD.indexOf(to);
  if (fromRank < 0 || toRank < 0) return false;
  return toRank >= fromRank;
}

/**
 * Live Printful orders bill the store wallet the moment they are confirmed.
 * A sandbox payment must never be allowed to do that.
 */
export function assertFulfillmentAllowed(
  podMode: "live" | "sandbox",
  paymentsMode: PaymentsMode,
): void {
  if (podMode === "live" && paymentsMode !== "live") {
    throw new Error(
      "Practice payment (sandbox or a Stripe test card) cannot confirm a live print order.",
    );
  }
}

/** A card charge with no printer would take money and confirm an in-memory draft. */
export function assertLivePaymentHasPrinter(
  podMode: "live" | "sandbox",
  paymentsMode: PaymentsMode,
): void {
  if (paymentsMode === "live" && podMode !== "live") {
    throw new Error("Live payment cannot checkout while printing is sandboxed.");
  }
}

export function purchasedLineKeys(items: unknown): { designId: string; variantId: string }[] {
  if (!Array.isArray(items)) return [];
  const keys: { designId: string; variantId: string }[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as { designId?: unknown; variantId?: unknown };
    const designId = typeof row.designId === "string" ? row.designId : "";
    const variantId = typeof row.variantId === "string" ? row.variantId : "";
    if (designId && variantId) keys.push({ designId, variantId });
  }
  return keys;
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
  if (!order.providerOrderId) return { ok: false, reason: "missing_provider_order" };
  if (!canTransition(order.status, "submitted")) return { ok: false, reason: "illegal_transition" };
  return { ok: true, action: "confirmed" };
}

/** Statuses a printer update may move an order from, to reach `to`. */
export function statusesThatCanBecome(to: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((from) => canTransition(from, to));
}

function refusalSaysConfirmed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already (confirmed|fulfilled|being fulfilled)|status is (pending|inprocess|in_process)/i.test(
    message,
  );
}

/**
 * A confirm can fail because the order is already with the printer. The
 * printer's own record settles that. The wording of its error is only a
 * fallback for when that record cannot be read.
 */
async function printerAlreadyHasIt(
  provider: PodProvider,
  providerOrderId: string,
  error: unknown,
): Promise<boolean> {
  try {
    return (await provider.getOrder(providerOrderId)).confirmed;
  } catch {
    return refusalSaysConfirmed(error);
  }
}

export async function fulfillPaidOrder(
  store: OrderStore,
  provider: PodProvider,
  input: {
    orderId: string;
    paid: boolean;
    amountCents?: number;
    podMode: "live" | "sandbox";
    paymentsMode: PaymentsMode;
  },
): Promise<FulfillmentResult> {
  const order = await store.getOrder(input.orderId);
  const decision = decidePaymentFulfillment(order, {
    paid: input.paid,
    amountCents: input.amountCents,
  });
  if (!decision.ok || decision.action === "ignored") return decision;
  assertLivePaymentHasPrinter(input.podMode, input.paymentsMode);
  assertFulfillmentAllowed(input.podMode, input.paymentsMode);
  const providerOrderId = order?.providerOrderId;
  if (!providerOrderId) return { ok: false, reason: "missing_provider_order" };
  // The read above can be stale by now. Only the caller that wins the claim talks to the printer.
  if (!(await store.claimForPrint(input.orderId))) {
    // Someone else holds it. That is not success: if they died mid-confirm the
    // order is still unprinted, so the caller has to be able to come back.
    return { ok: false, reason: IN_PROGRESS };
  }
  try {
    await provider.confirmOrder(providerOrderId);
  } catch (error) {
    if (!(await printerAlreadyHasIt(provider, providerOrderId, error))) {
      const message =
        error instanceof Error ? error.message : "The printer did not accept the order.";
      await store.markFulfillmentFailed(input.orderId, message);
      throw error;
    }
  }
  await store.markSubmitted(input.orderId, "pending");
  return { ok: true, action: "confirmed" };
}

const HOLD_REASONS: Record<string, string> = {
  amount_mismatch:
    "Stripe captured an amount that does not match this order. The print was not submitted. Refund the charge in Stripe.",
  canceled:
    "Payment arrived for an order that was already canceled. Nothing was printed. Refund the charge in Stripe.",
};

/**
 * A card payment reported by Stripe, from the webhook or from the buyer's
 * return to the site. It prints the order when it can. When money was taken
 * and the order cannot print, it holds the order for a human instead of leaving
 * a charge with nothing on record.
 */
export async function settleCardPayment(
  store: OrderStore,
  provider: PodProvider,
  input: Parameters<typeof fulfillPaidOrder>[2],
): Promise<FulfillmentResult> {
  const result = await fulfillPaidOrder(store, provider, input);
  if (!result.ok && input.paid) {
    const reason = HOLD_REASONS[result.reason];
    if (reason) await store.markNeedsReview(input.orderId, reason);
  }
  return result;
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
    orderExternalId:
      order.external_id != null && order.external_id !== "" ? String(order.external_id) : undefined,
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
  paymentsMode: PaymentsMode;
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
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!relevant || !event.orderId) {
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: { ignored: true } };
  }
  // A test-mode event must never confirm a real print order, and a real payment must
  // never land in a practice shop. Events that say which they are get checked.
  // Real Stripe events always say which mode they came from. Live takes only live events,
  // test only test events, and the no-card sandbox takes neither.
  const expectedLivemode =
    args.paymentsMode === "live" ? true : args.paymentsMode === "test" ? false : null;
  if (event.livemode !== undefined && event.livemode !== expectedLivemode) {
    // Holding marks the order paid, so only an event that actually took money is held.
    if (!event.paid) {
      await args.store.recordEvent(event.id, "stripe", event.type);
      return { status: 200, body: { ok: false, reason: "mode_mismatch" } };
    }
    await args.store.markNeedsReview(
      event.orderId,
      event.livemode
        ? "A real Stripe payment arrived while payments are in practice. No garment was sent. Refund the charge in Stripe."
        : "A Stripe test payment arrived while payments are not on test cards. No garment was sent.",
    );
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: { ok: false, reason: "mode_mismatch" } };
  }
  // Only once money was actually taken. A completed session whose payment has not
  // cleared goes down the normal path, which answers "unpaid" and changes nothing.
  if (event.paid && args.paymentsMode === "live" && args.podMode !== "live") {
    await args.store.markNeedsReview(
      event.orderId,
      "Live payment arrived while printing is sandboxed. No garment was sent. Refund the charge in Stripe.",
    );
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: { ok: false, reason: "sandbox_print" } };
  }
  // A test checkout that was still open when printing went live must not print for real,
  // and must not loop on Stripe's retries either. It is held instead.
  if (event.paid && args.paymentsMode !== "live" && args.podMode === "live") {
    await args.store.markNeedsReview(
      event.orderId,
      "A practice payment arrived after printing went live. No garment was sent.",
    );
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: { ok: false, reason: "practice_payment_live_print" } };
  }
  try {
    const result = await settleCardPayment(args.store, args.provider, {
      orderId: event.orderId,
      paid: event.paid,
      amountCents: event.amountCents,
      podMode: args.podMode,
      paymentsMode: args.paymentsMode,
    });
    if (!result.ok && result.reason === IN_PROGRESS) {
      // Not recorded, so Stripe sends it again. By then the holder has either
      // finished, and this is a no-op, or died, and the retry takes the claim over.
      return { status: 503, body: { retry: true, reason: IN_PROGRESS } };
    }
    if (result.ok) await args.store.clearPurchasedLines(event.orderId);
    await args.store.recordEvent(event.id, "stripe", event.type);
    return { status: 200, body: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fulfillment failed";
    return { status: 500, body: { error: message } };
  }
}
