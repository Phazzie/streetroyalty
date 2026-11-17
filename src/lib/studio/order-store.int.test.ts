import { beforeEach } from "vitest";
import { getSql } from "../db.ts";
import { dbStore } from "./orders.server.ts";
import { orderStoreContract } from "../../test/contracts/order-store.contract.ts";
import { truncateAll } from "../../test/db.ts";
import { seedOrderRow } from "../../test/seed-order.ts";

beforeEach(truncateAll);

orderStoreContract("SQL", async () => {
  const sql = await getSql();
  return {
    store: dbStore(sql),
    seed: (order) => seedOrderRow(order),
    async ageClaim(id) {
      await sql`update orders set updated_at = now() - interval '1 hour' where id = ${id}`;
    },
  };
});
