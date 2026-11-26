import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import * as repo from "./repo.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, TEE, seedDesign, seedUser } from "../../test/seed.ts";

/**
 * Every server function that acts for a signed-in person, called by the wrong
 * person. Ada owns everything here. Bo holds the ids and tries each door.
 *
 * `guarded` lists every export of repo.server.ts that takes a user id. A new
 * one has to be added here, with what Bo should get, or the last test fails.
 */

type Ids = { designId: string; collectionId: string; cartId: string; orderId: string };

type Door = {
  /** What Bo tries, holding Ada's ids. */
  attempt: (ids: Ids) => Promise<unknown>;
  /** "refused": it throws. "empty": it answers with nothing of Ada's. "ignored": it does nothing. */
  expect: "refused" | "empty" | "ignored";
};

const BO = "bo";

const guarded: Record<string, Door> = {
  getDesign: { attempt: (ids) => repo.getDesign(BO, ids.designId), expect: "refused" },
  saveDesign: {
    attempt: (ids) =>
      repo.saveDesign(BO, {
        id: ids.designId,
        title: "Taken",
        productId: TEE.productId,
        variantId: TEE.variantId,
        placement: "front",
        layers: [{ type: "text", text: "X", x: 0.5, y: 0.5, scale: 1, rotation: 0 }],
      }),
    expect: "refused",
  },
  publishDesign: { attempt: (ids) => repo.publishDesign(BO, ids.designId), expect: "refused" },
  // Keeps a file under Bo's own name. Ada's spots cannot name it (spots.int.test.ts).
  storePrintFile: { attempt: () => repo.storePrintFile(BO, pngDataUrl(40, 40)), expect: "ignored" },
  listDesigns: { attempt: () => repo.listDesigns(BO), expect: "empty" },
  listCollections: { attempt: () => repo.listCollections(BO), expect: "empty" },
  createCollection: { attempt: () => repo.createCollection(BO, "Bo's own"), expect: "ignored" },
  addToCart: {
    attempt: (ids) => repo.addToCart(BO, ids.designId, TEE.variantId),
    expect: "refused",
  },
  listCart: { attempt: () => repo.listCart(BO), expect: "empty" },
  updateCart: { attempt: (ids) => repo.updateCart(BO, ids.cartId, 0), expect: "ignored" },
  nudgeCart: { attempt: (ids) => repo.nudgeCart(BO, ids.cartId, 1), expect: "ignored" },
  quoteShipping: { attempt: () => repo.quoteShipping(BO, RECIPIENT), expect: "refused" },
  startCheckout: {
    attempt: () => repo.startCheckout(BO, { recipient: RECIPIENT, shippingMethod: "STANDARD" }),
    expect: "refused",
  },
  completeSandboxPayment: {
    attempt: (ids) => repo.completeSandboxPayment(BO, ids.orderId),
    expect: "refused",
  },
  retryFulfillment: { attempt: (ids) => repo.retryFulfillment(BO, ids.orderId), expect: "refused" },
  syncStripeReturn: { attempt: () => repo.syncStripeReturn(BO, "cs_test_ada"), expect: "refused" },
  listOrders: { attempt: () => repo.listOrders(BO), expect: "empty" },
  readStudioAccess: { attempt: () => repo.readStudioAccess(BO), expect: "ignored" },
  connectWebhooks: { attempt: () => repo.connectWebhooks(BO), expect: "refused" },
};

/** Everything Ada owns, as rows, so any change Bo causes shows up as a difference. */
async function adasWorld(): Promise<string> {
  const sql = await getSql();
  const tables = {
    designs:
      await sql`select id, title, status, collection_id, print_file_id from designs where user_id = 'ada' order by id`,
    collections: await sql`select id, name from collections where user_id = 'ada' order by id`,
    cart: await sql`select id, quantity from cart_items where user_id = 'ada' order by id`,
    orders:
      await sql`select id, status, payment_status from orders where user_id = 'ada' order by id`,
    files: await sql`select id from print_files where user_id = 'ada' order by id`,
  };
  return JSON.stringify(tables);
}

let ids: Ids;

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada", "ada@example.com");
  await seedUser(BO, "bo@example.com");
  process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
  const design = await seedDesign("ada");
  const collection = await repo.createCollection("ada", "Summer");
  await repo.addToCart("ada", design.id, TEE.variantId);
  const [line] = await repo.listCart("ada");
  const order = await repo.startCheckout("ada", {
    recipient: RECIPIENT,
    shippingMethod: "STANDARD",
  });
  ids = {
    designId: design.id,
    collectionId: collection.id,
    cartId: line?.id ?? "",
    orderId: order.orderId,
  };
});

describe("someone holding another person's ids", () => {
  it.each(Object.entries(guarded))(
    "%s gives them nothing and changes nothing",
    async (_name, door) => {
      const before = await adasWorld();
      const outcome = await door.attempt(ids).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );

      if (door.expect === "refused") expect(outcome).toHaveProperty("error");
      if (door.expect === "empty") expect(outcome).toEqual({ value: [] });
      if (door.expect === "ignored") expect(outcome).not.toHaveProperty("error");
      expect(JSON.stringify(outcome)).not.toContain("Crown Tee");
      expect(await adasWorld()).toBe(before);
    },
  );

  it("is covered for every server function that takes a user id", () => {
    const takesUser = Object.entries(repo)
      .filter(
        ([, value]) =>
          typeof value === "function" &&
          /^(async\s+)?function\s*\w*\s*\(\s*userId\b/.test(String(value)),
      )
      .map(([name]) => name)
      .sort();
    expect(takesUser.length).toBeGreaterThan(10);
    expect(Object.keys(guarded).sort()).toEqual(takesUser);
  });
});
