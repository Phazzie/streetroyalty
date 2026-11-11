import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCheckoutSession, parseStripeEvent, signStripeBody, verifyStripeSignature } from "./stripe.ts";

describe("stripe checkout", () => {
  it("creates a payment session tagged with the order id", async () => {
    let sent = "";
    const fetchImpl: typeof fetch = async (_input, init) => {
      sent = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test" }), { status: 200 });
    };
    const session = await createCheckoutSession(
      {
        orderId: "ord-9",
        currency: "USD",
        successUrl: "https://shop.example/orders?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://shop.example/checkout",
        customerEmail: "ada@example.com",
        lines: [{ name: "Night Tee", quantity: 1, unitAmountCents: 3200 }],
      },
      { secretKey: "sk_test", fetchImpl },
    );
    assert.equal(session.id, "cs_test");
    assert.match(sent, /metadata%5Border_id%5D=ord-9/);
    assert.match(sent, /unit_amount%5D=3200/);
    assert.match(sent, /mode=payment/);
    assert.match(sent, /\{CHECKOUT_SESSION_ID\}/);
  });

  it("verifies the signature and rejects stale or tampered bodies", () => {
    const body = "{\"id\":\"evt_1\"}";
    const now = 1_700_000_000_000;
    const header = signStripeBody(body, "whsec_test", now / 1000);
    assert.equal(verifyStripeSignature(body, header, "whsec_test", now), true);
    assert.equal(verifyStripeSignature(`${body} `, header, "whsec_test", now), false);
    assert.equal(verifyStripeSignature(body, header, "whsec_test", now + 600_000), false);
    const parsed = parseStripeEvent(
      JSON.stringify({
        id: "evt_1",
        type: "checkout.session.completed",
        data: { object: { payment_status: "paid", amount_total: 1800, metadata: { order_id: "ord-9" } } },
      }),
    );
    assert.equal(parsed.paid, true);
    assert.equal(parsed.orderId, "ord-9");
    assert.equal(parsed.amountCents, 1800);
  });
});
