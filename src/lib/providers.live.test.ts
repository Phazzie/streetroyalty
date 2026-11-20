import { afterAll, describe, expect, it } from "vitest";
import { completeText } from "./ai/grok.server.ts";
import { createCheckoutSession } from "./payments/stripe.ts";
import { createPrintfulProvider } from "./pod/printful.ts";
import { XAI_KEYS } from "../test/fixtures/xai.ts";

/**
 * Real calls to the real services, to catch them changing under us. This is the
 * only place the mocked payloads in src/test/fixtures are checked against
 * reality. It runs only with LIVE=1 (`npm run test:live`), never on a pull
 * request, and each service is skipped when its key is not set.
 *
 * What it costs: one 16-token xAI completion, a fraction of a cent. Everything
 * else is a free read or a Stripe test-mode object. The counter below fails the
 * run if a change ever makes it spend more.
 */

const MOST_PAID_CALLS = 3;
let paidCalls = 0;

const env = (name: string) => process.env[name]?.trim() || "";
const realFetch = globalThis.fetch;

/** Count anything sent to a host that bills per request. */
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.host === "api.x.ai" && (init?.method ?? "GET") === "POST") paidCalls += 1;
  return realFetch(input, init);
}) as typeof fetch;

afterAll(() => {
  globalThis.fetch = realFetch;
  expect(paidCalls, "paid calls made by the live run").toBeLessThanOrEqual(MOST_PAID_CALLS);
});

function hasKeys(value: unknown, keys: string[]): void {
  expect(value).toBeTypeOf("object");
  for (const key of keys) expect(value, `missing "${key}"`).toHaveProperty(key);
}

describe.skipIf(!env("XAI_API_KEY"))("xAI", () => {
  it("still answers a chat completion in the shape the app reads", async () => {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env("XAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 16,
        temperature: 0,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as { choices: unknown[] };
    hasKeys(body, XAI_KEYS.chat);
    hasKeys(body.choices[0], XAI_KEYS.chatChoice);
  });

  it.skipIf(env("LIVE_TEXT_TWICE") !== "1")(
    "returns text through the app's own client",
    async () => {
      expect(await completeText("Reply with the single word: ok", 16)).toBeTruthy();
    },
  );
});

// A live key would create a real, payable session. Only a test key is ever used here.
describe.skipIf(!env("STRIPE_SECRET_KEY").startsWith("sk_test_"))("Stripe, test mode", () => {
  it("still creates a Checkout session from the app's request", async () => {
    const session = await createCheckoutSession(
      {
        orderId: `live-check-${Date.now()}`,
        currency: "USD",
        lines: [{ name: "Contract check", quantity: 1, unitAmountCents: 100 }],
        successUrl: "https://example.com/orders?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://example.com/checkout?canceled=1",
      },
      { secretKey: env("STRIPE_SECRET_KEY") },
    );
    expect(session.id).toMatch(/^cs_test_/);
    expect(session.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});

describe.skipIf(!env("PRINTFUL_API_KEY"))("Printful", () => {
  it("still lists the catalog and prices a product the way the app reads them", async () => {
    const provider = createPrintfulProvider({
      apiKey: env("PRINTFUL_API_KEY"),
      storeId: env("PRINTFUL_STORE_ID") || undefined,
    });
    const page = await provider.listProducts({ limit: 1, offset: 0 });
    expect(page.products).toHaveLength(1);
    const product = await provider.getProduct(page.products[0]?.id ?? "");
    expect(product.variants.length).toBeGreaterThan(0);
    expect(product.variants.some((variant) => variant.printAreas.length > 0)).toBe(true);
  });
});
