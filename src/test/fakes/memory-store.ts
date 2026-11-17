import {
  CLAIMABLE,
  CLAIM_HOLD_MS,
  HOLDABLE,
  canTransition,
  type FulfillmentOrder,
  type OrderStatus,
  type OrderStore,
} from "@/lib/pod/order-flow.ts";

const IN_THE_PRINTERS_HANDS: OrderStatus[] = ["submitted", "shipped", "delivered"];

export type MemoryStore = OrderStore & {
  orders: Map<string, FulfillmentOrder>;
  events: string[];
  /** When each order was claimed for printing. Tests rewind this to let a claim go stale. */
  claims: Map<string, number>;
};

/**
 * The order store with no database behind it. The contract in
 * src/test/contracts/order-store.contract.ts runs against this and against the
 * SQL store, so a rule one of them has is a rule both have.
 */
export function memoryStore(seed: FulfillmentOrder[]): MemoryStore {
  const orders = new Map(seed.map((order) => [order.id, { ...order }]));
  const events: string[] = [];
  const claims = new Map<string, number>();
  return {
    orders,
    events,
    claims,
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
    async claimForPrint(id) {
      const order = orders.get(id);
      if (!order) return false;
      const held = claims.get(id);
      const stale = order.status === "paid" && held != null && Date.now() - held >= CLAIM_HOLD_MS;
      if (!CLAIMABLE.includes(order.status) && !stale) return false;
      order.status = "paid";
      order.paymentStatus = "paid";
      claims.set(id, Date.now());
      return true;
    },
    async markSubmitted(id) {
      const order = orders.get(id);
      if (!order) return;
      order.status = "submitted";
      order.paymentStatus = "paid";
    },
    async markFulfillmentFailed(id) {
      const order = orders.get(id);
      if (!order || IN_THE_PRINTERS_HANDS.includes(order.status)) return;
      order.status = "failed";
      order.paymentStatus = "paid";
    },
    async markNeedsReview(id) {
      const order = orders.get(id);
      if (!order || !HOLDABLE.includes(order.status)) return;
      order.status = "needs_review";
      order.paymentStatus = "paid";
    },
    async applyProviderUpdate(id, patch) {
      const order = orders.get(id);
      if (!order) return;
      if (patch.status && canTransition(order.status, patch.status)) order.status = patch.status;
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
