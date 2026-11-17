import { getSql } from "@/lib/db.ts";
import type { FulfillmentOrder } from "@/lib/pod/order-flow.ts";

/** An order row in exactly this state, for tests that start mid-lifecycle. */
export async function seedOrderRow(
  order: FulfillmentOrder,
  options: { userId?: string; items?: unknown[] } = {},
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into orders (
      id, user_id, status, currency, subtotal_cents, shipping_cents, total_cents, shipping_method,
      recipient_json, items_json, provider, provider_order_id, provider_status, payment_provider,
      payment_status, sandbox
    ) values (
      ${order.id}, ${options.userId ?? "u1"}, ${order.status}, 'USD', ${order.totalCents - 595}, 595,
      ${order.totalCents}, 'STANDARD', '{}', ${JSON.stringify(options.items ?? [])}, 'sandbox',
      ${order.providerOrderId}, 'draft', 'sandbox', ${order.paymentStatus}, true
    )
  `;
}
