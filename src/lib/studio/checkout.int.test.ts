import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { sharedSandboxOrders } from "../pod/sandbox.ts";
import { addToCart, listCart } from "./cart.server.ts";
import {
  completeSandboxPayment,
  connectWebhooks,
  listOrders,
  readStudioAccess,
  receivePrintfulWebhook,
  receiveStripeWebhook,
  retryFulfillment,
  startCheckout,
  syncStripeReturn,
} from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { seenTo } from "../../test/msw/server.ts";
import { RECIPIENT, TEE, seedCart, seedDesign, seedUser } from "../../test/seed.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../../test/webhooks.ts";

const TEE_PRICE = 3069;
const STANDARD = { recipient: RECIPIENT, shippingMethod: "STANDARD" };

async function orderRow(orderId: string) {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from orders where id = ${orderId}`;
  return rows[0];
}

async function orderCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*) as n from orders`;
  return rows[0]?.n ?? 0;
}

beforeEach(truncateAll);

describe("starting checkout", () => {
  it("creates an unpaid order and a draft at the printer, and charges nothing", async () => {
    await seedCart("ada", 2);
    const started = await startCheckout("ada", STANDARD);

    expect(started).toMatchObject({ mode: "sandbox", totalCents: TEE_PRICE * 2 + 845 });
    const row = await orderRow(started.orderId);
    expect(row).toMatchObject({
      user_id: "ada",
      status: "awaiting_payment",
      payment_status: "unpaid",
      subtotal_cents: TEE_PRICE * 2,
      shipping_cents: 845,
      total_cents: TEE_PRICE * 2 + 845,
      shipping_method: "STANDARD",
      sandbox: true,
    });
    const draft = sharedSandboxOrders().get(String(row?.provider_order_id));
    expect(draft).toMatchObject({ externalId: started.orderId, status: "draft", confirmed: false });
    expect(seenTo("api.stripe.com")).toEqual([]);
  });

  it("totals the order from the catalog, whatever price sits on the stored design", async () => {
    const design = await seedCart("ada");
    const sql = await getSql();
    await sql`update designs set retail_cents = 1 where id = ${design.id}`;
    const started = await startCheckout("ada", STANDARD);
    expect(started.totalCents).toBe(TEE_PRICE + 595);
  });

  it("leaves the cart alone until the order is paid", async () => {
    await seedCart("ada");
    await startCheckout("ada", STANDARD);
    expect(await listCart("ada")).toHaveLength(1);
  });

  it("refuses a shipping method that was not in the quote", async () => {
    await seedCart("ada");
    await expect(
      startCheckout("ada", { recipient: RECIPIENT, shippingMethod: "FREE" }),
    ).rejects.toThrow(/shipping method/);
    expect(await orderCount()).toBe(0);
    expect(sharedSandboxOrders().size).toBe(0);
  });

  it("refuses an empty cart", async () => {
    await seedUser("ada");
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/empty/);
  });

  it.each([
    ["no name", { name: "" }, /name/],
    ["no street", { address1: "" }, /street/],
    ["a country that is not two letters", { countryCode: "USA" }, /country/],
    ["no state in the US", { stateCode: "" }, /state/],
    ["no email", { email: "" }, /email/],
    ["a broken email", { email: "ada@" }, /email/],
  ])("refuses an address with %s before any order exists", async (_what, change, message) => {
    await seedCart("ada");
    await expect(
      startCheckout("ada", { recipient: { ...RECIPIENT, ...change }, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(message);
    expect(await orderCount()).toBe(0);
  });

  it("refuses a live Printful draft while payments are sandboxed, before creating anything", async () => {
    await seedCart("ada");
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test_x";
    process.env.PAYMENTS_MODE = "sandbox";
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/Sandbox payment/);
    expect(await orderCount()).toBe(0);
    expect(seenTo("api.printful.com")).toEqual([]);
    expect(seenTo("api.stripe.com")).toEqual([]);
  });

  it("refuses a live printer when payments were never switched on", async () => {
    await seedCart("ada");
    process.env.PRINTFUL_API_KEY = "pf_test_x";
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/Sandbox payment/);
    expect(await orderCount()).toBe(0);
    expect(seenTo("api.printful.com")).toEqual([]);
  });

  it("refuses to take live payments while printing is sandboxed, before creating anything", async () => {
    await seedCart("ada");
    process.env.PAYMENTS_MODE = "live";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/sandboxed/);
    expect(await orderCount()).toBe(0);
    expect(seenTo("api.stripe.com")).toEqual([]);
  });

  it("stores what was bought, so the right cart lines can be cleared later", async () => {
    const design = await seedCart("ada");
    const started = await startCheckout("ada", STANDARD);
    const items = JSON.parse(String((await orderRow(started.orderId))?.items_json));
    expect(items).toEqual([
      expect.objectContaining({
        designId: design.id,
        variantId: TEE.variantId,
        quantity: 1,
        unitCents: TEE_PRICE,
      }),
    ]);
  });
});

