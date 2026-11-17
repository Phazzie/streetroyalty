import { describe, expect, it } from "vitest";
import type { RackPiece } from "../../lib/social/types.ts";
import { awningColors, isLime } from "./awning.ts";
import { crownCut } from "./crown-cut.ts";

function piece(palette: string[]): RackPiece {
  return { palette } as RackPiece;
}

describe("a maker's own crown", () => {
  it("is the same every time for the same handle, whatever the case", () => {
    expect(crownCut("ada")).toEqual(crownCut("ada"));
    expect(crownCut("Ada")).toEqual(crownCut("ada"));
  });

  it("differs between makers", () => {
    const cuts = ["ada", "bo", "cy", "dee", "rack_tester", "maker2", "second_act", "quiet"].map(
      (handle) => crownCut(handle).path,
    );
    expect(new Set(cuts).size).toBe(cuts.length);
  });

  it("always draws a closed crown with three to five points inside its box", () => {
    for (const handle of ["a", "ada", "zz_top_99", "x".repeat(20), ""]) {
      const cut = crownCut(handle);
      expect(cut.path.startsWith("M2 18.5 L")).toBe(true);
      expect(cut.path.endsWith("L30 18.5 Z")).toBe(true);
      const numbers = cut.path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.every((value) => value >= 0 && value <= 32)).toBe(true);
      // Start, then a tip, then a valley and a tip for each further point, then the end.
      const points = (cut.path.match(/L/g)?.length ?? 0) / 2;
      expect([3, 4, 5]).toContain(points);
      expect(cut.card).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.abs(cut.tilt)).toBeLessThanOrEqual(5);
    }
  });
});

describe("the awning over a maker's window", () => {
  it("is striped in the colours they use most, most used first", () => {
    const colors = awningColors([
      piece(["#000000", "#3d6bff"]),
      piece(["#ff2d95", "#3d6bff"]),
      piece(["#000000", "#3d6bff", "#ffffff"]),
    ]);
    expect(colors).toEqual(["#3d6bff", "#000000", "#ff2d95", "#ffffff"]);
  });

  it("leaves lime off the stripes, because lime only ever means tap this", () => {
    for (const lime of ["#d6ff3c", "#d7ff3d", "#c8f02c", "#bfff00"])
      expect(isLime(lime)).toBe(true);
    for (const other of ["#ff2d95", "#3d6bff", "#ffb020", "#f5ebdd", "#14081c", "#1f9d5c", "bad"])
      expect(isLime(other), other).toBe(false);
    const colors = awningColors([piece(["#d6ff3c", "#ff2d95"]), piece(["#d6ff3c", "#000000"])]);
    expect(colors).toEqual(["#ff2d95", "#000000"]);
    // A maker who prints in nothing but lime still gets two stripes, from their crown.
    expect(awningColors([piece(["#d6ff3c"])], "cy")).toEqual([crownCut("cy").card, "#14081c"]);
  });

  it("stops at five stripes", () => {
    const colors = awningColors([
      piece(["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"]),
    ]);
    expect(colors).toHaveLength(5);
  });

  it("falls back to the maker's crown card and ink when the rack is empty", () => {
    const colors = awningColors([], "ada");
    expect(colors).toEqual([crownCut("ada").card, "#14081c"]);
    expect(awningColors([piece(["#abcdef"])], "ada")).toHaveLength(2);
  });
});
