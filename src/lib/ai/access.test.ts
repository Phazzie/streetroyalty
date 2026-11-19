import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isUnauthorized } from "./access.ts";

describe("a signed-out AI refusal", () => {
  it("recognises the auth middleware's refusal and nothing else", () => {
    assert.equal(isUnauthorized(null), false);
    assert.equal(isUnauthorized("Unauthorized"), true);
    assert.equal(isUnauthorized("unauthorized"), false);
    assert.equal(isUnauthorized(new Error("The studio hit today's art limit.")), false);
    assert.equal(isUnauthorized(new Error("Unauthorized request")), false);
    assert.equal(isUnauthorized(new Error("Unauthorized")), true);
    assert.equal(isUnauthorized({ name: "UnauthorizedError", message: "nope" }), true);
    assert.equal(isUnauthorized({ status: 401, message: "missing" }), true);
    assert.equal(isUnauthorized({ status: 500, message: "down" }), false);
  });
});
