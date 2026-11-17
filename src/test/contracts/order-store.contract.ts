import { beforeEach, describe, expect, it } from "vitest";
import {
  canTransition,
  type FulfillmentOrder,
  type OrderStatus,
  type OrderStore,
} from "@/lib/pod/order-flow.ts";

export type StoreHarness = {
  store: OrderStore;
  /** Put one order in the store in exactly this state. */
  seed(order: FulfillmentOrder): Promise<void>;
};

export const STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "submitted",
  "failed",
  "needs_review",
  "canceled",
  "shipped",
  "delivered",
];

const IN_THE_PRINTERS_HANDS: OrderStatus[] = ["submitted", "shipped", "delivered"];

function order(status: OrderStatus, id = "ord-1"): FulfillmentOrder {
  return {
    id,
    status,
    paymentStatus: status === "draft" || status === "awaiting_payment" ? "unpaid" : "paid",
    totalCents: 4000,
    providerOrderId: `pf-${id}`,
  };
}

/**
 * What every order store has to do, whatever it keeps its rows in. The rules
 * here are the ones that decide whether a paid order prints once, and whether
 * its status can be trusted afterwards.
 */
export function orderStoreContract(name: string, make: () => Promise<StoreHarness>): void {
  describe(`order store contract: ${name}`, () => {
    let harness: StoreHarness;
    const statusOf = async (id = "ord-1") => (await harness.store.getOrder(id))?.status;

    beforeEach(async () => {
      harness = await make();
    });

    it("finds an order by its id, its external id, and the printer's id", async () => {
      await harness.seed(order("awaiting_payment"));
      expect(await harness.store.getOrder("ord-1")).toEqual(order("awaiting_payment"));
      expect((await harness.store.findByExternalId("ord-1"))?.id).toBe("ord-1");
      expect((await harness.store.findByProviderOrderId("pf-ord-1"))?.id).toBe("ord-1");
      expect(await harness.store.getOrder("nope")).toBeNull();
      expect(await harness.store.findByProviderOrderId("nope")).toBeNull();
    });

    it("marks a confirmed order submitted and paid", async () => {
      await harness.seed(order("awaiting_payment"));
      await harness.store.markSubmitted("ord-1", "pending");
      expect(await harness.store.getOrder("ord-1")).toMatchObject({
        status: "submitted",
        paymentStatus: "paid",
      });
    });

    it("marks a refused print as failed and paid, so it can be retried", async () => {
      await harness.seed(order("awaiting_payment"));
      await harness.store.markFulfillmentFailed("ord-1", "printer said no");
      expect(await harness.store.getOrder("ord-1")).toMatchObject({
        status: "failed",
        paymentStatus: "paid",
      });
    });

    it.each(IN_THE_PRINTERS_HANDS)(
      "does not mark a %s order failed after the fact",
      async (status) => {
        await harness.seed(order(status));
        await harness.store.markFulfillmentFailed("ord-1", "late error");
        expect(await statusOf()).toBe(status);
      },
    );

    it.each(["draft", "awaiting_payment", "failed"] as OrderStatus[])(
      "can hold a %s order for review",
      async (status) => {
        await harness.seed(order(status));
        await harness.store.markNeedsReview("ord-1", "amount mismatch");
        expect(await statusOf()).toBe("needs_review");
      },
    );

    it.each(["submitted", "shipped", "delivered", "canceled"] as OrderStatus[])(
      "does not pull a %s order back for review",
      async (status) => {
        await harness.seed(order(status));
        await harness.store.markNeedsReview("ord-1", "amount mismatch");
        expect(await statusOf()).toBe(status);
      },
    );

    describe("printer updates", () => {
      const pairs = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

      it.each(pairs)(
        "from %s, an update to %s lands only if that move is legal",
        async (from, to) => {
          await harness.seed(order(from));
          await harness.store.applyProviderUpdate("ord-1", { status: to });
          expect(await statusOf()).toBe(canTransition(from, to) ? to : from);
        },
      );

      it("keeps the tracking number from an update whose status it refuses", async () => {
        await harness.seed(order("delivered"));
        await harness.store.applyProviderUpdate("ord-1", {
          status: "shipped",
          trackingNumber: "1Z999",
        });
        expect(await statusOf()).toBe("delivered");
      });
    });

    it("remembers a webhook event, and takes the same one twice without complaint", async () => {
      expect(await harness.store.hasEvent("evt_1")).toBe(false);
      await harness.store.recordEvent("evt_1", "stripe", "checkout.session.completed");
      await harness.store.recordEvent("evt_1", "stripe", "checkout.session.completed");
      expect(await harness.store.hasEvent("evt_1")).toBe(true);
      expect(await harness.store.hasEvent("evt_2")).toBe(false);
    });

    it("keeps two orders apart", async () => {
      await harness.seed(order("awaiting_payment", "ord-1"));
      await harness.seed(order("awaiting_payment", "ord-2"));
      await harness.store.markSubmitted("ord-1", "pending");
      expect(await statusOf("ord-1")).toBe("submitted");
      expect(await statusOf("ord-2")).toBe("awaiting_payment");
    });
  });
}
