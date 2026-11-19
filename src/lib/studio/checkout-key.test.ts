import { describe, expect, it } from "vitest";
import type { Recipient } from "../pod/types.ts";
import { checkoutAttemptKey } from "./checkout-key.ts";

const RECIPIENT: Recipient = {
  name: "Ada Royal",
  address1: "1 Crown St",
  city: "Brooklyn",
  stateCode: "NY",
  countryCode: "US",
  zip: "11201",
  email: "ada@example.com",
};

const LINE = { designId: "d1", variantId: "v1", quantity: 1 };

describe("checkout attempt key", () => {
  it("matches a retry and changes when the cart or the account changes", () => {
    const first = checkoutAttemptKey("ada", [LINE], "STANDARD", RECIPIENT);
    const again = checkoutAttemptKey(
      "ada",
      [{ ...LINE, colorwayId: undefined }],
      "STANDARD",
      RECIPIENT,
    );
    expect(again).toBe(first);
    expect(checkoutAttemptKey("bo", [LINE], "STANDARD", RECIPIENT)).not.toBe(first);
    expect(checkoutAttemptKey("ada", [{ ...LINE, quantity: 2 }], "STANDARD", RECIPIENT)).not.toBe(
      first,
    );
    expect(checkoutAttemptKey("ada", [LINE], "EXPRESS", RECIPIENT)).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
