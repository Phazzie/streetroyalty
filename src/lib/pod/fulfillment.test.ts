import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  fulfillPaidOrder,
  processPrintfulWebhook,
  processStripeWebhook,
  settleCardPayment,
  type FulfillmentOrder,
  type OrderStatus,
} from "./order-flow.ts";
import { signPrintfulBody, verifyPrintfulSignature } from "./signature.ts";
import { signStripeBody, verifyStripeSignature } from "../payments/stripe.ts";
import { memoryStore } from "../../test/fakes/memory-store.ts";
import { fakePrinter } from "../../test/fakes/printer.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../../test/webhooks.ts";

const TOTAL = 4000;
const modes = { podMode: "sandbox" as const, paymentsMode: "sandbox" as const };

function setup(
  status: OrderStatus = "awaiting_payment",
  paymentStatus: "paid" | "unpaid" = "unpaid",
) {
  const order: FulfillmentOrder = {
    id: "ord-1",
    status,
    paymentStatus,
    totalCents: TOTAL,
    providerOrderId: "pf-1",
  };
  const store = memoryStore([order]);
  const printer = fakePrinter();
  const paid = { orderId: "ord-1", paid: true, amountCents: TOTAL, ...modes };
  const now = () => store.orders.get("ord-1");
  const stripe = (input: Partial<Parameters<typeof stripeEvent>[0]> = {}) => {
    const signed = stripeEvent({ id: "evt_1", orderId: "ord-1", amountCents: TOTAL, ...input });
    return processStripeWebhook({
      rawBody: signed.raw,
      signature: signed.signature,
      secret: STRIPE_WEBHOOK_SECRET,
      store,
      provider: printer,
      ...modes,
    });
  };
  return { store, printer, paid, now, stripe };
}

describe("sending a paid order to print", () => {
  it("prints, marks the order submitted, and reports it confirmed", async () => {
    const { store, printer, paid, now } = setup();
    expect(await fulfillPaidOrder(store, printer, paid)).toEqual({ ok: true, action: "confirmed" });
    expect(printer.asked).toEqual(["pf-1"]);
    expect(now()).toMatchObject({ status: "submitted", paymentStatus: "paid" });
  });

  it("does not ask the printer when another caller already holds the order", async () => {
    const { store, printer, paid, now } = setup();
    await store.claimForPrint("ord-1");
    expect(await fulfillPaidOrder(store, printer, paid)).toEqual({
      ok: true,
      action: "ignored",
      reason: "already_in_hand",
    });
    expect(printer.asked).toEqual([]);
    expect(now()?.status).toBe("paid");
  });

  it("marks the order failed and paid when the printer refuses, and passes the error on", async () => {
    const { store, printer, paid, now } = setup();
    printer.down = true;
    await expect(fulfillPaidOrder(store, printer, paid)).rejects.toThrow(/unavailable/);
    expect(now()).toMatchObject({ status: "failed", paymentStatus: "paid" });
  });

  it("treats a refusal as success when the printer's own record shows the order confirmed", async () => {
    const { store, printer, paid, now } = setup();
    printer.confirmed.add("pf-1");
    printer.repeatMessage = "Something this app has never seen";
    expect(await fulfillPaidOrder(store, printer, paid)).toEqual({ ok: true, action: "confirmed" });
    expect(now()?.status).toBe("submitted");
  });

  it("falls back to the wording of the refusal when the printer's record cannot be read", async () => {
    const { store, printer, paid, now } = setup();
    printer.confirmed.add("pf-1");
    printer.blind = true;
    expect((await fulfillPaidOrder(store, printer, paid)).ok).toBe(true);
    expect(now()?.status).toBe("submitted");
  });

  it("fails the order when the record cannot be read and the wording says nothing", async () => {
    const { store, printer, paid, now } = setup();
    printer.confirmed.add("pf-1");
    printer.blind = true;
    printer.repeatMessage = "Something this app has never seen";
    await expect(fulfillPaidOrder(store, printer, paid)).rejects.toThrow();
    expect(now()?.status).toBe("failed");
  });

  it("prints an order whose draft the printer had failed before the buyer paid", async () => {
    const { store, printer, paid, now } = setup("failed", "unpaid");
    expect((await fulfillPaidOrder(store, printer, paid)).ok).toBe(true);
    expect(now()).toMatchObject({ status: "submitted", paymentStatus: "paid" });
  });

  it.each([
    ["an unpaid signal", { paid: false }, "unpaid"],
    ["a different amount", { amountCents: TOTAL + 1 }, "amount_mismatch"],
  ])("refuses %s without touching the printer", async (_what, change, reason) => {
    const { store, printer, paid, now } = setup();
    expect(await fulfillPaidOrder(store, printer, { ...paid, ...change })).toEqual({
      ok: false,
      reason,
    });
    expect(printer.asked).toEqual([]);
    expect(now()?.status).toBe("awaiting_payment");
  });

  it("refuses an order with no draft at the printer", async () => {
    const { store, printer, paid } = setup();
    const order = store.orders.get("ord-1");
    if (order) order.providerOrderId = null;
    expect(await fulfillPaidOrder(store, printer, paid)).toEqual({
      ok: false,
      reason: "missing_provider_order",
    });
  });

  it("never lets a test payment confirm a live print order", async () => {
    const { store, printer, paid } = setup();
    await expect(
      fulfillPaidOrder(store, printer, { ...paid, podMode: "live", paymentsMode: "sandbox" }),
    ).rejects.toThrow(/Sandbox payment/);
    expect(printer.asked).toEqual([]);
  });
});

