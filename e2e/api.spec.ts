import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * The endpoints outside services call, over real HTTP against the built app.
 * The secrets are the ones playwright.config.ts gives the preview server, so
 * these only run there and not against a deployment.
 */

test.skip(Boolean(process.env.E2E_BASE_URL), "needs the preview server's test secrets");

const STRIPE_SECRET = "whsec_e2e";
const PRINTFUL_SECRET = "printful-e2e";

function stripeSignature(body: string, secret = STRIPE_SECRET): string {
  const at = Math.floor(Date.now() / 1000);
  const hex = createHmac("sha256", secret).update(`${at}.${body}`, "utf8").digest("hex");
  return `t=${at},v1=${hex}`;
}

const printfulSignature = (body: string, secret = PRINTFUL_SECRET) =>
  createHmac("sha256", Buffer.from(secret, "utf8")).update(body, "utf8").digest("hex");

test.describe("POST /api/webhooks/stripe", () => {
  const body = JSON.stringify({
    id: `evt_e2e_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "paid",
        amount_total: 1000,
        metadata: { order_id: "no-such-order" },
      },
    },
  });

  test("turns away a request with no signature", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", { data: body });
    expect(response.status()).toBe(401);
  });

  test("turns away a request signed with the wrong secret", async ({ request }) => {
    const response = await request.post("/api/webhooks/stripe", {
      data: body,
      headers: {
        "stripe-signature": stripeSignature(body, "whsec_wrong"),
        "content-type": "application/json",
      },
    });
    expect(response.status()).toBe(401);
  });

  test("accepts a correctly signed event, and reports an unknown order without printing anything", async ({
    request,
  }) => {
    const headers = {
      "stripe-signature": stripeSignature(body),
      "content-type": "application/json",
    };
    const first = await request.post("/api/webhooks/stripe", { data: body, headers });
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ ok: false, reason: "not_found" });

    const replay = await request.post("/api/webhooks/stripe", { data: body, headers });
    expect(await replay.json()).toEqual({ duplicate: true });
  });
});

test.describe("POST /api/webhooks/printful", () => {
  const body = JSON.stringify({
    type: "shipment_sent",
    occurred_at: new Date().toISOString(),
    data: { order: { id: "pf-none", external_id: "no-such-order" } },
  });

  test("turns away an unsigned notice", async ({ request }) => {
    expect((await request.post("/api/webhooks/printful", { data: body })).status()).toBe(401);
  });

  test("accepts a signed notice about an order it does not know", async ({ request }) => {
    const response = await request.post("/api/webhooks/printful", {
      data: body,
      headers: {
        "x-pf-webhook-signature": printfulSignature(body),
        "content-type": "application/json",
      },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ignored: true });
  });
});

test.describe("GET /api/print-files/:id", () => {
  for (const [what, path] of [
    ["no token", "/api/print-files/00000000-0000-4000-8000-000000000000"],
    ["a made-up token", "/api/print-files/00000000-0000-4000-8000-000000000000?token=abc"],
    ["an id that is not an id", "/api/print-files/..%2F..%2Fetc%2Fpasswd?token=abc"],
  ]) {
    test(`answers 404 with ${what}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(response.headers()["cache-control"] ?? "").not.toContain("immutable");
    });
  }
});

test.describe("sign-in over HTTP", () => {
  test("refuses a sign-up posted from another site", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: {
        email: `evil-${Date.now()}@example.com`,
        password: "correct horse battery",
        name: "x",
      },
      headers: { origin: "https://evil.example", "content-type": "application/json" },
    });
    expect(response.status()).toBe(403);
  });

  test("says who is signed in as nobody for a request with no session", async ({ request }) => {
    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
  });
});
