import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_LIMIT_MESSAGE,
  CHECKOUT_START_CAP,
  metersLiveCheckout,
} from "./checkout-limit.ts";

describe("studio checkout metering", () => {
  it("uses the same cap and refusal as the shop", () => {
    expect(CHECKOUT_START_CAP).toEqual({ visitor: 40, global: 5000 });
    expect(CHECKOUT_LIMIT_MESSAGE).toBe("Too many checkouts started today. Try again tomorrow.");
  });

  it("meters a live printer with live payment, and nothing that cannot open a draft", () => {
    expect(metersLiveCheckout("live", "live")).toBe(true);
    expect(metersLiveCheckout("live", "sandbox")).toBe(false);
    expect(metersLiveCheckout("sandbox", "live")).toBe(false);
    expect(metersLiveCheckout("sandbox", "sandbox")).toBe(false);
  });

  it("counts a studio start on its own kind, after one price and before the printer", () => {
    const orders = readFileSync("src/lib/studio/orders.server.ts", "utf8");
    const from = orders.indexOf("export async function startCheckout");
    const to = orders.indexOf("export function dbStore");
    const body = orders.slice(from, to);
    const price = body.indexOf("await priceCart(");
    const meter = body.indexOf("await assertCheckoutStartAllowed(");
    const rates = body.indexOf("shippingRates(");
    const draft = body.indexOf("createDraftOrder(");
    expect(price).toBeGreaterThan(-1);
    expect(meter).toBeGreaterThan(price);
    expect(rates).toBeGreaterThan(meter);
    expect(draft).toBeGreaterThan(meter);
    expect(body.match(/priceCart\(/g)).toHaveLength(1);
    const shop = readFileSync("src/lib/storefront/api.ts", "utf8");
    expect(shop).toContain('count("checkout"');
    expect(readFileSync("src/lib/studio/checkout-limit.ts", "utf8")).toContain(
      'count(STUDIO_CHECKOUT_KIND',
    );
  });
});
