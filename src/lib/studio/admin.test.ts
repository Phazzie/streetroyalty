import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStudioAdmin } from "./admin.ts";

describe("isStudioAdmin", () => {
  it("fails closed until an allow list names the caller", () => {
    assert.equal(isStudioAdmin("owner@shop.test", undefined), false);
    assert.equal(isStudioAdmin("owner@shop.test", ""), false);
    assert.equal(isStudioAdmin(null, "owner@shop.test"), false);
    assert.equal(isStudioAdmin("buyer@shop.test", "owner@shop.test"), false);
    assert.equal(isStudioAdmin("Owner@Shop.test", "owner@shop.test, other@shop.test"), true);
  });
});
