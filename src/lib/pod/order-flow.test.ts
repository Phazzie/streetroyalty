import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSandboxProvider } from "./sandbox.ts";
import { signPrintfulBody } from "./signature.ts";
import {
  assertFulfillmentAllowed,
  canTransition,
  decidePaymentFulfillment,
  fulfillPaidOrder,
  processPrintfulWebhook,
  processStripeWebhook,
  type FulfillmentOrder,
  type OrderStore,
} from "./order-flow.ts";
import { signStripeBody } from "../payments/stripe.ts";

function memoryStore(seed: FulfillmentOrder[]): OrderStore & { orders: Map<string, FulfillmentOrder>; events: string[] } {
  const orders = new Map(seed.map((order) => [order.id, { ...order }]));
  const events: string[] = [];
  return {
    orders,
    events,
    async getOrder(id) {
      const order = orders.get(id);
      return order ? { ...order } : null;
    },
    async findByExternalId(externalId) {
      const order = orders.get(externalId);
      return order ? { ...order } : null;
    },
    async findByProviderOrderId(providerOrderId) {
      const order = [...orders.values()].find((item) => item.providerOrderId === providerOrderId);
      return order ? { ...order } : null;
    },
    async markSubmitted(id, providerStatus) {
      const order = orders.get(id);
      if (!order) return;
      order.status = "submitted";
      order.paymentStatus = "paid";
      void providerStatus;
    },
    async applyProviderUpdate(id, patch) {
      const order = orders.get(id);
      if (!order) return;
      if (patch.status) order.status = patch.status;
    },
    async hasEvent(id) {
      return events.includes(id);
    },
    async recordEvent(id) {
      events.push(id);
    },
  };
}

const awaiting: FulfillmentOrder = {
  id: "ord-1",
  status: "awaiting_payment",
  paymentStatus: "unpaid",
  totalCents: 4000,
  providerOrderId: "sb-9",
};

describe("payment fulfillment", () => {
  it("refuses to confirm an unpaid or mismatched order", () => {
    assert.equal(decidePaymentFulfillment(awaiting, { paid: false }).ok, false);
    assert.equal(decidePaymentFulfillment(awaiting, { paid: true, amountCents: 10 }).ok, false);
    assert.equal(decidePaymentFulfillment(null, { paid: true }).ok, false);
    assert.equal(decidePaymentFulfillment({ ...awaiting, providerOrderId: null }, { paid: true, amountCents: 4000 }).ok, false);
  });

  it("ignores a second confirmation", () => {
    const decision = decidePaymentFulfillment({ ...awaiting, status: "submitted", paymentStatus: "paid" }, { paid: true, amountCents: 4000 });
    assert.equal(decision.ok && decision.action, "ignored");
  });

  it("blocks sandbox payment from confirming a live print order", () => {
    assert.throws(() => assertFulfillmentAllowed("live", "sandbox"), /Sandbox payment/);
    assert.doesNotThrow(() => assertFulfillmentAllowed("sandbox", "sandbox"));
    assert.doesNotThrow(() => assertFulfillmentAllowed("live", "live"));
  });

  it("confirms the provider draft only after a paid event", async () => {
    const orders = new Map();
    const provider = createSandboxProvider(orders);
    const draft = await provider.createDraftOrder({
      externalId: "ord-1",
      shippingMethod: "STANDARD",
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [
        {
          externalId: "line",
          variantId: "tee-heavy-black-m",
          quantity: 1,
          retailCents: 2790,
          name: "Tee",
          placement: "front",
          technique: "dtg",
          fileUrl: "http://local/print.png",
        },
      ],
    });
    const store = memoryStore([{ ...awaiting, providerOrderId: draft.id }]);
    const unpaid = await fulfillPaidOrder(store, provider, {
      orderId: "ord-1",
      paid: false,
      podMode: "sandbox",
      paymentsMode: "sandbox",
    });
    assert.equal(unpaid.ok, false);
    assert.equal((await provider.getOrder(draft.id)).confirmed, false);

    const paid = await fulfillPaidOrder(store, provider, {
      orderId: "ord-1",
      paid: true,
      amountCents: 4000,
      podMode: "sandbox",
      paymentsMode: "sandbox",
    });
    assert.equal(paid.ok && paid.action, "confirmed");
    assert.equal(store.orders.get("ord-1")?.status, "submitted");
    assert.equal((await provider.getOrder(draft.id)).confirmed, true);

    const again = await fulfillPaidOrder(store, provider, {
      orderId: "ord-1",
      paid: true,
      amountCents: 4000,
      podMode: "sandbox",
      paymentsMode: "sandbox",
    });
    assert.equal(again.ok && again.action, "ignored");
  });

  it("does not move a delivered order backwards", () => {
    assert.equal(canTransition("delivered", "submitted"), false);
    assert.equal(canTransition("submitted", "shipped"), true);
    assert.equal(canTransition("submitted", "failed"), true);
  });
});

