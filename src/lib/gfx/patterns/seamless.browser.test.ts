import { describe, expect, it } from "vitest";
import {
  PATTERNS,
  defaultSpec,
  drawPattern,
  drawPatternTile,
  patternDataUrl,
  patternDataUrlUnder,
  patternTileDataUrl,
  tileSize,
  type PatternSpec,
} from "./index.ts";

/**
 * The patterns are drawn on a canvas, so these run in a real browser. A tile is
 * seamless when the step across its edge is no rougher than the steps inside it.
 */

const TILE = 192;
const SEEDS = [1, 77, 90210];

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  return { canvas, ctx };
}

function tilePixels(spec: PatternSpec, size = TILE): Uint8ClampedArray {
  const { ctx } = canvasOf(size, size);
  drawPatternTile(ctx, spec, size);
  return ctx.getImageData(0, 0, size, size).data;
}

/** Mean colour difference between two columns (or two rows) of a square picture. */
function lineGap(
  data: Uint8ClampedArray,
  size: number,
  a: number,
  b: number,
  axis: "x" | "y",
): number {
  let total = 0;
  for (let step = 0; step < size; step += 1) {
    const first = axis === "x" ? (step * size + a) * 4 : (a * size + step) * 4;
    const second = axis === "x" ? (step * size + b) * 4 : (b * size + step) * 4;
    for (let channel = 0; channel < 3; channel += 1)
      total += Math.abs(data[first + channel]! - data[second + channel]!);
  }
  return total / (size * 3);
}

/** How rough the edge is next to the roughest neighbouring pair inside. At or under 1 is seamless. */
function seamScore(data: Uint8ClampedArray, size: number, axis: "x" | "y"): number {
  let roughest = 0;
  for (let line = 0; line < size - 1; line += 1)
    roughest = Math.max(roughest, lineGap(data, size, line, line + 1, axis));
  return lineGap(data, size, size - 1, 0, axis) / (roughest + 0.5);
}

describe("every pattern tile", () => {
  for (const pattern of PATTERNS) {
    for (const seed of SEEDS) {
      it(`${pattern.id} seed ${seed} meets itself left to right and top to bottom`, () => {
        const data = tilePixels(defaultSpec(pattern.id, seed));
        expect(seamScore(data, TILE, "x")).toBeLessThanOrEqual(1.05);
        expect(seamScore(data, TILE, "y")).toBeLessThanOrEqual(1.05);
      });
    }

    it(`${pattern.id} draws the same pixels every time and leaves no hole`, () => {
      const spec = defaultSpec(pattern.id, 4242);
      const first = tilePixels(spec);
      const second = tilePixels(spec);
      expect(first.length).toBe(TILE * TILE * 4);
      let differing = 0;
      let seeThrough = 0;
      for (let index = 0; index < first.length; index += 4) {
        if (first[index + 3] !== 255) seeThrough += 1;
        if (
          first[index] !== second[index] ||
          first[index + 1] !== second[index + 1] ||
          first[index + 2] !== second[index + 2]
        )
          differing += 1;
      }
      expect(differing).toBe(0);
      expect(seeThrough).toBe(0);
    });

    it(`${pattern.id} changes with the seed and uses more than its ground colour`, () => {
      const first = tilePixels(defaultSpec(pattern.id, 5));
      const second = tilePixels(defaultSpec(pattern.id, 6));
      let moved = 0;
      const seen = new Set<number>();
      for (let index = 0; index < first.length; index += 4) {
        if (first[index] !== second[index] || first[index + 1] !== second[index + 1]) moved += 1;
        seen.add((first[index]! << 16) | (first[index + 1]! << 8) | first[index + 2]!);
      }
      expect(moved).toBeGreaterThan(TILE * 4);
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });
  }
});

describe("the seam check itself", () => {
  it("catches a tile that was cut in the wrong place", () => {
    // a crop out of the middle of a bigger tile does not repeat, and the score has to say so
    const { canvas, ctx } = canvasOf(300, 300);
    drawPatternTile(ctx, defaultSpec("tiger", 3), 300);
    const cut = canvasOf(TILE, TILE);
    cut.ctx.drawImage(canvas, -37, -53);
    const data = cut.ctx.getImageData(0, 0, TILE, TILE).data;
    expect(Math.max(seamScore(data, TILE, "x"), seamScore(data, TILE, "y"))).toBeGreaterThan(1.5);
  });
});

