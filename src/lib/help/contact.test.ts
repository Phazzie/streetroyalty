import { describe, expect, it } from "vitest";
import { DEFAULT_SHOP_EMAIL, shopEmail } from "./contact.ts";

describe("shopEmail", () => {
  it("uses SHOP_EMAIL when it is a real address, else the shop's inbox", () => {
    expect(shopEmail({ SHOP_EMAIL: " help@example.com " })).toBe("help@example.com");
    expect(shopEmail({ SHOP_EMAIL: "not an email" })).toBe(DEFAULT_SHOP_EMAIL);
    expect(shopEmail({})).toBe("chey@cheysociety.com");
  });
});
