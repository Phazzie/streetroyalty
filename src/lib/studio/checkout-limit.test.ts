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

  it("beginCheckout checks the cap before it creates an order", () => {
    const text = readFileSync("src/lib/studio/api.ts", "utf8");
    const start = text.indexOf("export const beginCheckout");
    const next = text.indexOf("export const", start + 1);
    const body = text.slice(start, next === -1 ? undefined : next);
    const gate = body.indexOf("await gateLiveCheckout(");
    const create = body.indexOf("startCheckout(");
    expect(gate).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(gate);
    expect(body).toContain("context.userId");
    const helper = readFileSync("src/lib/studio/checkout-limit.ts", "utf8");
    const ready = helper.indexOf("export async function gateLiveCheckout");
    const parseAt = helper.indexOf("parseRecipient(recipient)", ready);
    const priceAt = helper.indexOf("priceCart(userId)", ready);
    const countAt = helper.indexOf("assertCheckoutStartAllowed(", ready);
    expect(parseAt).toBeGreaterThan(ready);
    expect(priceAt).toBeGreaterThan(parseAt);
    expect(countAt).toBeGreaterThan(priceAt);
  });
});
