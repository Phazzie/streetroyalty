import type { Sql } from "../db.ts";
import { shopEmail } from "../help/contact.ts";
import { origin } from "../studio/shared.server.ts";
import { placedEmail, shippedEmail, type OrderMail } from "./order-emails.ts";
import { sendEmail, type SendResult } from "./send.server.ts";

export type OrderMailKind = "placed" | "shipped";

type Row = {
  id: string;
  recipient_json: string;
  items_json: string;
  total_cents: number;
  currency: string;
  sandbox: boolean | string;
  tracking_url: string | null;
  tracking_number: string | null;
};

function readMail(row: Row): (OrderMail & { to: string }) | null {
  let recipient: { name?: unknown; email?: unknown } = {};
  let items: unknown = [];
  try {
    recipient = JSON.parse(row.recipient_json) as typeof recipient;
    items = JSON.parse(row.items_json);
  } catch {
    return null;
  }
  const to = String(recipient.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  let site = "";
  try {
    site = origin();
  } catch {
    site = "";
  }
  return {
    to,
    orderId: row.id,
    name: String(recipient.name ?? ""),
    items: (Array.isArray(items) ? items : []).map((item: Record<string, unknown>) => ({
      title: String(item?.title ?? "Piece"),
      size: String(item?.variantLabel ?? ""),
      quantity: Number(item?.quantity ?? 1),
    })),
    totalCents: Number(row.total_cents),
    currency: String(row.currency || "USD"),
    sandbox: row.sandbox === true || row.sandbox === "t" || row.sandbox === "true",
    trackingUrl: row.tracking_url,
    trackingNumber: row.tracking_number,
    origin: site,
  };
}

/**
 * Sends an order's "it's in" or "it shipped" email, once. The order is marked
 * first, in one statement, so two webhooks arriving together send one email.
 * Nothing here throws: a missing email never stops an order.
 */
export async function sendOrderMail(
  sql: Sql,
  orderId: string,
  kind: OrderMailKind,
  send: typeof sendEmail = sendEmail,
): Promise<SendResult | { sent: false; reason: string }> {
  try {
    const rows =
      kind === "placed"
        ? await sql<Row>`
            update orders set emailed_placed_at = now()
            where id = ${orderId} and emailed_placed_at is null
              and status in ('submitted', 'shipped', 'delivered')
            returning id, recipient_json, items_json, total_cents, currency, sandbox, tracking_url, tracking_number
          `
        : await sql<Row>`
            update orders set emailed_shipped_at = now()
            where id = ${orderId} and emailed_shipped_at is null
              and status in ('shipped', 'delivered')
            returning id, recipient_json, items_json, total_cents, currency, sandbox, tracking_url, tracking_number
          `;
    const row = rows[0];
    if (!row) return { sent: false, reason: "not_due" };
    const mail = readMail(row);
    if (!mail) return { sent: false, reason: "no_address" };
    const rendered = kind === "placed" ? placedEmail(mail) : shippedEmail(mail);
    const result = await send({ to: mail.to, ...rendered, replyTo: shopEmail() });
    if (!result.sent && result.reason !== "not_configured") {
      console.warn(`[email] ${kind} email for ${orderId} did not send: ${result.reason}`);
    }
    return result;
  } catch (error) {
    console.warn(`[email] ${kind} email for ${orderId} failed:`, error);
    return { sent: false, reason: "error" };
  }
}
