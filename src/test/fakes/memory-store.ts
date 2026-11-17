import type { FulfillmentOrder, OrderStore } from "@/lib/pod/order-flow.ts";

export type MemoryStore = OrderStore & {
  orders: Map<string, FulfillmentOrder>;
  events: string[];
};

/**
 * The order store with no database behind it. The contract in
 * src/test/contracts/order-store.contract.ts runs against this and against the
 * SQL store, so a rule one of them has is a rule both have.
 */
export function memoryStore(seed: FulfillmentOrder[]): MemoryStore {
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
    async markFulfillmentFailed(id) {
      const order = orders.get(id);
      if (!order) return;
      order.status = "failed";
      order.paymentStatus = "paid";
    },
    async markNeedsReview(id) {
      const order = orders.get(id);
      if (!order) return;
      order.status = "needs_review";
      order.paymentStatus = "paid";
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
    async clearPurchasedLines(orderId) {
      events.push(`cart:${orderId}`);
    },
  };
}