describe("a card charge the shop cannot honor", () => {
  it("holds the order for a refund when the amount does not match", async () => {
    const { store, printer, paid, now } = setup();
    const result = await settleCardPayment(store, printer, { ...paid, amountCents: TOTAL - 500 });
    expect(result).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(now()).toMatchObject({ status: "needs_review", paymentStatus: "paid" });
    expect(printer.asked).toEqual([]);
  });

  it("holds the order for a refund when it was canceled before the buyer paid", async () => {
    const { store, printer, paid, now } = setup("canceled");
    const result = await settleCardPayment(store, printer, paid);
    expect(result).toEqual({ ok: false, reason: "canceled" });
    expect(now()).toMatchObject({ status: "needs_review", paymentStatus: "paid" });
    expect(printer.asked).toEqual([]);
  });

  it("does not hold an order over a session that was never paid", async () => {
    const { store, printer, paid, now } = setup("canceled");
    await settleCardPayment(store, printer, { ...paid, paid: false });
    expect(now()).toMatchObject({ status: "canceled", paymentStatus: "unpaid" });
  });
});

describe("the Stripe webhook", () => {
  it("answers 503 when no signing secret is configured, without reading the body", async () => {
    const { store, printer } = setup();
    const answer = await processStripeWebhook({
      rawBody: "not even json",
      signature: "t=1,v1=00",
      secret: "",
      store,
      provider: printer,
      ...modes,
    });
    expect(answer.status).toBe(503);
  });

  it("answers 401 to a body signed with the wrong secret", async () => {
    const { store, printer, now } = setup();
    const signed = stripeEvent({ id: "evt_1", orderId: "ord-1", amountCents: TOTAL });
    const answer = await processStripeWebhook({
      rawBody: signed.raw,
      signature: signStripeBody(signed.raw, "whsec_other", Math.floor(Date.now() / 1000)),
      secret: STRIPE_WEBHOOK_SECRET,
      store,
      provider: printer,
      ...modes,
    });
    expect(answer.status).toBe(401);
    expect(now()?.status).toBe("awaiting_payment");
  });

  it("answers 401 to a correctly signed body that was altered afterwards", async () => {
    const { store, printer } = setup();
    const signed = stripeEvent({ id: "evt_1", orderId: "ord-1", amountCents: TOTAL });
    const answer = await processStripeWebhook({
      rawBody: signed.raw.replace(String(TOTAL), "1"),
      signature: signed.signature,
      secret: STRIPE_WEBHOOK_SECRET,
      store,
      provider: printer,
      ...modes,
    });
    expect(answer.status).toBe(401);
    expect(printer.asked).toEqual([]);
  });

  it("answers 400 to a signed body that is not JSON, or has no event id", async () => {
    const { store, printer } = setup();
    for (const raw of ["not json", JSON.stringify({ type: "checkout.session.completed" })]) {
      const answer = await processStripeWebhook({
        rawBody: raw,
        signature: signStripeBody(raw, STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000)),
        secret: STRIPE_WEBHOOK_SECRET,
        store,
        provider: printer,
        ...modes,
      });
      expect(answer.status).toBe(400);
    }
  });

  it("records and ignores event types it does not act on", async () => {
    const { store, stripe, now } = setup();
    const answer = await stripe({ type: "payment_intent.created" });
    expect(answer).toEqual({ status: 200, body: { ignored: true } });
    expect(await store.hasEvent("evt_1")).toBe(true);
    expect(now()?.status).toBe("awaiting_payment");
  });

  it("waits for the money on a delayed payment method, then prints", async () => {
    const { printer, stripe, now } = setup();
    const completed = await stripe({ id: "evt_1", paymentStatus: "unpaid" });
    expect(completed.body).toEqual({ ok: false, reason: "unpaid" });
    expect(printer.asked).toEqual([]);
    expect(now()).toMatchObject({ status: "awaiting_payment", paymentStatus: "unpaid" });

    const cleared = await stripe({
      id: "evt_2",
      type: "checkout.session.async_payment_succeeded",
      paymentStatus: "unpaid",
    });
    expect(cleared.body).toEqual({ ok: true, action: "confirmed" });
    expect(now()?.status).toBe("submitted");
  });

  it("answers 500 without recording the event when the printer is down, so Stripe sends it again", async () => {
    const { store, printer, stripe, now } = setup();
    printer.down = true;
    expect((await stripe()).status).toBe(500);
    expect(await store.hasEvent("evt_1")).toBe(false);
    expect(now()).toMatchObject({ status: "failed", paymentStatus: "paid" });

    printer.down = false;
    expect((await stripe()).body).toEqual({ ok: true, action: "confirmed" });
    expect(now()?.status).toBe("submitted");
  });

  it("holds a live charge for refund when printing is still in sandbox", async () => {
    const { store, printer, now } = setup();
    const signed = stripeEvent({ id: "evt_1", orderId: "ord-1", amountCents: TOTAL });
    const answer = await processStripeWebhook({
      rawBody: signed.raw,
      signature: signed.signature,
      secret: STRIPE_WEBHOOK_SECRET,
      store,
      provider: printer,
      podMode: "sandbox",
      paymentsMode: "live",
    });
    expect(answer.body).toEqual({ ok: false, reason: "sandbox_print" });
    expect(now()?.status).toBe("needs_review");
    expect(printer.asked).toEqual([]);
  });

  it("empties the cart only when the order went to print", async () => {
    const { store, stripe } = setup();
    await stripe({ id: "evt_1", amountCents: TOTAL - 1 });
    expect(store.events).not.toContain("cart:ord-1");
  });

  it("accepts a signature header that carries an old and a new signature during a secret roll", async () => {
    const raw = "{}";
    const at = 1_700_000_000;
    const good = signStripeBody(raw, "whsec_new", at).split(",v1=")[1];
    const header = `t=${at},v1=${"0".repeat(64)},v1=${good}`;
    expect(verifyStripeSignature(raw, header, "whsec_new", at * 1000)).toBe(true);
  });

  it("refuses a signature older or newer than five minutes", () => {
    const raw = "{}";
    const at = 1_700_000_000;
    const header = signStripeBody(raw, "whsec", at);
    expect(verifyStripeSignature(raw, header, "whsec", (at + 299) * 1000)).toBe(true);
    expect(verifyStripeSignature(raw, header, "whsec", (at + 301) * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, header, "whsec", (at - 301) * 1000)).toBe(false);
  });
});

