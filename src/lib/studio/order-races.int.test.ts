import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import type { PodProvider } from "../pod/types.ts";
import {
  completeSandboxPayment,
  receivePrintfulWebhook,
  receiveStripeWebhook,
  startCheckout,
} from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { RECIPIENT, seedCart } from "../../test/seed.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../../test/webhooks.ts";

/**
 * The printer, watched. `confirms` is how many times it was asked to print each
 * order. `strict` makes it answer a repeat the way a printer we have not seen
 * yet might: with an error the app has no pattern for.
 */
const printer = vi.hoisted(() => ({ confirms: new Map<string, number>(), strict: false }));

vi.mock("../pod/index.ts", async (original) => {
  const real = await original<typeof import("../pod/index.ts")>();
  return {
    ...real,
    getPodProvider: (...args: Parameters<typeof real.getPodProvider>): PodProvider => {
      const provider = real.getPodProvider(...args);
      return {
        ...provider,
        async confirmOrder(orderId) {
          const asked = (printer.confirms.get(orderId) ?? 0) + 1;
          printer.confirms.set(orderId, asked);
          if (asked > 1 && printer.strict)
            throw new Error("Order cannot be changed in its current state");
          return provider.confirmOrder(orderId);
        },
      };
    },
  };
});

async function awaitingOrder(userId = "u1") {
  await seedCart(userId);
  const started = await startCheckout(userId, { recipient: RECIPIENT, shippingMethod: "STANDARD" });
  const sql = await getSql();
  const rows = await sql<{ provider_order_id: string }>`
    select provider_order_id from orders where id = ${started.orderId}
  `;
  return {
    orderId: started.orderId,
    totalCents: started.totalCents,
    providerOrderId: rows[0]?.provider_order_id ?? "",
  };
}

async function statusOf(orderId: string): Promise<string | undefined> {
  const sql = await getSql();
  const rows = await sql<{ status: string }>`select status from orders where id = ${orderId}`;
  return rows[0]?.status;
}

function timesPrinted(providerOrderId: string): number {
  return printer.confirms.get(providerOrderId) ?? 0;
}

beforeEach(async () => {
  await truncateAll();
  printer.confirms.clear();
  printer.strict = false;
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  process.env.PRINTFUL_WEBHOOK_SECRET = PRINTFUL_WEBHOOK_SECRET;
});

describe("one paid order, two signals at once", () => {
  it("asks the printer once when the webhook and the buyer's own confirmation race", async () => {
    const order = await awaitingOrder();
    const paid = stripeEvent({
      id: "evt_1",
      orderId: order.orderId,
      amountCents: order.totalCents,
    });

    const [webhook, click] = await Promise.all([
      receiveStripeWebhook(paid.raw, paid.signature),
      completeSandboxPayment("u1", order.orderId),
    ]);

    // Whichever loses is told the order is in hand: the webhook with a 503 that Stripe retries.
    expect([200, 503]).toContain(webhook.status);
    expect(click.status).toBe("submitted");
    expect(timesPrinted(order.providerOrderId)).toBe(1);
    expect(await statusOf(order.orderId)).toBe("submitted");
  });

  it("asks the printer once when Stripe delivers the same event five times at once", async () => {
    const order = await awaitingOrder();
    const paid = stripeEvent({
      id: "evt_1",
      orderId: order.orderId,
      amountCents: order.totalCents,
    });

    const answers = await Promise.all(
      Array.from({ length: 5 }, () => receiveStripeWebhook(paid.raw, paid.signature)),
    );

    const statuses = answers.map((answer) => answer.status);
    expect(statuses).toContain(200);
    expect(statuses.filter((status) => status !== 200 && status !== 503)).toEqual([]);
    expect(timesPrinted(order.providerOrderId)).toBe(1);
    expect(await statusOf(order.orderId)).toBe("submitted");

    // Stripe sends the ones that got a 503 again. By then the order is in, and the event is on record.
    const retry = await receiveStripeWebhook(paid.raw, paid.signature);
    expect(retry).toEqual({ status: 200, body: { duplicate: true } });
    expect(timesPrinted(order.providerOrderId)).toBe(1);
  });

  it("does not depend on how the printer words a refusal to print twice", async () => {
    printer.strict = true;
    const order = await awaitingOrder();
    const first = stripeEvent({
      id: "evt_1",
      orderId: order.orderId,
      amountCents: order.totalCents,
    });
    const second = stripeEvent({
      id: "evt_2",
      orderId: order.orderId,
      amountCents: order.totalCents,
    });

    const answers = await Promise.all([
      receiveStripeWebhook(first.raw, first.signature),
      receiveStripeWebhook(second.raw, second.signature),
    ]);

    const statuses = answers.map((answer) => answer.status).sort();
    expect(statuses).toEqual([200, 503]);
    expect(await statusOf(order.orderId)).toBe("submitted");
    expect(timesPrinted(order.providerOrderId)).toBe(1);

    // The retry of the one that was turned away finds the order already in.
    const loser = answers[0]?.status === 503 ? first : second;
    expect((await receiveStripeWebhook(loser.raw, loser.signature)).body).toEqual({
      ok: true,
      action: "ignored",
      reason: "already_fulfilled",
    });
  });
});

describe("printer updates that arrive together", () => {
  it("leaves a delivered order delivered when the shipped notice lands late", async () => {
    const order = await awaitingOrder();
    await completeSandboxPayment("u1", order.orderId);
    const delivered = printfulEvent({
      type: "shipment_delivered",
      ...order,
      trackingNumber: "1Z1",
    });
    const shipped = printfulEvent({ type: "shipment_sent", ...order, trackingNumber: "1Z1" });

    await Promise.all([
      receivePrintfulWebhook(delivered.raw, delivered.signature),
      receivePrintfulWebhook(shipped.raw, shipped.signature),
    ]);

    expect(await statusOf(order.orderId)).toBe("delivered");
  });

  it("does not fail an order the printer has already shipped", async () => {
    const order = await awaitingOrder();
    await completeSandboxPayment("u1", order.orderId);
    const shipped = printfulEvent({ type: "shipment_sent", ...order, trackingNumber: "1Z1" });
    const failed = printfulEvent({ type: "order_failed", ...order });

    await Promise.all([
      receivePrintfulWebhook(shipped.raw, shipped.signature),
      receivePrintfulWebhook(failed.raw, failed.signature),
    ]);

    expect(await statusOf(order.orderId)).toBe("shipped");
  });
});
