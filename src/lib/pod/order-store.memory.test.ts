import { CLAIM_HOLD_MS } from "./order-flow.ts";
import { orderStoreContract } from "../../test/contracts/order-store.contract.ts";
import { memoryStore } from "../../test/fakes/memory-store.ts";

orderStoreContract("in memory", async () => {
  const store = memoryStore([]);
  return {
    store,
    async seed(order) {
      store.orders.set(order.id, { ...order });
    },
    async ageClaim(id) {
      store.claims.set(id, Date.now() - CLAIM_HOLD_MS - 1);
    },
  };
});