describe("the Printful webhook", () => {
  const send = (
    store: ReturnType<typeof memoryStore>,
    input: Partial<Parameters<typeof printfulEvent>[0]>,
  ) => {
    const signed = printfulEvent({
      type: "shipment_sent",
      orderId: "ord-1",
      providerOrderId: "pf-1",
      ...input,
    });
    return processPrintfulWebhook({
      rawBody: signed.raw,
      signature: signed.signature,
      secret: PRINTFUL_WEBHOOK_SECRET,
      store,
    });
  };

  it("answers 503 with no secret and 401 with a bad signature", async () => {
    const { store } = setup("submitted", "paid");
    const signed = printfulEvent({
      type: "shipment_sent",
      orderId: "ord-1",
      providerOrderId: "pf-1",
    });
    const args = { rawBody: signed.raw, store };
    expect(
      (await processPrintfulWebhook({ ...args, signature: signed.signature, secret: "" })).status,
    ).toBe(503);
    expect(
      (await processPrintfulWebhook({ ...args, signature: "00", secret: PRINTFUL_WEBHOOK_SECRET }))
        .status,
    ).toBe(401);
    expect(
      (await processPrintfulWebhook({ ...args, signature: null, secret: PRINTFUL_WEBHOOK_SECRET }))
        .status,
    ).toBe(401);
  });

  it("finds the order by the printer's id when the notice carries no external id", async () => {
    const { store, now } = setup("submitted", "paid");
    await send(store, { orderId: "" });
    expect(now()?.status).toBe("shipped");
  });

  it("records a notice about an order it does not know, and moves on", async () => {
    const { store } = setup("submitted", "paid");
    const answer = await send(store, { orderId: "someone-else", providerOrderId: "pf-999" });
    expect(answer).toEqual({ status: 200, body: { ignored: true } });
  });

  it("ignores the same notice the second time", async () => {
    const { store } = setup("submitted", "paid");
    await send(store, {});
    expect((await send(store, {})).body).toEqual({ duplicate: true });
  });

  it("leaves the status alone when the printer puts an order on hold", async () => {
    const { store, now } = setup("submitted", "paid");
    await send(store, { type: "order_put_hold", status: "onhold" });
    expect(now()?.status).toBe("submitted");
  });
});

