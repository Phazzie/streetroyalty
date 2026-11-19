import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { designVisualKey } from "./design-key.ts";
import { defaultGarment, setPanelFill } from "./garments.ts";

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

  it("changes when an all-over panel or colorway changes, so a stale mockup is dropped", () => {
    const base = { productId: "aop-hoodie", variantId: "m", placement: "front", layers: [] };
    const garment = defaultGarment("aop-hoodie");
    const key = designVisualKey({ ...base, garment });
    assert.equal(key, designVisualKey({ ...base, garment: defaultGarment("aop-hoodie") }));
    const checker = setPanelFill(garment, "side_left", {
      kind: "pattern",
      pattern: "checker",
      hex: "#141414",
      accent: "#c6a15b",
    });
    assert.notEqual(key, designVisualKey({ ...base, garment: checker }));
    assert.notEqual(
      key,
      designVisualKey({ ...base, garment: { ...garment, activeColorwayId: "black-gold" } }),
    );
    assert.equal(designVisualKey(base), designVisualKey({ ...base, garment: null }));
  });
});