describe("drawPattern", () => {
  it("repeats the tile exactly, from the middle of the area", () => {
    const spec = defaultSpec("crowns", 12);
    const tile = tilePixels(spec, 96);
    const { ctx } = canvasOf(240, 192);
    drawPattern(ctx, spec, 240, 192, { unit: 96 });
    const area = ctx.getImageData(0, 0, 240, 192).data;
    let wrong = 0;
    for (let y = 0; y < 192; y += 1) {
      for (let x = 0; x < 240; x += 1) {
        const tx = (((x - 120) % 96) + 96) % 96;
        const ty = (((y - 96) % 96) + 96) % 96;
        const here = (y * 240 + x) * 4;
        const there = (ty * 96 + tx) * 4;
        if (
          area[here] !== tile[there] ||
          area[here + 1] !== tile[there + 1] ||
          area[here + 2] !== tile[there + 2]
        )
          wrong += 1;
      }
    }
    expect(wrong).toBe(0);
  });

  it("honours scale, and a unit that grows with the canvas keeps the look", () => {
    const spec = { ...defaultSpec("checker", 2), scale: 2 };
    expect(tileSize(spec, 100)).toBe(200);
    expect(tileSize({ ...spec, scale: 0.5 })).toBe(128);
    const small = canvasOf(100, 100);
    drawPattern(small.ctx, spec, 100, 100, { unit: 50 });
    const large = canvasOf(400, 400);
    drawPattern(large.ctx, spec, 400, 400, { unit: 200 });
    // the same spot on the cloth has the same colour in the preview and in the big one
    for (const [u, v] of [
      [0.13, 0.13],
      [0.4, 0.2],
      [0.62, 0.87],
      [0.9, 0.4],
    ] as const) {
      const a = small.ctx.getImageData(Math.floor(u * 100), Math.floor(v * 100), 1, 1).data;
      const b = large.ctx.getImageData(Math.floor(u * 400), Math.floor(v * 400), 1, 1).data;
      expect([a[0], a[1], a[2]]).toEqual([b[0], b[1], b[2]]);
    }
  });

  it("fills every pixel when turned, stays inside its area, and is the same twice", () => {
    const spec = { ...defaultSpec("razor", 8), rotation: 33, scale: 0.6 };
    const shot = () => {
      const { ctx } = canvasOf(220, 160);
      drawPattern(ctx, spec, 180, 120, { unit: 120 });
      return ctx.getImageData(0, 0, 220, 160).data;
    };
    const first = shot();
    const second = shot();
    let holes = 0;
    let spill = 0;
    let differing = 0;
    for (let y = 0; y < 160; y += 1) {
      for (let x = 0; x < 220; x += 1) {
        const index = (y * 220 + x) * 4;
        const inside = x < 180 && y < 120;
        if (inside && first[index + 3] !== 255) holes += 1;
        if (!inside && first[index + 3] !== 0) spill += 1;
        if (first[index] !== second[index] || first[index + 3] !== second[index + 3])
          differing += 1;
      }
    }
    expect(holes).toBe(0);
    expect(spill).toBe(0);
    expect(differing).toBe(0);
  });

  it("draws the default pattern for a spec it cannot read, instead of throwing", () => {
    const { ctx } = canvasOf(64, 64);
    expect(() => drawPattern(ctx, { id: "plaid" } as unknown as PatternSpec, 64, 64)).not.toThrow();
    expect(ctx.getImageData(10, 10, 1, 1).data[3]).toBe(255);
  });
});

describe("data URLs", () => {
  it("makes a PNG of the area and of one tile", () => {
    const spec = defaultSpec("halftone", 5);
    expect(patternDataUrl(spec, 120, 80)).toMatch(/^data:image\/png;base64,/);
    expect(patternTileDataUrl(spec, 64)).toMatch(/^data:image\/png;base64,/);
    expect(patternDataUrl(spec, 120, 80)).toBe(patternDataUrl(spec, 120, 80));
  });

  it("shrinks a picture until it fits the limit it was given", () => {
    const spec = defaultSpec("camo", 9);
    const roomy = patternDataUrlUnder(spec, 900, 900, 1_300_000, { unit: 400 });
    expect(roomy.width).toBe(900);
    expect(roomy.dataUrl.length).toBeLessThanOrEqual(1_300_000);
    const tight = patternDataUrlUnder(spec, 900, 900, 30_000, { unit: 400 });
    expect(tight.dataUrl.length).toBeLessThanOrEqual(30_000);
    expect(tight.width).toBeLessThanOrEqual(900);
    expect(tight.dataUrl).toMatch(/^data:image\/(webp|png);base64,/);
  });
});