describe("paying in sandbox", () => {
  it("sends the order to print and empties the cart of what was bought", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    expect(await completeSandboxPayment("ada", orderId)).toEqual({ orderId, status: "submitted" });

    const row = await orderRow(orderId);
    expect(row).toMatchObject({ status: "submitted", payment_status: "paid" });
    expect(sharedSandboxOrders().get(String(row?.provider_order_id))?.confirmed).toBe(true);
    expect(await listCart("ada")).toEqual([]);
  });

  it("keeps a piece that was added to the cart after checkout began", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    const later = await seedDesign("ada", { title: "Second Piece" });
    await addToCart("ada", later.id, TEE.variantId);

    await completeSandboxPayment("ada", orderId);

    expect((await listCart("ada")).map((line) => line.designId)).toEqual([later.id]);
  });

  it("refuses to pay for someone else's order", async () => {
    await seedCart("ada");
    await seedUser("bo");
    const { orderId } = await startCheckout("ada", STANDARD);
    await expect(completeSandboxPayment("bo", orderId)).rejects.toThrow(/not found/);
    expect((await orderRow(orderId))?.status).toBe("awaiting_payment");
  });

  it("is switched off when payments are live", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    await expect(completeSandboxPayment("ada", orderId)).rejects.toThrow(/Sandbox payment is off/);
    expect((await orderRow(orderId))?.status).toBe("awaiting_payment");
  });

  it("is a no-op the second time", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    await completeSandboxPayment("ada", orderId);
    await completeSandboxPayment("ada", orderId);
    expect((await orderRow(orderId))?.status).toBe("submitted");
  });
});

describe("the webhooks, end to end through the database", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
    process.env.PRINTFUL_WEBHOOK_SECRET = PRINTFUL_WEBHOOK_SECRET;
  });

  it("refuses everything until a secret is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PRINTFUL_WEBHOOK_SECRET;
    expect((await receiveStripeWebhook("{}", "t=1,v1=00")).status).toBe(503);
    expect((await receivePrintfulWebhook("{}", "00")).status).toBe(503);
  });

  it("prints on a paid Stripe event, clears the cart, and ignores the replay", async () => {
    await seedCart("ada");
    const { orderId, totalCents } = await startCheckout("ada", STANDARD);
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: totalCents });

    expect((await receiveStripeWebhook(paid.raw, paid.signature)).body).toEqual({
      ok: true,
      action: "confirmed",
    });
    expect((await orderRow(orderId))?.status).toBe("submitted");
    expect(await listCart("ada")).toEqual([]);
    expect((await receiveStripeWebhook(paid.raw, paid.signature)).body).toEqual({
      duplicate: true,
    });
  });

  it("holds the order and keeps the cart when Stripe captured the wrong amount", async () => {
    await seedCart("ada");
    const { orderId, totalCents } = await startCheckout("ada", STANDARD);
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: totalCents - 100 });

    await receiveStripeWebhook(paid.raw, paid.signature);

    const row = await orderRow(orderId);
    expect(row).toMatchObject({ status: "needs_review", payment_status: "paid" });
    expect(String(row?.failure_reason)).toMatch(/Refund/);
    expect(sharedSandboxOrders().get(String(row?.provider_order_id))?.confirmed).toBe(false);
    expect(await listCart("ada")).toHaveLength(1);
  });

  it("rejects an unsigned event and changes nothing", async () => {
    await seedCart("ada");
    const { orderId, totalCents } = await startCheckout("ada", STANDARD);
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: totalCents });
    expect((await receiveStripeWebhook(paid.raw, null)).status).toBe(401);
    expect((await receiveStripeWebhook(paid.raw, "t=1,v1=deadbeef")).status).toBe(401);
    expect((await orderRow(orderId))?.status).toBe("awaiting_payment");
  });

  it("records tracking from the printer and shows it on the buyer's order", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    await completeSandboxPayment("ada", orderId);
    const providerOrderId = String((await orderRow(orderId))?.provider_order_id);
    const shipped = printfulEvent({
      type: "shipment_sent",
      orderId,
      providerOrderId,
      trackingNumber: "1Z999",
    });

    expect((await receivePrintfulWebhook(shipped.raw, shipped.signature)).status).toBe(200);

    const [order] = await listOrders("ada");
    expect(order).toMatchObject({
      status: "shipped",
      trackingNumber: "1Z999",
      paymentStatus: "paid",
    });
  });
});

