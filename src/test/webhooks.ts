import { signPrintfulBody } from "@/lib/pod/signature.ts";
import { signStripeBody } from "@/lib/payments/stripe.ts";

export const STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
export const PRINTFUL_WEBHOOK_SECRET = "printful-test-secret";

export type SignedWebhook = { raw: string; signature: string };

/** A Stripe event signed the way Stripe signs it, timestamped now. */
export function stripeEvent(input: {
  id: string;
  type?: string;
  orderId?: string;
  amountCents?: number;
  paymentStatus?: string;
}): SignedWebhook {
  const raw = JSON.stringify({
    id: input.id,
    type: input.type ?? "checkout.session.completed",
    data: {
      object: {
        payment_status: input.paymentStatus ?? "paid",
        amount_total: input.amountCents,
        client_reference_id: input.orderId,
        metadata: input.orderId ? { order_id: input.orderId } : {},
      },
    },
  });
  return {
    raw,
    signature: signStripeBody(raw, STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000)),
  };
}

/** A Printful event for one order. `at` keeps two events of the same type distinct. */
export function printfulEvent(input: {
  type: string;
  orderId: string;
  providerOrderId: string;
  status?: string;
  trackingNumber?: string;
  at?: string;
}): SignedWebhook {
  const raw = JSON.stringify({
    type: input.type,
    occurred_at: input.at ?? "2026-03-01T12:00:00Z",
    data: {
      order: { id: input.providerOrderId, external_id: input.orderId, status: input.status },
      shipment: input.trackingNumber
        ? { id: `ship-${input.trackingNumber}`, tracking_number: input.trackingNumber }
        : undefined,
    },
  });
  return { raw, signature: signPrintfulBody(raw, PRINTFUL_WEBHOOK_SECRET) };
}
