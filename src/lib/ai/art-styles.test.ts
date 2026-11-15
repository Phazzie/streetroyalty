import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ART_STYLES, artPrompt, isArtStyle } from "./art-styles.ts";

describe("art styles", () => {
  it("knows its own styles and nothing else", () => {
    for (const style of ART_STYLES) assert.equal(isArtStyle(style.id), true);
    assert.equal(isArtStyle("oil"), false);
    assert.equal(isArtStyle(undefined), false);
  });
  it("always asks for a flat white backdrop so the art can be cut out", () => {
    for (const style of ART_STYLES) {
      assert.match(artPrompt("a panther in a crown", style.id), /pure flat white background/);
    }
  });
  it("keeps the idea inside one pair of quotes", () => {
    const prompt = artPrompt('a "crown"\n  on fire', "ink");
    assert.match(prompt, /"a 'crown' on fire"/);
    assert.equal(prompt.split('"').length, 3);
  });
});
