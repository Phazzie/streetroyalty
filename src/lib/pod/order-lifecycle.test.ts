import { describe } from "vitest";
import { orderLifecycleModel } from "../../test/contracts/order-lifecycle.model.ts";
import { memoryStore } from "../../test/fakes/memory-store.ts";

describe("an order's life", () => {
  orderLifecycleModel(
    "in memory",
    async () => {
      const store = memoryStore([]);
      return {
        store,
        async seed(order) {
          store.orders.set(order.id, { ...order });
        },
      };
    },
    1000,
  );
});
