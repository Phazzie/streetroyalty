import { formatMoney } from "../pod/money.ts";

/** What an order email needs to say. */
export type OrderMail = {
  orderId: string;
  name: string;
  items: { title: string; size: string; quantity: number }[];
  totalCents: number;
  currency: string;
  sandbox: boolean;
  trackingUrl?: string | null;
  trackingNumber?: string | null;
  /** Public https origin of the shop, for links. */
  origin: string;
};

export type Rendered = { subject: string; text: string; html: string };

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Plain, dark, one column. Renders in every mail app, including the ones that strip styles. */
function page(lines: { heading: string; body: string[]; button?: { label: string; href: string } }) {
  const body = lines.body.map((line) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${line}</p>`).join("");
  const button = lines.button
    ? `<p style="margin:22px 0"><a href="${escape(lines.button.href)}" style="display:inline-block;background:#d6ff3c;color:#14081c;font-weight:700;text-decoration:none;padding:12px 20px;text-transform:uppercase;letter-spacing:.08em;font-size:13px">${escape(lines.button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0b0614;color:#f6f1ff;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 22px">
<p style="margin:0 0 26px;font-weight:900;font-style:italic;letter-spacing:.04em;text-transform:uppercase;color:#d6ff3c">&#9813; Street Royalty</p>
<h1 style="margin:0 0 18px;font-size:30px;line-height:1.05;font-style:italic;text-transform:uppercase">${escape(lines.heading)}</h1>
${body}${button}
<p style="margin:28px 0 0;font-size:13px;color:#b7a8d4">Reply to this email if something's wrong. A person reads it.</p>
</div></body></html>`;
}

function itemLines(mail: OrderMail): string[] {
  return mail.items.map((item) => `${item.quantity} × ${item.title} (${item.size})`);
}

function tag(mail: OrderMail): string {
  return mail.sandbox ? "[Test] " : "";
}

export function placedEmail(mail: OrderMail): Rendered {
  const items = itemLines(mail);
  const total = formatMoney(mail.totalCents, mail.currency);
  const ordersUrl = mail.origin ? `${mail.origin}/orders` : "";
  const intro = mail.sandbox
    ? "This was a test order. Nothing was charged and nothing will be printed."
    : "We've got your order and it's going to print. Printing takes about 2 to 7 business days, then it ships.";
  return {
    subject: `${tag(mail)}Order ${shortId(mail.orderId)} is in`,
    text: [
      `Hey ${firstName(mail.name)},`,
      "",
      intro,
      "",
      ...items,
      `Total: ${total}`,
      "",
      ordersUrl ? `We'll email again when it ships. Your orders: ${ordersUrl}` : "We'll email again when it ships.",
      "",
      "Street Royalty",
    ].join("\n"),
    html: page({
      heading: "Your order is in.",
      body: [
        `Hey ${escape(firstName(mail.name))},`,
        escape(intro),
        items.map(escape).join("<br>"),
        `<strong>Total: ${escape(total)}</strong>`,
        "We'll email again when it ships.",
      ],
      button: ordersUrl ? { label: "See your order", href: ordersUrl } : undefined,
    }),
  };
}

export function shippedEmail(mail: OrderMail): Rendered {
  const items = itemLines(mail);
  const track = mail.trackingUrl || (mail.origin ? `${mail.origin}/orders` : "");
  const number = mail.trackingNumber ? `Tracking number: ${mail.trackingNumber}` : "";
  return {
    subject: `${tag(mail)}Order ${shortId(mail.orderId)} shipped`,
    text: [
      `Hey ${firstName(mail.name)},`,
      "",
      "Your piece is printed and on its way.",
      "",
      ...items,
      ...(number ? ["", number] : []),
      ...(track ? [`Track it: ${track}`] : []),
      "",
      "Street Royalty",
    ].join("\n"),
    html: page({
      heading: "It shipped.",
      body: [
        `Hey ${escape(firstName(mail.name))},`,
        "Your piece is printed and on its way.",
        items.map(escape).join("<br>"),
        ...(number ? [escape(number)] : []),
      ],
      button: track ? { label: "Track it", href: track } : undefined,
    }),
  };
}