describe("webhooks", () => {
  it("rejects a bad Printful signature before touching the order", async () => {
    const store = memoryStore([awaiting]);
    const raw = JSON.stringify({
      type: "shipment_sent",
      occurred_at: "2026-11-11T00:00:00Z",
      data: { order: { id: 9, external_id: "ord-1", status: "fulfilled" }, shipment: { id: 3, tracking_number: "1Z" } },
    });
    const bad = await processPrintfulWebhook({ rawBody: raw, signature: "nope", secret: "sandbox-secret", store });
    assert.equal(bad.status, 401);
    assert.equal(store.orders.get("ord-1")?.status, "awaiting_payment");

    const good = await processPrintfulWebhook({
      rawBody: raw,
      signature: signPrintfulBody(raw, "sandbox-secret"),
      secret: "sandbox-secret",
      store,
    });
    assert.equal(good.status, 200);
    assert.equal(store.orders.get("ord-1")?.status, "shipped");

    const duplicate = await processPrintfulWebhook({
      rawBody: raw,
      signature: signPrintfulBody(raw, "sandbox-secret"),
      secret: "sandbox-secret",
      store,
    });
    assert.equal(duplicate.body.duplicate, true);
  });

  it("confirms a draft from a signed Stripe event and ignores a replay", async () => {
    const orders = new Map();
    const provider = createSandboxProvider(orders);
    const draft = await provider.createDraftOrder({
      externalId: "ord-1",
      shippingMethod: "STANDARD",
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [
        {
          externalId: "line",
          variantId: "tee-heavy-black-m",
          quantity: 1,
          retailCents: 2790,
          name: "Tee",
          placement: "front",
          technique: "dtg",
          fileUrl: "http://local/print.png",
        },
      ],
    });
    const store = memoryStore([{ ...awaiting, providerOrderId: draft.id }]);
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", amount_total: 4000, metadata: { order_id: "ord-1" } } },
    });
    const now = 1_700_000_000_000;
    const signature = signStripeBody(raw, "whsec_test", now / 1000);
    const forged = await processStripeWebhook({
      rawBody: raw,
      signature: signStripeBody(raw, "other", now / 1000),
      secret: "whsec_test",
      store,
      provider,
      podMode: "sandbox",
      paymentsMode: "sandbox",
      now,
    });
    assert.equal(forged.status, 401);
    assert.equal((await provider.getOrder(draft.id)).confirmed, false);

    const ok = await processStripeWebhook({
      rawBody: raw,
      signature,
      secret: "whsec_test",
      store,
      provider,
      podMode: "sandbox",
      paymentsMode: "sandbox",
      now,
    });
    assert.equal(ok.status, 200);
    assert.equal(store.orders.get("ord-1")?.status, "submitted");

    const replay = await processStripeWebhook({
      rawBody: raw,
      signature,
      secret: "whsec_test",
      store,
      provider,
      podMode: "sandbox",
      paymentsMode: "sandbox",
      now,
    });
    assert.equal(replay.body.duplicate, true);
  });

  it("does not record a stripe event when fulfillment throws, so a retry can confirm", async () => {
    const provider = createSandboxProvider();
    const store = memoryStore([awaiting]);
    const raw = JSON.stringify({
      id: "evt_live",
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", amount_total: 4000, metadata: { order_id: "ord-1" } } },
    });
    const now = 1_700_000_000_000;
    const result = await processStripeWebhook({
      rawBody: raw,
      signature: signStripeBody(raw, "whsec_test", now / 1000),
      secret: "whsec_test",
      store,
      provider,
      podMode: "live",
      paymentsMode: "sandbox",
      now,
    });
    assert.equal(result.status, 500);
    assert.equal(store.events.length, 0);
    assert.equal(store.orders.get("ord-1")?.status, "awaiting_payment");
  });
});
