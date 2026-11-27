import { getSql } from "../db.ts";

const HOLD_MS = 30 * 60 * 1000;

export type CheckoutReplay =
  | { mode: "sandbox"; orderId: string; totalCents: number }
  | { mode: "stripe"; orderId: string; totalCents: number; url: string };

type Claim =
  | { owner: true }
  | { owner: false; replay: CheckoutReplay | null };

/** Take the one open slot for this account and cart. The loser is handed the winner's order. */
export async function claimCheckout(userId: string, key: string, orderId: string): Promise<Claim> {
  const sql = await getSql();
  const inserted = await sql<{ order_id: string }>`
    insert into checkout_claims (user_id, idempotency_key, order_id)
    values (${userId}, ${key}, ${orderId})
    on conflict (user_id, idempotency_key) do nothing
    returning order_id
  `;
  if (inserted.length > 0) return { owner: true };
  const rows = await sql<{ order_id: string; created_at: string }>`
    select order_id, created_at from checkout_claims
    where user_id = ${userId} and idempotency_key = ${key}
  `;
  const row = rows[0];
  if (!row) return claimCheckout(userId, key, orderId);
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > HOLD_MS) {
    await sql`
      delete from checkout_claims
      where user_id = ${userId} and idempotency_key = ${key} and order_id = ${row.order_id}
    `;
    return claimCheckout(userId, key, orderId);
  }
  return { owner: false, replay: await readReplay(userId, row.order_id) };
}

export async function releaseCheckout(userId: string, key: string, orderId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    delete from checkout_claims
    where user_id = ${userId} and idempotency_key = ${key} and order_id = ${orderId}
  `;
}

export async function readReplay(userId: string, orderId: string): Promise<CheckoutReplay | null> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    total_cents: number;
    checkout_url: string | null;
    status: string;
    payment_provider: string;
  }>`
    select id, total_cents, checkout_url, status, payment_provider
    from orders where id = ${orderId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row || row.status !== "awaiting_payment") return null;
  const totalCents = Number(row.total_cents);
  // Payment, not printing, decides the replay: Stripe test cards print in sandbox but pay on Stripe.
  if (row.payment_provider === "sandbox") return { mode: "sandbox", orderId: row.id, totalCents };
  if (!row.checkout_url) return null;
  return { mode: "stripe", orderId: row.id, totalCents, url: row.checkout_url };
}

/** The other tab is still talking to the printer. Wait until its order is readable. */
export async function waitForReplay(userId: string, key: string): Promise<CheckoutReplay | null> {
  const sql = await getSql();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const rows = await sql<{ order_id: string }>`
      select order_id from checkout_claims
      where user_id = ${userId} and idempotency_key = ${key}
    `;
    const orderId = rows[0]?.order_id;
    if (orderId) {
      const replay = await readReplay(userId, orderId);
      if (replay) return replay;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return null;
}
