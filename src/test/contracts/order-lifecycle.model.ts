import fc from "fast-check";
import { expect, it } from "vitest";
import {
  CLAIMABLE,
  fulfillPaidOrder,
  processPrintfulWebhook,
  processStripeWebhook,
  type FulfillmentOrder,
  type OrderStatus,
  type OrderStore,
} from "@/lib/pod/order-flow.ts";
import { fakePrinter } from "../fakes/printer.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../webhooks.ts";

/**
 * A random walk through an order's life. fast-check invents sequences of
 * everything that can happen to one order after checkout: payments that match
 * and payments that do not, replays, printer notices in any order, a retry, an
 * outage. After every step the rules below must hold. When one breaks,
 * fast-check shrinks the sequence to the shortest one that still breaks it.
 */

const TOTAL = 4000;

type Step =
  | {
      kind: "stripe";
      event: number;
      amount: "right" | "wrong" | "missing";
      paid: boolean;
      late: boolean;
    }
  | { kind: "printer"; type: string; status?: string; at: number }
  | { kind: "testPayment" }
  | { kind: "retry" }
  | { kind: "outage"; down: boolean };

const SHIPPING_NOTICES = ["shipment_sent", "shipment_delivered"];

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("stripe" as const),
      event: fc.integer({ min: 1, max: 4 }),
      amount: fc.constantFrom(
        "right" as const,
        "right" as const,
        "wrong" as const,
        "missing" as const,
      ),
      paid: fc.boolean(),
      late: fc.boolean(),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("printer" as const),
      type: fc.constantFrom(
        "shipment_sent",
        "shipment_delivered",
        "order_failed",
        "order_canceled",
        "shipment_canceled",
        "order_updated",
        "order_put_hold",
      ),
      status: fc.constantFrom(undefined, "fulfilled", "canceled", "failed", "onhold", "pending"),
      at: fc.integer({ min: 1, max: 3 }),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: "testPayment" as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: "retry" as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("outage" as const), down: fc.boolean() }) },
);

const FINAL: OrderStatus[] = ["delivered", "needs_review"];
const WITH_THE_PRINTER: OrderStatus[] = ["submitted", "shipped", "delivered"];

export type LifecycleHarness = {
  store: OrderStore;
  seed(order: FulfillmentOrder): Promise<void>;
};

