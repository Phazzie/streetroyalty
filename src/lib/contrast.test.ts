import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contrastRatio, THEME_PAIRS } from "./contrast.ts";

describe("theme contrast", () => {
  it("keeps every shipped pair at WCAG AA", () => {
    for (const [foreground, background] of THEME_PAIRS) {
      assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  });
});