import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  cornerColor,
  coverage,
  halftone,
  hexToRgb,
  inkLightMarks,
  knockout,
  darkBackdrop,
  oneColor,
  type Pixels,
  type Rgb,
} from "./effects.ts";

function canvas(width: number, height: number, fill: Rgb): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let at = 0; at < data.length; at += 4) {
    data[at] = fill[0];
    data[at + 1] = fill[1];
    data[at + 2] = fill[2];
    data[at + 3] = 255;
  }
  return { data, width, height };
}

function paint(pixels: Pixels, x0: number, y0: number, x1: number, y1: number, color: Rgb) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * pixels.width + x) * 4;
      pixels.data[at] = color[0];
      pixels.data[at + 1] = color[1];
      pixels.data[at + 2] = color[2];
    }
  }
}

function alphaAt(pixels: Pixels, x: number, y: number): number {
  return pixels.data[(y * pixels.width + x) * 4 + 3];
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const LIME: Rgb = [214, 255, 60];

describe("hexToRgb", () => {
  it("reads long and short hex and falls back to black", () => {
    assert.deepEqual(hexToRgb("#d6ff3c"), [214, 255, 60]);
    assert.deepEqual(hexToRgb("fff"), [255, 255, 255]);
    assert.deepEqual(hexToRgb("nope"), [0, 0, 0]);
  });
});

describe("knockout", () => {
  it("removes the backdrop that touches the edge and keeps the art", () => {
    const art = canvas(40, 40, WHITE);
    paint(art, 10, 10, 30, 30, BLACK);
    const out = knockout(art);
    assert.deepEqual(cornerColor(art), WHITE);
    assert.equal(alphaAt(out, 0, 0), 0);
    assert.equal(alphaAt(out, 5, 20), 0);
    assert.equal(alphaAt(out, 20, 20), 255);
  });
  it("keeps backdrop-coloured areas that are sealed inside the art", () => {
    const art = canvas(40, 40, WHITE);
    paint(art, 8, 8, 32, 32, BLACK);
    paint(art, 16, 16, 24, 24, WHITE);
    const out = knockout(art);
    assert.equal(alphaAt(out, 20, 20), 255);
    assert.equal(out.data[(20 * 40 + 20) * 4], 255);
    assert.equal(alphaAt(out, 2, 2), 0);
  });
  it("leaves dark art alone when the picture is cut out a second time", () => {
    const art = canvas(40, 40, WHITE);
    paint(art, 10, 10, 30, 30, BLACK);
    const once = knockout(art);
    const twice = knockout(once);
    assert.equal(alphaAt(twice, 20, 20), 255);
    assert.equal(alphaAt(twice, 11, 11), 255);
    assert.equal(alphaAt(twice, 2, 2), 0);
    assert.deepEqual([...twice.data], [...once.data]);
  });
  it("does not change the input buffer", () => {
    const art = canvas(10, 10, WHITE);
    knockout(art);
    assert.equal(alphaAt(art, 0, 0), 255);
  });
  it("tolerates a backdrop that is not perfectly flat", () => {
    const art = canvas(30, 30, [250, 248, 244]);
    paint(art, 0, 0, 30, 4, [242, 240, 236]);
    paint(art, 10, 10, 20, 20, [20, 20, 20]);
    const out = knockout(art);
    assert.equal(alphaAt(out, 15, 1), 0);
    assert.equal(alphaAt(out, 15, 15), 255);
  });
});

describe("oneColor", () => {
  it("prints dark areas in the ink and leaves light areas bare", () => {
    const art = canvas(4, 1, WHITE);
    paint(art, 0, 0, 2, 1, BLACK);
    const out = oneColor(art, LIME);
    assert.deepEqual([...out.data.slice(0, 4)], [214, 255, 60, 255]);
    assert.equal(alphaAt(out, 3, 0), 0);
  });
  it("prints the light areas when inverted", () => {
    const art = canvas(4, 1, BLACK);
    paint(art, 0, 0, 2, 1, WHITE);
    const out = oneColor(art, LIME, { invert: true });
    assert.equal(alphaAt(out, 0, 0), 255);
    assert.equal(alphaAt(out, 3, 0), 0);
  });
  it("leaves already transparent pixels bare either way", () => {
    const art = canvas(2, 1, BLACK);
    art.data[3] = 0;
    assert.equal(alphaAt(oneColor(art, LIME), 0, 0), 0);
    assert.equal(alphaAt(oneColor(art, LIME, { invert: true }), 0, 0), 0);
  });
});

describe("halftone", () => {
  it("prints nothing for white and nearly everything for black", () => {
    assert.equal(coverage(halftone(canvas(60, 60, WHITE), LIME, { cell: 6 })), 0);
    assert.ok(coverage(halftone(canvas(60, 60, BLACK), LIME, { cell: 6 })) > 0.9);
  });
  it("lays down more ink as the picture gets darker", () => {
    const light = coverage(halftone(canvas(80, 80, [200, 200, 200]), LIME, { cell: 8 }));
    const mid = coverage(halftone(canvas(80, 80, [128, 128, 128]), LIME, { cell: 8 }));
    const dark = coverage(halftone(canvas(80, 80, [50, 50, 50]), LIME, { cell: 8 }));
    assert.ok(light > 0.05 && light < mid, `light ${light} mid ${mid}`);
    assert.ok(mid < dark, `mid ${mid} dark ${dark}`);
    assert.ok(Math.abs(mid - 0.5) < 0.2, `mid grey should be about half covered, got ${mid}`);
  });
  it("makes separate dots, not a flat tint", () => {
    const out = halftone(canvas(60, 60, [128, 128, 128]), LIME, { cell: 10, angle: 0 });
    let bare = 0;
    let solid = 0;
    for (let at = 3; at < out.data.length; at += 4) {
      if (out.data[at] === 0) bare += 1;
      if (out.data[at] === 255) solid += 1;
    }
    assert.ok(bare > 400 && solid > 400, `bare ${bare} solid ${solid}`);
  });
});

describe("darkBackdrop", () => {
  it("spots light art on a dark ground", () => {
    const dark = canvas(20, 20, BLACK);
    paint(dark, 8, 8, 12, 12, WHITE);
    assert.equal(darkBackdrop(dark), true);
  });
  it("treats dark art on a light ground as the usual case", () => {
    const light = canvas(20, 20, WHITE);
    paint(light, 4, 4, 16, 16, BLACK);
    assert.equal(darkBackdrop(light), false);
  });
  it("treats dark art on a transparent ground as the usual case", () => {
    const logo = canvas(20, 20, BLACK);
    for (let at = 3; at < logo.data.length; at += 4) logo.data[at] = 0;
    for (let y = 6; y < 14; y += 1)
      for (let x = 6; x < 14; x += 1) logo.data[(y * 20 + x) * 4 + 3] = 255;
    assert.equal(darkBackdrop(logo), false);
  });
});

describe("inkLightMarks", () => {
  function logo(color: Rgb): Pixels {
    const art = canvas(24, 24, color);
    for (let at = 3; at < art.data.length; at += 4) art.data[at] = 0;
    for (let y = 6; y < 18; y += 1)
      for (let x = 6; x < 18; x += 1) art.data[(y * 24 + x) * 4 + 3] = 255;
    return art;
  }
  it("prints a white logo on a clear backdrop instead of blanking it", () => {
    const white = logo(WHITE);
    assert.equal(inkLightMarks(white), true);
    assert.ok(coverage(oneColor(white, LIME, { invert: inkLightMarks(white) })) > 0.2);
    assert.ok(coverage(halftone(white, LIME, { cell: 4, invert: inkLightMarks(white) })) > 0.15);
  });
  it("prints a black logo on a clear backdrop the usual way", () => {
    const black = logo(BLACK);
    assert.equal(inkLightMarks(black), false);
    assert.ok(coverage(oneColor(black, LIME, { invert: inkLightMarks(black) })) > 0.2);
  });
  it("follows the backdrop when there is one", () => {
    const onDark = canvas(20, 20, BLACK);
    paint(onDark, 8, 8, 12, 12, WHITE);
    assert.equal(inkLightMarks(onDark), true);
    const onLight = canvas(20, 20, WHITE);
    paint(onLight, 8, 8, 12, 12, BLACK);
    assert.equal(inkLightMarks(onLight), false);
  });
});
