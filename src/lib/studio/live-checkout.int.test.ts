import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { addToCart, listCart } from "./cart.server.ts";
import { generateMockup, publishDesign } from "./designs.server.ts";
import {
  connectWebhooks,
  receiveStripeWebhook,
  startCheckout,
  syncStripeReturn,
} from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { PRINTFUL_TEE, fakePrintful } from "../../test/msw/printful.ts";
import { seenTo, server } from "../../test/msw/server.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, seedDesign, seedUser } from "../../test/seed.ts";
import { STRIPE_WEBHOOK_SECRET, stripeEvent } from "../../test/webhooks.ts";

/**
 * Live mode: a real card and a real factory. Stripe and Printful are stood in
 * for at the network, so every request the app would send to either is real,
 * and the tests can count the ones that cost money.
 */

const STRIPE = "https://api.stripe.com/v1/checkout/sessions";
const STANDARD = { recipient: RECIPIENT, shippingMethod: "STANDARD" };
// 13.95 wholesale at the default 2.2 markup, plus 4.75 shipping.
const TEE = 3069;
const TOTAL = TEE + 475;

let printful: ReturnType<typeof fakePrintful>;

function stripeCheckout(session: Record<string, unknown> = {}) {
  server.use(
    http.post(STRIPE, () =>
      HttpResponse.json({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
        ...session,
      }),
    ),
  );
}

function stripeSession(session: Record<string, unknown>) {
  server.use(http.get(`${STRIPE}/:id`, () => HttpResponse.json({ id: "cs_test_1", ...session })));
}

async function cartWithTee(userId = "ada") {
  await seedUser(userId, `${userId}@example.com`);
  const design = await seedDesign(userId, PRINTFUL_TEE);
  await addToCart(userId, design.id, PRINTFUL_TEE.variantId);
  return design;
}

