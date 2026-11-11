import { createHmac } from "node:crypto";
import { safeEqualText } from "../pod/signature.ts";

const TOLERANCE_SECONDS = 300;

export type StripeSession = {
  id: string;
  url: string;
};

export type StripeCheckoutEvent = {
  id: string;
  type: string;
  orderId?: string;
  paid: boolean;
  amountCents?: number;
};

export type CheckoutLine = {
  name: string;
  quantity: number;
  unitAmountCents: number;
};

export type CreateCheckoutInput = {
  orderId: string;
  currency: string;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
};

type FetchLike = typeof fetch;

/**
 * Stripe Checkout via the REST API. The secret key stays on the server.
 * `fetchImpl` is injectable so tests never touch the network.
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
  options: { secretKey: string; fetchImpl?: FetchLike },
): Promise<StripeSession> {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.orderId);
  body.set("metadata[order_id]", input.orderId);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  input.lines.forEach((line, index) => {
    body.set(`line_items[${index}][quantity]`, String(line.quantity));
    body.set(`line_items[${index}][price_data][currency]`, input.currency.toLowerCase());
    body.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitAmountCents));
    body.set(`line_items[${index}][price_data][product_data][name]`, line.name.slice(0, 120));
  });
  // Stripe substitutes this token only when the braces are left unencoded.
  const encoded = body.toString().replaceAll("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encoded,
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.id || !json.url) {
    throw new Error(json.error?.message || `Stripe checkout failed (${response.status})`);
  }
  return { id: json.id, url: json.url };
}

export async function retrieveCheckoutSession(
  sessionId: string,
  options: { secretKey: string; fetchImpl?: FetchLike },
): Promise<{ id: string; paid: boolean; orderId?: string; amountCents?: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${options.secretKey}` },
  });
  const json = (await response.json()) as {
    id?: string;
    payment_status?: string;
    amount_total?: number;
    client_reference_id?: string;
    metadata?: { order_id?: string };
    error?: { message?: string };
  };
  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || `Stripe session lookup failed (${response.status})`);
  }
  return {
    id: json.id,
    paid: json.payment_status === "paid",
    orderId: json.metadata?.order_id || json.client_reference_id || undefined,
    amountCents: typeof json.amount_total === "number" ? json.amount_total : undefined,
  };
}

/** Stripe-Signature: `t=unix,v1=hex`. Signed payload is `${t}.${rawBody}`. */
export function signStripeBody(rawBody: string, secret: string, timestamp: number): string {
  const payload = `${timestamp}.${rawBody}`;
  const hex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},v1=${hex}`;
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const payload = `${timestampPart.slice(2)}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return signatures.some((signature) => safeEqualText(expected, signature.toLowerCase()));
}

export function parseStripeEvent(rawBody: string): StripeCheckoutEvent {
  const body = JSON.parse(rawBody) as {
    id?: unknown;
    type?: unknown;
    data?: {
      object?: {
        payment_status?: unknown;
        amount_total?: unknown;
        client_reference_id?: unknown;
        metadata?: { order_id?: unknown };
      };
    };
  };
  const object = body.data?.object ?? {};
  const type = String(body.type ?? "");
  const paid = object.payment_status === "paid" || type === "checkout.session.async_payment_succeeded";
  const orderFromMeta = object.metadata?.order_id;
  return {
    id: String(body.id ?? ""),
    type,
    orderId: orderFromMeta != null && orderFromMeta !== "" ? String(orderFromMeta) : object.client_reference_id ? String(object.client_reference_id) : undefined,
    paid,
    amountCents: typeof object.amount_total === "number" ? object.amount_total : undefined,
  };
}
