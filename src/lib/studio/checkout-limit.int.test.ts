import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { asVisitor } from "../../test/request.ts";
import { truncateAll } from "../../test/db.ts";
import { count } from "../ai/guard.server.ts";
import { RECIPIENT, seedCart, seedUser } from "../../test/seed.ts";
import { startCheckout } from "./orders.server.ts";
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

  it("does not count a live start until the address and the cart are real", async () => {
    process.env.POD_MODE = "live";
    process.env.PAYMENTS_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test";
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    await expect(
      startCheckout("ada", { recipient: { ...RECIPIENT, name: "" }, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(/name/);
    expect(await usageCount()).toBe(0);

    await seedUser("ada");
    await expect(
      startCheckout("ada", { recipient: RECIPIENT, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(/empty/);
    expect(await usageCount()).toBe(0);
  });

  it("starts a studio checkout after the shop has used its own site cap", async () => {
    const shop = { visitor: 40, global: 1 };
    expect((await count("checkout", shop)).ok).toBe(true);
    asVisitor("198.51.100.20");
    expect(await count("checkout", shop)).toEqual({ ok: false, reason: "global" });
    await expect(assertCheckoutStartAllowed("live", "live", "ada")).resolves.toBeUndefined();
    await seedCart("ada");
    const started = await startCheckout("ada", { recipient: RECIPIENT, shippingMethod: "STANDARD" });
    expect(started.orderId).toEqual(expect.any(String));
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