describe("retrying a failed print", () => {
  async function failedPaidOrder() {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    const sql = await getSql();
    await sql`update orders set status = 'failed', payment_status = 'paid' where id = ${orderId}`;
    return orderId;
  }

  it("sends a paid, failed order to print again", async () => {
    const orderId = await failedPaidOrder();
    expect(await retryFulfillment("ada", orderId)).toEqual({ orderId, status: "submitted" });
    expect(await orderRow(orderId)).toMatchObject({ status: "submitted", failure_reason: null });
  });

  it("refuses an order that was never paid", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", STANDARD);
    await expect(retryFulfillment("ada", orderId)).rejects.toThrow(/not waiting on a print retry/);
    const draft = sharedSandboxOrders().get(String((await orderRow(orderId))?.provider_order_id));
    expect(draft?.confirmed).toBe(false);
  });

  it("refuses someone else's order", async () => {
    const orderId = await failedPaidOrder();
    await seedUser("bo");
    await expect(retryFulfillment("bo", orderId)).rejects.toThrow(/not found/);
    expect((await orderRow(orderId))?.status).toBe("failed");
  });
});

describe("coming back from Stripe", () => {
  it("is refused while payments are in sandbox", async () => {
    await seedUser("ada");
    await expect(syncStripeReturn("ada", "cs_test_1")).rejects.toThrow(/not configured/);
    expect(seenTo("api.stripe.com")).toEqual([]);
  });
});

describe("orders", () => {
  it("lists only the signed-in person's orders, newest first", async () => {
    await seedCart("ada");
    const first = await startCheckout("ada", STANDARD);
    await seedCart("bo");
    await startCheckout("bo", STANDARD);

    const mine = await listOrders("ada");
    expect(mine.map((order) => order.id)).toEqual([first.orderId]);
    expect(mine[0]).toMatchObject({ totalCents: TEE_PRICE + 595, sandbox: true });
    expect(await listOrders("nobody")).toEqual([]);
  });
});

describe("store admin", () => {
  it("is only the emails on the allow list", async () => {
    await seedUser("ada", "ada@example.com");
    await seedUser("bo", "bo@example.com");
    process.env.STUDIO_ADMIN_EMAILS = " Ada@Example.com ";
    expect(await readStudioAccess("ada")).toEqual({ admin: true });
    expect(await readStudioAccess("bo")).toEqual({ admin: false });
    expect(await readStudioAccess("ghost")).toEqual({ admin: false });
  });

  it("is nobody when the allow list is empty", async () => {
    await seedUser("ada", "ada@example.com");
    expect(await readStudioAccess("ada")).toEqual({ admin: false });
  });

  it("keeps everyone else away from the shared Printful webhook", async () => {
    await seedUser("ada", "ada@example.com");
    await seedUser("bo", "bo@example.com");
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
    await expect(connectWebhooks("bo")).rejects.toThrow(/Only a store admin/);
    await expect(connectWebhooks("ada")).resolves.toMatchObject({
      mode: "sandbox",
      url: "https://streetroyalty.test/api/webhooks/printful",
    });
  });
});
