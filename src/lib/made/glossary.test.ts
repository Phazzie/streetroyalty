import { describe, expect, it } from "vitest";
import { ENTRIES, JARGON, wordCount } from "./glossary.ts";

describe("the field guide", () => {
  it("covers every word the owner asked about, once each", () => {
    expect(ENTRIES.map((entry) => entry.id)).toEqual([
      "dtg",
      "dtf",
      "embroidery",
      "puff",
      "all-over",
      "cut-and-sew",
      "screen",
      "blank",
      "colourway",
      "mockup",
      "print-area",
      "dpi",
      "made-to-order",
    ]);
  });

  it("keeps every entry to 60 words", () => {
    for (const entry of ENTRIES) {
      expect(wordCount(entry.body), entry.id).toBeLessThanOrEqual(60);
      expect(wordCount(entry.body), entry.id).toBeGreaterThan(15);
    }
  });

  it("uses no trade words, exclamation marks or shouting", () => {
    for (const entry of ENTRIES) {
      const text = `${entry.name} ${entry.body}`.toLowerCase();
      for (const word of JARGON) {
        expect(text.split(/[^a-z]+/), `${entry.id} says ${word}`).not.toContain(word);
      }
      expect(entry.body, entry.id).not.toContain("!");
    }
  });

  it("describes every drawing for people who cannot see it", () => {
    for (const entry of ENTRIES) {
      expect(entry.drawing.length, entry.id).toBeGreaterThan(20);
    }
  });

  it("counts words", () => {
    expect(wordCount("  one two   three ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
