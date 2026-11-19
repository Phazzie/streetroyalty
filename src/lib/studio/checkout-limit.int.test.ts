import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { asVisitor } from "../../test/request.ts";
import { truncateAll } from "../../test/db.ts";
import {
  CHECKOUT_LIMIT_MESSAGE,
  assertCheckoutStartAllowed,
} from "./checkout-limit.ts";

/**
 * A live studio checkout creates a Printful draft. The public route has to
 * stop one account from opening them without end, the same way the shop does.
 */

async function usageCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from ai_usage`;
  return rows[0]?.n ?? 0;
}

beforeEach(truncateAll);

describe("the studio checkout cap", () => {
  it("lets the 40th live start through and refuses the 41st", async () => {
    for (let n = 0; n < 40; n += 1) await assertCheckoutStartAllowed("live", "live", "ada");
    await expect(assertCheckoutStartAllowed("live", "live", "ada")).rejects.toThrow(
      CHECKOUT_LIMIT_MESSAGE,
    );
  });

  it("does not spend another account's allowance", async () => {
    for (let n = 0; n < 40; n += 1) await assertCheckoutStartAllowed("live", "live", "ada");
    await expect(assertCheckoutStartAllowed("live", "live", "bo")).resolves.toBeUndefined();
  });

  it("follows the account when the address changes, and ignores a blank id's address split", async () => {
    asVisitor("203.0.113.7");
    for (let n = 0; n < 40; n += 1) await assertCheckoutStartAllowed("live", "live", "ada");
    asVisitor("198.51.100.50");
    await expect(assertCheckoutStartAllowed("live", "live", "ada")).rejects.toThrow(
      /Too many checkouts/,
    );
  });

  it("does not count a start that cannot open a paid draft", async () => {
    for (let n = 0; n < 45; n += 1) {
      await assertCheckoutStartAllowed("sandbox", "live", "ada");
      await assertCheckoutStartAllowed("live", "sandbox", "ada");
    }
    expect(await usageCount()).toBe(0);
    await assertCheckoutStartAllowed("live", "live", "ada");
    expect(await usageCount()).toBeGreaterThan(0);
  });
});
