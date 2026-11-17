import { beforeEach, describe, expect, it } from "vitest";
import { printFileToken, SANDBOX_PRINT_SECRET } from "@/lib/pod/print-access.ts";
import { completeSandboxPayment, startCheckout } from "@/lib/studio/orders.server.ts";
import { getSql } from "@/lib/db.ts";
import { Route as printFileRoute } from "@/routes/api/print-files/$id.ts";
import { Route as printfulRoute } from "@/routes/api/webhooks/printful.ts";
import { Route as stripeRoute } from "@/routes/api/webhooks/stripe.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, seedCart, seedDesign, seedUser } from "../../test/seed.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../../test/webhooks.ts";

/**
 * The three endpoints that outside services call. These go through the route
 * handlers themselves, so the header names, raw-body handling and status codes
 * are the ones Stripe, Printful and a browser will meet.
 */

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Promise<Response>;

function handler(route: unknown, method: "GET" | "POST"): Handler {
  const handlers = (route as { options: { server?: { handlers?: Record<string, Handler> } } })
    .options.server?.handlers;
  const found = handlers?.[method];
  if (!found) throw new Error(`Route has no ${method} handler.`);
  return found;
}

const post = (route: unknown, body: string, headers: Record<string, string>) =>
  handler(
    route,
    "POST",
  )({
    request: new Request("https://streetroyalty.test/hook", { method: "POST", body, headers }),
    params: {},
  });

const getFile = (id: string, token?: string) =>
  handler(
    printFileRoute,
    "GET",
  )({
    request: new Request(
      `https://streetroyalty.test/api/print-files/${id}${token === undefined ? "" : `?token=${token}`}`,
    ),
    params: { id },
  });

beforeEach(async () => {
  await truncateAll();
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  process.env.PRINTFUL_WEBHOOK_SECRET = PRINTFUL_WEBHOOK_SECRET;
});

describe("POST /api/webhooks/stripe", () => {
  it("prints the order when Stripe says it was paid", async () => {
    await seedCart("ada");
    const { orderId, totalCents } = await startCheckout("ada", {
      recipient: RECIPIENT,
      shippingMethod: "STANDARD",
    });
    const paid = stripeEvent({ id: "evt_1", orderId, amountCents: totalCents });

    const response = await post(stripeRoute, paid.raw, { "stripe-signature": paid.signature });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, action: "confirmed" });
    const sql = await getSql();
    const rows = await sql<{ status: string }>`select status from orders where id = ${orderId}`;
    expect(rows[0]?.status).toBe("submitted");
  });

  it("answers 401 without the signature header, or with it under the wrong name", async () => {
    const paid = stripeEvent({ id: "evt_1", orderId: "x", amountCents: 1 });
    expect((await post(stripeRoute, paid.raw, {})).status).toBe(401);
    expect((await post(stripeRoute, paid.raw, { "x-signature": paid.signature })).status).toBe(401);
  });

  it("answers 401 when the body was re-serialized on the way in", async () => {
    const paid = stripeEvent({ id: "evt_1", orderId: "x", amountCents: 1 });
    const pretty = JSON.stringify(JSON.parse(paid.raw), null, 2);
    expect((await post(stripeRoute, pretty, { "stripe-signature": paid.signature })).status).toBe(
      401,
    );
  });

  it("answers 503 when the secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post(stripeRoute, "{}", { "stripe-signature": "t=1,v1=00" })).status).toBe(503);
  });
});

describe("POST /api/webhooks/printful", () => {
  it("moves a printed order to shipped", async () => {
    await seedCart("ada");
    const { orderId } = await startCheckout("ada", {
      recipient: RECIPIENT,
      shippingMethod: "STANDARD",
    });
    await completeSandboxPayment("ada", orderId);
    const sql = await getSql();
    const [row] = await sql<{
      provider_order_id: string;
    }>`select provider_order_id from orders where id = ${orderId}`;
    const shipped = printfulEvent({
      type: "shipment_sent",
      orderId,
      providerOrderId: row?.provider_order_id ?? "",
      trackingNumber: "1Z1",
    });

    const response = await post(printfulRoute, shipped.raw, {
      "x-pf-webhook-signature": shipped.signature,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, orderId, status: "shipped" });
  });

  it("answers 401 to an unsigned notice", async () => {
    const shipped = printfulEvent({ type: "shipment_sent", orderId: "x", providerOrderId: "y" });
    expect((await post(printfulRoute, shipped.raw, {})).status).toBe(401);
  });
});

describe("GET /api/print-files/:id", () => {
  async function savedFile() {
    await seedUser("ada");
    const design = await seedDesign("ada");
    const id = design.printFileId ?? "";
    return { id, token: printFileToken(id, SANDBOX_PRINT_SECRET) };
  }

  it("serves the PNG to a caller with the right token", async () => {
    const { id, token } = await savedFile();
    const response = await getFile(id, token);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.toString("base64")).toBe(pngDataUrl(1800, 2400).split(",")[1]);
  });

  it.each([
    ["no token", undefined],
    ["an empty token", ""],
    [
      "a token for another file",
      printFileToken("00000000-0000-4000-8000-000000000000", SANDBOX_PRINT_SECRET),
    ],
  ])("answers 404 with %s, the same as for a file that does not exist", async (_what, token) => {
    const { id } = await savedFile();
    const refused = await getFile(id, token);
    const missing = await getFile("00000000-0000-4000-8000-000000000000", "anything");
    expect(refused.status).toBe(404);
    expect(await refused.text()).toBe(await missing.text());
  });

  it("answers 404 for a valid token on a file that was never saved", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await getFile(id, printFileToken(id, SANDBOX_PRINT_SECRET))).status).toBe(404);
  });
});