describe("webhook signatures", () => {
  const body = fc.string({ minLength: 1, maxLength: 400 });
  const secret = fc
    .string({ minLength: 8, maxLength: 64 })
    .filter((value) => value.trim() === value);

  it("verify what they sign, for any body and secret", () => {
    fc.assert(
      fc.property(body, secret, fc.integer({ min: 1, max: 2_000_000_000 }), (raw, key, at) => {
        expect(verifyStripeSignature(raw, signStripeBody(raw, key, at), key, at * 1000)).toBe(true);
        expect(verifyPrintfulSignature(raw, signPrintfulBody(raw, key), key)).toBe(true);
      }),
    );
  });

  it("refuse a body that differs by a single character", () => {
    fc.assert(
      fc.property(body, secret, fc.nat(), (raw, key, at) => {
        const index = at % raw.length;
        const swapped = raw[index] === "x" ? "y" : "x";
        const tampered = raw.slice(0, index) + swapped + raw.slice(index + 1);
        expect(
          verifyStripeSignature(tampered, signStripeBody(raw, key, 1000), key, 1_000_000),
        ).toBe(false);
        expect(verifyPrintfulSignature(tampered, signPrintfulBody(raw, key), key)).toBe(false);
      }),
    );
  });

  it("refuse a signature made with a different secret", () => {
    fc.assert(
      fc.property(body, secret, secret, (raw, key, other) => {
        fc.pre(key !== other);
        expect(verifyStripeSignature(raw, signStripeBody(raw, other, 1000), key, 1_000_000)).toBe(
          false,
        );
        expect(verifyPrintfulSignature(raw, signPrintfulBody(raw, other), key)).toBe(false);
      }),
    );
  });

  it("refuse an empty, missing or malformed signature rather than throwing", () => {
    for (const header of [null, undefined, "", "v1=abc", "t=abc,v1=00", "t=1", "garbage"]) {
      expect(verifyStripeSignature("{}", header, "whsec")).toBe(false);
      expect(verifyPrintfulSignature("{}", header, "secret")).toBe(false);
    }
  });
});
