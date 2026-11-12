import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { designVisualKey } from "./design-key.ts";

describe("designVisualKey", () => {
  it("changes when the picture changes and stays put when it does not", () => {
    const base = {
      productId: "tee",
      variantId: "black-m",
      placement: "front",
      layers: [{ id: "a", text: "SR" }],
    };
    assert.equal(
      designVisualKey(base),
      designVisualKey({ ...base, layers: [{ id: "a", text: "SR" }] }),
    );
    assert.notEqual(designVisualKey(base), designVisualKey({ ...base, variantId: "white-m" }));
    assert.notEqual(designVisualKey(base), designVisualKey({ ...base, placement: "back" }));
    assert.notEqual(
      designVisualKey(base),
      designVisualKey({ ...base, layers: [{ id: "a", text: "NOW" }] }),
    );
  });
});
