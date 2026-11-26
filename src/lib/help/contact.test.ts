import { describe, expect, it } from "vitest";
import { DEFAULT_SHOP_EMAIL, shopEmail } from "./contact";

describe("shopEmail", () => {
  it("uses the shop's own inbox when nothing is set", () => {
    expect(shopEmail({})).toBe(DEFAULT_SHOP_EMAIL);
    expect(shopEmail({ SHOP_EMAIL: "not an email" })).toBe(DEFAULT_SHOP_EMAIL);
  });
  it("lets SHOP_EMAIL override it", () => {
    expect(shopEmail({ SHOP_EMAIL: " help@example.org " })).toBe("help@example.org");
  });
});
