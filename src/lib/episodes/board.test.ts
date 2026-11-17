import { describe, expect, it } from "vitest";
import {
  BOARD_HEIGHT,
  BOARD_SLOTS,
  BOARD_WIDTH,
  boardFileName,
  boardLayout,
  containRect,
  inkOn,
  samplePalette,
} from "./board.ts";

describe("boardLayout", () => {
  const layout = boardLayout();

  it("is always the same six cells inside the board", () => {
    expect(layout.cells).toHaveLength(BOARD_SLOTS);
    expect(boardLayout()).toEqual(layout);
    for (const cell of layout.cells) {
      expect(cell.frame.x).toBeGreaterThanOrEqual(0);
      expect(cell.frame.y).toBeGreaterThan(layout.header.y + layout.header.h);
      expect(cell.frame.x + cell.frame.w).toBeLessThanOrEqual(BOARD_WIDTH);
      expect(cell.frame.y + cell.frame.h).toBeLessThanOrEqual(BOARD_HEIGHT);
      expect(cell.picture.w + cell.caption.w).toBeCloseTo(cell.frame.w);
    }
  });

  it("never lets two cells overlap", () => {
    for (const a of layout.cells) {
      for (const b of layout.cells) {
        if (a.index >= b.index) continue;
        const apart =
          a.frame.x + a.frame.w <= b.frame.x ||
          b.frame.x + b.frame.w <= a.frame.x ||
          a.frame.y + a.frame.h <= b.frame.y ||
          b.frame.y + b.frame.h <= a.frame.y;
        expect(apart).toBe(true);
      }
    }
  });
});

describe("containRect", () => {
  it("fits a tall picture in a square without stretching it", () => {
    expect(containRect({ x: 0, y: 0, w: 100, h: 100 }, 50, 100)).toEqual({
      x: 25,
      y: 0,
      w: 50,
      h: 100,
    });
  });

  it("returns the box for a picture with no size", () => {
    expect(containRect({ x: 1, y: 2, w: 3, h: 4 }, 0, 0)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});

function pixels(
  width: number,
  height: number,
  paint: (x: number, y: number) => number[],
): number[] {
  const out: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) out.push(...paint(x, y));
  }
  return out;
}

describe("samplePalette", () => {
  it("finds the garment colours, biggest first, and leaves the backdrop out", () => {
    // White backdrop, a lilac body and a smaller cream panel.
    const data = pixels(20, 20, (x, y) => {
      if (x < 2 || x > 17 || y < 2 || y > 17) return [255, 255, 255, 255];
      if (x > 13) return [243, 234, 217, 255];
      return [185, 163, 238, 255];
    });
    expect(samplePalette(data, 20, 20)).toEqual(["#b9a3ee", "#f3ead9"]);
  });

  it("skips see-through pixels", () => {
    const data = pixels(10, 10, (x, y) => {
      if (x < 3) return [0, 0, 0, 0];
      if (x > 7 || y < 1 || y > 8) return [255, 255, 255, 255];
      return [255, 45, 149, 255];
    });
    expect(samplePalette(data, 10, 10)).toEqual(["#ff2d95"]);
  });

  it("counts the whole picture when the garment fills the frame", () => {
    const data = pixels(10, 10, () => [18, 52, 58, 255]);
    expect(samplePalette(data, 10, 10)).toEqual(["#12343a"]);
  });

  it("merges near-identical shades and ignores slivers", () => {
    const data = pixels(20, 20, (x, y) => {
      if (y === 0 || y === 19 || x === 0 || x === 19) return [255, 255, 255, 255];
      if (x === 10 && y === 10) return [255, 0, 0, 255];
      return x % 2 === 0 ? [20, 60, 60, 255] : [22, 62, 62, 255];
    });
    expect(samplePalette(data, 20, 20)).toHaveLength(1);
  });

  it("returns nothing for an empty or short buffer", () => {
    expect(samplePalette([], 0, 0)).toEqual([]);
    expect(samplePalette([1, 2, 3], 4, 4)).toEqual([]);
  });
});

describe("inkOn and boardFileName", () => {
  it("picks ink that reads on the swatch", () => {
    expect(inkOn("#f3ead9")).toBe("#17101f");
    expect(inkOn("#2a2a2e")).toBe("#fffaf2");
    expect(inkOn("nope")).toBe("#17101f");
  });

  it("names the download after the character", () => {
    expect(boardFileName("Big Rey!")).toBe("wardrobe-big-rey.png");
    expect(boardFileName("")).toBe("wardrobe-character.png");
  });
});
