import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney } from "./money.ts";

describe("formatMoney", () => {
  it("prints dollars and treats a bad number as zero", () => {
    assert.equal(formatMoney(2790), "$27.90");
    assert.equal(formatMoney(Number.NaN), "$0.00");
    assert.equal(formatMoney(Number.POSITIVE_INFINITY), "$0.00");
  });
});