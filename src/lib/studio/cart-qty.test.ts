import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartDelta, normalizeCartQuantity } from "./cart-qty.ts";

describe("cart quantity", () => {
  it("clamps a big number, rounds halves, and removes zero", () => {
    assert.equal(normalizeCartQuantity(11), 10);
    assert.equal(normalizeCartQuantity(1.4), 1);
    assert.equal(normalizeCartQuantity(0), null);
    assert.equal(normalizeCartQuantity(-3), null);
    assert.throws(() => normalizeCartQuantity(Number.NaN), /number/);
    assert.throws(() => normalizeCartQuantity(Number.POSITIVE_INFINITY), /number/);
  });

  it("only accepts a single step", () => {
    assert.equal(cartDelta(1), 1);
    assert.equal(cartDelta(-1), -1);
    assert.throws(() => cartDelta(2), /one/);
  });
});