async function order(orderId: string) {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from orders where id = ${orderId}`;
  return rows[0];
}

async function formBody(host: string): Promise<URLSearchParams> {
  const call = seenTo(host).find((entry) => entry.method === "POST");
  await vi.waitFor(() => expect(call?.body).not.toBe(""));
  return new URLSearchParams(call?.body ?? "");
}

beforeEach(async () => {
  await truncateAll();
  process.env.POD_MODE = "live";
  process.env.PRINTFUL_API_KEY = "pf_test_key";
  process.env.PAYMENTS_MODE = "live";
  process.env.STRIPE_SECRET_KEY = "sk_test_key";
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  process.env.PRINT_FILE_SIGNING_SECRET = "a-long-print-secret";
  process.env.APP_PUBLIC_URL = "https://streetroyalty.com";
  printful = fakePrintful();
});

describe("live checkout", () => {
  it("creates a Printful draft and a Stripe session for the same total, and confirms nothing", async () => {
    await cartWithTee();
    stripeCheckout();

    const started = await startCheckout("ada", STANDARD);

    expect(started).toMatchObject({
      mode: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
      totalCents: TOTAL,
    });
    expect(await order(started.orderId)).toMatchObject({
      status: "awaiting_payment",
      payment_status: "unpaid",
      payment_provider: "stripe",
      payment_session_id: "cs_test_1",
      total_cents: TOTAL,
      sandbox: false,
    });
    expect(printful.orders.size).toBe(1);
    expect(printful.confirms).toEqual([]);

    const sent = await formBody("api.stripe.com");
    expect(sent.get("mode")).toBe("payment");
    expect(sent.get("client_reference_id")).toBe(started.orderId);
    expect(sent.get("metadata[order_id]")).toBe(started.orderId);
    expect(sent.get("line_items[0][price_data][unit_amount]")).toBe(String(TEE));
    expect(sent.get("line_items[1][price_data][unit_amount]")).toBe("475");
    expect(sent.get("success_url")).toBe(
      "https://streetroyalty.com/orders?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(seenTo("api.stripe.com")[0]?.headers.get("authorization")).toBe("Bearer sk_test_key");
  });

  it("hands Printful a signed https link to the print file, at the public address", async () => {
    await cartWithTee();
    stripeCheckout();
    await startCheckout("ada", STANDARD);

    const draft = seenTo("api.printful.com").find(
      (call) => call.method === "POST" && call.url.endsWith("/v2/orders"),
    );
    await vi.waitFor(() => expect(draft?.body).not.toBe(""));
    const links = (draft?.body ?? "").match(
      /https:\/\/streetroyalty\.com\/api\/print-files\/[0-9a-f-]{36}\?token=[0-9a-f]{64}/g,
    );
    expect(links).toHaveLength(1);
    expect(draft?.headers.get("authorization")).toBe("Bearer pf_test_key");
  });

  it("cancels the Printful draft and the order when Stripe cannot start the session", async () => {
    await cartWithTee();
    server.use(
      http.post(STRIPE, () =>
        HttpResponse.json({ error: { message: "Invalid API Key" } }, { status: 401 }),
      ),
    );

    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/Invalid API Key/);

    const [draft] = [...printful.orders.values()];
    expect(draft?.status).toBe("canceled");
    const sql = await getSql();
    const rows = await sql<{ status: string }>`select status from orders`;
    expect(rows).toEqual([{ status: "canceled" }]);
  });

  it("creates no order and charges nothing when Printful refuses the draft", async () => {
    await cartWithTee();
    printful.refuseDrafts = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(startCheckout("ada", STANDARD)).rejects.toThrow();

    const sql = await getSql();
    expect(await sql`select id from orders where status <> 'canceled'`).toEqual([]);
    expect(seenTo("api.stripe.com")).toEqual([]);
  });

  it("refuses to check out when the Stripe key is missing, and cleans up the draft", async () => {
    await cartWithTee();
    delete process.env.STRIPE_SECRET_KEY;
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/STRIPE_SECRET_KEY/);
    expect([...printful.orders.values()].map((draft) => draft.status)).toEqual(["canceled"]);
  });

  it("opens one Printful draft and one Stripe session when two tabs start together", async () => {
    await cartWithTee();
    stripeCheckout();
    const [first, second] = await Promise.all([
      startCheckout("ada", STANDARD),
      startCheckout("ada", STANDARD),
    ]);
    expect(second).toEqual(first);
    expect(printful.orders.size).toBe(1);
    expect(seenTo("api.stripe.com").filter((call) => call.method === "POST")).toHaveLength(1);
    const again = await startCheckout("ada", STANDARD);
    expect(again).toEqual(first);
    expect(printful.orders.size).toBe(1);
    expect(seenTo("api.stripe.com").filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("refuses to check out from an address Printful cannot fetch the file from", async () => {
    await cartWithTee();
    process.env.APP_PUBLIC_URL = "http://192.168.1.20:8080";
    await expect(startCheckout("ada", STANDARD)).rejects.toThrow(/APP_PUBLIC_URL/);
    expect(printful.orders.size).toBe(0);
    expect(seenTo("api.stripe.com")).toEqual([]);
  });
});

describe("a live payment", () => {
  async function started() {
    await cartWithTee();
    stripeCheckout();
    return startCheckout("ada", STANDARD);
  }

  it("bills the Printful wallet once when the webhook says the card was charged", async () => {
    const { orderId } = await started();
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: TOTAL });

    const answer = await receiveStripeWebhook(paid.raw, paid.signature);

    expect(answer.body).toEqual({ ok: true, action: "confirmed" });
    expect(printful.confirms).toHaveLength(1);
    expect(await order(orderId)).toMatchObject({ status: "submitted", payment_status: "paid" });
    expect(await listCart("ada")).toEqual([]);
  });

  it("bills the wallet once when the webhook and the buyer's return arrive together", async () => {
    const { orderId } = await started();
    stripeSession({ payment_status: "paid", amount_total: TOTAL, metadata: { order_id: orderId } });
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: TOTAL });

    const [webhook, back] = await Promise.all([
      receiveStripeWebhook(paid.raw, paid.signature),
      syncStripeReturn("ada", "cs_test_1"),
    ]);

    // One of the two prints. The other is told the order is already in hand.
    expect([webhook.status === 200, back.ok]).toContain(true);
    expect([200, 503]).toContain(webhook.status);
    expect(printful.confirms).toHaveLength(1);
    expect((await order(orderId))?.status).toBe("submitted");
  });

  it("does not bill the wallet when the buyer comes back before the payment has cleared", async () => {
    const { orderId } = await started();
    stripeSession({
      payment_status: "unpaid",
      amount_total: TOTAL,
      metadata: { order_id: orderId },
    });

    expect(await syncStripeReturn("ada", "cs_test_1")).toEqual({ ok: false, reason: "unpaid" });

    expect(printful.confirms).toEqual([]);
    expect(await order(orderId)).toMatchObject({
      status: "awaiting_payment",
      payment_status: "unpaid",
    });
    expect(await listCart("ada")).toHaveLength(1);
  });

  it("holds the order for refund when Stripe captured a different amount", async () => {
    const { orderId } = await started();
    stripeSession({ payment_status: "paid", amount_total: 100, metadata: { order_id: orderId } });

    expect(await syncStripeReturn("ada", "cs_test_1")).toEqual({
      ok: false,
      reason: "amount_mismatch",
    });

    expect(printful.confirms).toEqual([]);
    expect(await order(orderId)).toMatchObject({ status: "needs_review", payment_status: "paid" });
  });

  it("will not confirm someone else's order from a session id", async () => {
    const { orderId } = await started();
    await seedUser("bo");
    stripeSession({ payment_status: "paid", amount_total: TOTAL, metadata: { order_id: orderId } });

    await expect(syncStripeReturn("bo", "cs_test_1")).rejects.toThrow(/not found/);

    expect(printful.confirms).toEqual([]);
  });

  it("refuses a session that is not tied to any order", async () => {
    await started();
    stripeSession({ payment_status: "paid", amount_total: TOTAL });
    await expect(syncStripeReturn("ada", "cs_test_1")).rejects.toThrow(/not tied to an order/);
  });

  it("passes on Stripe's own error when the session cannot be read", async () => {
    await started();
    server.use(
      http.get(`${STRIPE}/:id`, () =>
        HttpResponse.json({ error: { message: "No such checkout.session" } }, { status: 404 }),
      ),
    );
    await expect(syncStripeReturn("ada", "cs_missing")).rejects.toThrow(/No such checkout.session/);
  });

  it("treats a repeat confirm as done when Printful's record shows the order is already in", async () => {
    const { orderId } = await started();
    const [draft] = [...printful.orders.values()];
    if (draft) draft.status = "pending";
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: TOTAL });

    const answer = await receiveStripeWebhook(paid.raw, paid.signature);

    expect(answer.status).toBe(200);
    expect((await order(orderId))?.status).toBe("submitted");
  });
});

describe("going live with a design", () => {
  it("syncs the piece to the Printful store with its price and a signed file link", async () => {
    await seedUser("ada");
    const design = await seedDesign("ada", PRINTFUL_TEE);

    const published = await publishDesign("ada", design.id);

    expect(published.status).toBe("published");
    expect(printful.synced).toHaveLength(1);
    const sent = JSON.stringify(printful.synced[0]);
    expect(sent).toContain('"retail_price":"30.69"');
    expect(sent).toMatch(
      /https:\/\/streetroyalty\.com\/api\/print-files\/[0-9a-f-]{36}\?token=[0-9a-f]{64}/,
    );
  });

  it("registers the webhook at the public address, for an admin only", async () => {
    await seedUser("ada", "ada@example.com");
    await seedUser("bo", "bo@example.com");
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";

    await expect(connectWebhooks("bo")).rejects.toThrow(/Only a store admin/);
    expect(printful.webhooks).toEqual([]);

    const connected = await connectWebhooks("ada");
    expect(connected).toMatchObject({
      mode: "live",
      url: "https://streetroyalty.com/api/webhooks/printful",
      secretHex: "abcdef0123456789",
    });
    expect(JSON.stringify(printful.webhooks[0])).toContain(
      '"default_url":"https://streetroyalty.com/api/webhooks/printful"',
    );
  });
});

describe("a live mockup", () => {
  const request = {
    ...PRINTFUL_TEE,
    placement: "front",
    layers: [{ type: "text", text: "CROWN", x: 0.5, y: 0.5, scale: 1, rotation: 0 }],
  };

  it("stores the print file, hands Printful a signed link to it, and returns Printful's picture", async () => {
    await seedUser("ada");
    const mockup = await generateMockup({
      ...request,
      printFile: pngDataUrl(1800, 2400),
      userId: "ada",
    });

    expect(mockup).toEqual({ mockupUrl: "https://cdn.printful.test/m.jpg", status: "completed" });
    expect(printful.files).toHaveLength(1);
    expect(printful.files[0]).toMatch(
      /^https:\/\/streetroyalty\.com\/api\/print-files\/[0-9a-f-]{36}\?token=[0-9a-f]{64}$/,
    );
    const sql = await getSql();
    expect(await sql`select user_id from print_files`).toEqual([{ user_id: "ada" }]);
  });

  it.each([
    ["a visitor who is not signed in", { printFile: pngDataUrl(10, 10) }],
    ["a request with no print file", { userId: "ada" }],
  ])(
    "is refused for %s, and nothing is sent to Printful's file or mockup endpoints",
    async (_what, extra) => {
      await expect(generateMockup({ ...request, ...extra })).rejects.toThrow(/Sign in and export/);
      expect(printful.files).toEqual([]);
    },
  );

  it("is refused from an address Printful cannot reach", async () => {
    process.env.APP_PUBLIC_URL = "http://localhost:8080";
    await expect(
      generateMockup({ ...request, printFile: pngDataUrl(10, 10), userId: "ada" }),
    ).rejects.toThrow(/APP_PUBLIC_URL/);
    expect(printful.files).toEqual([]);
  });

  it("passes on Printful's reason when the mockup fails", async () => {
    printful.mockupFails = true;
    await expect(
      generateMockup({ ...request, printFile: pngDataUrl(10, 10), userId: "ada" }),
    ).rejects.toThrow(/File is too small/);
  });
});
