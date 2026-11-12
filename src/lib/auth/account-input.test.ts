import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountInputError } from "./account-input.ts";

describe("accountInputError", () => {
  it("rejects a bad email, a short password, and a blank-padded password", () => {
    assert.match(accountInputError({ mode: "in", email: "not-an-email", password: "longenough", name: "" }) ?? "", /email/);
    assert.match(accountInputError({ mode: "up", email: "a@b.co", password: "short", name: "Ada" }) ?? "", /8/);
    assert.match(accountInputError({ mode: "in", email: "a@b.co", password: "        ", name: "" }) ?? "", /8/);
    assert.equal(accountInputError({ mode: "up", email: "ada@shop.test", password: "longenough", name: "Ada" }), null);
  });
});
