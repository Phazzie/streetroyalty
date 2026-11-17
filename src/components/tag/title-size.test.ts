import { describe, expect, it } from "vitest";
import { linesFor, SMALLEST_TITLE, titleSize } from "./title-size.ts";

describe("titleSize", () => {
  it("sets a short name big", () => {
    expect(titleSize("Loud")).toBe(0.46);
    expect(titleSize("")).toBe(0.46);
  });

  it("steps down until every word fits on a line", () => {
    expect(titleSize("Do Better Hoodie")).toBe(0.34);
    expect(titleSize("Royal Blue Crown Tee")).toBe(0.34);
    expect(titleSize("Unapologetically")).toBeLessThanOrEqual(0.18);
  });

  it("never grows as a name gets longer", () => {
    let previous = 1;
    let name = "";
    for (let count = 1; count <= 30; count += 1) {
      name = `${name} crown`.trim();
      const size = titleSize(name);
      expect(size).toBeLessThanOrEqual(previous);
      expect(size).toBeGreaterThanOrEqual(SMALLEST_TITLE);
      previous = size;
    }
    expect(previous).toBe(SMALLEST_TITLE);
  });

  it("counts lines the way the tag wraps them", () => {
    expect(linesFor(["do", "better", "hoodie"], 9)).toBe(2);
    expect(linesFor(["do", "better", "hoodie"], 6)).toBe(3);
    expect(linesFor(["royal", "blue", "crown", "tee"], 10)).toBe(2);
    expect(linesFor([], 10)).toBe(0);
  });
});