export function orderLifecycleModel(
  name: string,
  make: () => Promise<LifecycleHarness>,
  runs: number,
): void {
  it(`holds its rules through any sequence of payments and printer notices: ${name}`, async () => {
    let run = 0;
    await fc.assert(
      fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 14 }), async (steps) => {
        run += 1;
        const orderId = `ord-${name.replaceAll(" ", "")}-${run}-${Math.random().toString(36).slice(2, 8)}`;
        const providerOrderId = `pf-${orderId}`;
        const harness = await make();
        await harness.seed({
          id: orderId,
          status: "awaiting_payment",
          paymentStatus: "unpaid",
          totalCents: TOTAL,
          providerOrderId,
        });
        const cleared: string[] = [];
        const store: OrderStore = {
          ...harness.store,
          async clearPurchasedLines(id) {
            cleared.push(id);
            await harness.store.clearPurchasedLines(id);
          },
        };
        const printer = fakePrinter();
        const modes = { podMode: "sandbox" as const, paymentsMode: "sandbox" as const };
        /** True once money that matches the order has genuinely arrived. */
        let moneyIn = false;
        /** True once any payment has been reported, right amount or not. */
        let captured = false;
        /** True once Stripe itself has reported taking the buyer's money. */
        let cardCharged = false;
        const seenEvents = new Set<string>();
        const read = async () => {
          const order = await store.getOrder(orderId);
          if (!order) throw new Error("order vanished");
          return order;
        };

        for (const current of steps) {
          const before = await read();
          const printedBefore = printer.confirmed.has(providerOrderId);
          let replay = false;

          if (current.kind === "outage") {
            printer.down = current.down;
          } else if (current.kind === "testPayment") {
            moneyIn = true;
            captured = true;
            await fulfillPaidOrder(store, printer, { orderId, paid: true, ...modes }).catch(
              () => undefined,
            );
          } else if (current.kind === "retry") {
            if (before.status === "failed" && before.paymentStatus === "paid") {
              await fulfillPaidOrder(store, printer, {
                orderId,
                paid: true,
                amountCents: before.totalCents,
                ...modes,
              }).catch(() => undefined);
            }
          } else if (current.kind === "stripe") {
            const id = `evt_${orderId}_${current.event}`;
            const amountCents =
              current.amount === "right"
                ? TOTAL
                : current.amount === "wrong"
                  ? TOTAL - 1
                  : undefined;
            const signed = stripeEvent({
              id,
              orderId,
              amountCents,
              type: current.late
                ? "checkout.session.async_payment_succeeded"
                : "checkout.session.completed",
              paymentStatus: current.paid ? "paid" : "unpaid",
            });
            const counts = (current.paid || current.late) && current.amount !== "wrong";
            replay = seenEvents.has(id);
            if (counts && !replay) moneyIn = true;
            if ((current.paid || current.late) && !replay) {
              captured = true;
              cardCharged = true;
            }
            const answer = await processStripeWebhook({
              rawBody: signed.raw,
              signature: signed.signature,
              secret: STRIPE_WEBHOOK_SECRET,
              store,
              provider: printer,
              ...modes,
            });
            // A 500 asks Stripe to send it again, so the event is not on record yet.
            if (answer.status === 200) {
              if (replay) expect(answer.body).toEqual({ duplicate: true });
              seenEvents.add(id);
            } else {
              expect(answer.status).toBe(500);
              expect(printer.down).toBe(true);
              replay = false;
            }
          } else {
            // A printer only ships what it was told to print.
            if (SHIPPING_NOTICES.includes(current.type) && !printedBefore) continue;
            if (current.status === "fulfilled" && !printedBefore) continue;
            const signed = printfulEvent({
              type: current.type,
              orderId,
              providerOrderId,
              status: current.status,
              at: `2026-03-0${current.at}T00:00:00Z`,
            });
            const answer = await processPrintfulWebhook({
              rawBody: signed.raw,
              signature: signed.signature,
              secret: PRINTFUL_WEBHOOK_SECRET,
              store,
            });
            expect(answer.status).toBe(200);
            replay = answer.body.duplicate === true;
          }

          const after = await read();
          const printed = printer.confirmed.has(providerOrderId);

          // Nothing is printed until matching money has arrived.
          if (printed) expect(moneyIn, "printed without payment").toBe(true);
          // The order never claims to be paid when no money arrived.
          if (after.paymentStatus === "paid")
            expect(captured, "marked paid without payment").toBe(true);
          // Once a card was charged, the order says so, whatever else is true of it.
          if (cardCharged) expect(after.paymentStatus, "charge not on record").toBe("paid");
          // It never claims to be with the printer when the printer does not have it.
          if (WITH_THE_PRINTER.includes(after.status)) {
            expect(printed, `${after.status} but never sent to print`).toBe(true);
          }
          // Some states are the end of the road.
          if (FINAL.includes(before.status)) {
            expect(after.status, `left ${before.status}`).toBe(before.status);
          }
          // A canceled order stays canceled, unless a charge lands on it and a human has to step in.
          if (before.status === "canceled") {
            expect(["canceled", "needs_review"], "canceled order revived").toContain(after.status);
            if (after.status === "needs_review") expect(cardCharged).toBe(true);
          }
          // Shipped only ever becomes delivered.
          if (before.status === "shipped") {
            expect(["shipped", "delivered"], "shipped went backwards").toContain(after.status);
          }
          // The printer is sent an order it already has only on a retry after a reported failure.
          if (printedBefore && printer.asked.length > 0) {
            expect(printer.confirmed.size).toBe(1);
          }
          // A replayed event changes nothing.
          if (replay) expect(after).toEqual(before);
          // The cart is only emptied for an order that went to print.
          if (cleared.length > 0) expect(printed, "cart cleared for an unprinted order").toBe(true);
          // Matching money with a working printer always ends with the order at the printer.
          if (
            current.kind === "testPayment" &&
            !printer.down &&
            CLAIMABLE.includes(before.status)
          ) {
            expect(after.status).toBe("submitted");
            expect(printed).toBe(true);
          }
        }
      }),
      { numRuns: runs },
    );
  });
}
