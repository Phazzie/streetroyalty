import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { fallbackName, wrapTitle } from "./drop-card.ts";

describe("drop card text", () => {
  it("keeps a short title on one line", () => {
    assert.deepEqual(wrapTitle("NIGHT SHIFT", 16, 2), ["NIGHT SHIFT"]);
  });
  it("wraps on word edges", () => {
    assert.deepEqual(wrapTitle("CROWN NEVER CAME OFF", 12, 2), ["CROWN NEVER", "CAME OFF"]);
  });
  it("marks a title that does not fit with an ellipsis", () => {
    const lines = wrapTitle("ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT", 9, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1].endsWith("…"), lines[1]);
    assert.ok(lines.every((line) => line.length <= 10));
  });
  it("cuts a single word that is longer than a line", () => {
    const lines = wrapTitle("SUPERCALIFRAGILISTIC", 8, 2);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].length <= 8 && lines[0].endsWith("…"));
  });
  it("marks the cut when the last word is the one that does not fit", () => {
    assert.deepEqual(wrapTitle("BLACK HEAVYWEIGHT HOODIE", 16, 2), ["BLACK", "HEAVYWEIGHT…"]);
  });
  it("returns nothing for an empty title", () => {
    assert.deepEqual(wrapTitle("   ", 10, 2), []);
  });
  it("names an unnamed look from its first words", () => {
    assert.equal(
      fallbackName("black oversized hoodie, cream cargo trousers"),
      "black oversized hoodie",
    );
    assert.equal(fallbackName("  "), "Untitled look");
  });
});
