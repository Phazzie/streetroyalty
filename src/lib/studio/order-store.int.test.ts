import { beforeEach } from "vitest";
import { getSql } from "../db.ts";
import { dbStore } from "./orders.server.ts";
import { orderStoreContract } from "../../test/contracts/order-store.contract.ts";
import { truncateAll } from "../../test/db.ts";
import { seedOrderRow } from "../../test/seed-order.ts";

beforeEach(truncateAll);

orderStoreContract("SQL", async () => ({
  store: dbStore(await getSql()),
  seed: (order) => seedOrderRow(order),
}));
