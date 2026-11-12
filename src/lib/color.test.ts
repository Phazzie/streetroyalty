import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { luminance } from "./color.ts";

describe("luminance", () => {
  it("treats white as bright and black as dark", () => {
    assert.ok(luminance("#ffffff") > 0.9);
    assert.ok(luminance("#000000") < 0.01);
    assert.equal(luminance("nope"), 0);
  });
});