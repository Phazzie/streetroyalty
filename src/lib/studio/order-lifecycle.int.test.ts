import { beforeAll, describe } from "vitest";
import { getSql } from "../db.ts";
import { dbStore } from "./orders.server.ts";
import { orderLifecycleModel } from "../../test/contracts/order-lifecycle.model.ts";
import { truncateAll } from "../../test/db.ts";
import { seedOrderRow } from "../../test/seed-order.ts";

beforeAll(truncateAll);

describe("an order's life", () => {
  orderLifecycleModel(
    "SQL",
    async () => ({ store: dbStore(await getSql()), seed: (order) => seedOrderRow(order) }),
    100,
  );
});
