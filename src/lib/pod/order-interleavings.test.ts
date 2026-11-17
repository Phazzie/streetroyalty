import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canTransition,
  processPrintfulWebhook,
  processStripeWebhook,
  settleCardPayment,
  statusFromProviderEvent,
  type OrderStatus,
  type OrderStore,
} from "./order-flow.ts";
import { memoryStore } from "../../test/fakes/memory-store.ts";
import { fakePrinter, type FakePrinter } from "../../test/fakes/printer.ts";
import {
  PRINTFUL_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
  printfulEvent,
  stripeEvent,
} from "../../test/webhooks.ts";

/**
 * Things that happen at the same time. fast-check's scheduler decides which
 * pending database or printer call finishes next, and tries many orderings, so
 * these cover the interleavings a single Promise.all only samples once.
 */

const ORDER = "ord-1";
const PRINTER_ORDER = "pf-1";
const TOTAL = 4000;
const modes = { podMode: "sandbox" as const, paymentsMode: "sandbox" as const };

/** Make every call on an object wait for the scheduler's say-so before it runs. */
function scheduled<T extends object>(scheduler: fc.Scheduler, target: T, label: string): T {
  const out = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(target)) {
    if (typeof value !== "function") continue;
    const bound = (value as (...args: unknown[]) => Promise<unknown>).bind(out);
    out[key] = async (...args: unknown[]) => {
      await scheduler.schedule(Promise.resolve(), `${label}.${key}`);
      return bound(...args);
    };
  }
  return out as T;
}

function world(scheduler: fc.Scheduler, status: OrderStatus) {
  const base = memoryStore([
    {
      id: ORDER,
      status,
      paymentStatus: status === "awaiting_payment" ? "unpaid" : "paid",
      totalCents: TOTAL,
      providerOrderId: PRINTER_ORDER,
    },
  ]);
  const printer = fakePrinter();
  if (status !== "awaiting_payment") printer.confirmed.add(PRINTER_ORDER);
  return {
    base,
    printer,
    store: scheduled<OrderStore>(scheduler, base, "db"),
    slowPrinter: scheduled<FakePrinter>(scheduler, printer, "printer"),
  };
}

type PaidSignal = { via: "webhook"; event: number } | { via: "return" };

const paidSignal: fc.Arbitrary<PaidSignal> = fc.oneof(
  fc.record({ via: fc.constant("webhook" as const), event: fc.integer({ min: 1, max: 2 }) }),
  fc.constant({ via: "return" as const }),
);

describe("payments that arrive together", () => {
  it("print the order once, whatever order the database and printer answer in", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.scheduler(),
        fc.array(paidSignal, { minLength: 2, maxLength: 5 }),
        fc.constantFrom(
          "Order is already confirmed",
          "Order cannot be changed in its current state",
        ),
        async (scheduler, signals, repeatMessage) => {
          const { base, printer, store, slowPrinter } = world(scheduler, "awaiting_payment");
          printer.repeatMessage = repeatMessage;

          const running = signals.map((signal) => {
            if (signal.via === "return") {
              return settleCardPayment(store, slowPrinter, {
                orderId: ORDER,
                paid: true,
                amountCents: TOTAL,
                ...modes,
              }).then((result) => (result.ok ? 200 : 409));
            }
            const signed = stripeEvent({
              id: `evt_${signal.event}`,
              orderId: ORDER,
              amountCents: TOTAL,
            });
            return processStripeWebhook({
              rawBody: signed.raw,
              signature: signed.signature,
              secret: STRIPE_WEBHOOK_SECRET,
              store,
              provider: slowPrinter,
              ...modes,
            }).then((answer) => answer.status);
          });
          const answers = await scheduler.waitFor(Promise.all(running));

          expect(printer.asked, "sent to print more than once").toEqual([PRINTER_ORDER]);
          // One caller prints. Any other either sees it done, or is told to come back while it is in hand.
          expect(answers).toContain(200);
          expect(answers.filter((status) => ![200, 409, 503].includes(status))).toEqual([]);
          expect(base.orders.get(ORDER)).toMatchObject({
            status: "submitted",
            paymentStatus: "paid",
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});

const NOTICES = ["shipment_sent", "shipment_delivered", "order_failed", "order_canceled"];

/** Every status the order could end in if the notices had arrived one at a time, in any order. */
function reachable(from: OrderStatus, notices: string[]): Set<OrderStatus> {
  const ends = new Set<OrderStatus>();
  const walk = (status: OrderStatus, left: string[]) => {
    if (left.length === 0) {
      ends.add(status);
      return;
    }
    left.forEach((type, index) => {
      const next = statusFromProviderEvent({ id: type, type });
      const moved = next && canTransition(status, next) ? next : status;
      walk(moved, [...left.slice(0, index), ...left.slice(index + 1)]);
    });
  };
  walk(from, notices);
  return ends;
}

describe("printer notices that arrive together", () => {
  it("leave the order somewhere it could have reached one notice at a time", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.scheduler(),
        fc.uniqueArray(fc.constantFrom(...NOTICES), { minLength: 2, maxLength: 4 }),
        async (scheduler, notices) => {
          const { base, store } = world(scheduler, "submitted");

          const running = notices.map((type) => {
            const signed = printfulEvent({ type, orderId: ORDER, providerOrderId: PRINTER_ORDER });
            return processPrintfulWebhook({
              rawBody: signed.raw,
              signature: signed.signature,
              secret: PRINTFUL_WEBHOOK_SECRET,
              store,
            });
          });
          await scheduler.waitFor(Promise.all(running));

          const end = base.orders.get(ORDER)?.status;
          expect([...reachable("submitted", notices)]).toContain(end);
          if (
            notices.includes("shipment_delivered") &&
            !notices.some((n) => n !== "shipment_delivered" && n !== "shipment_sent")
          ) {
            expect(end).toBe("delivered");
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
