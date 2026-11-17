import { afterEach, describe, expect, it, vi } from "vitest";
import { PATTERNS, defaultSpec, type PatternSpec } from "./core.ts";
import { PAINTERS, type Ctx2D } from "./draw.ts";
import {
  draftEdge,
  drawPattern,
  drawPatternTile,
  patternDataUrl,
  patternDataUrlUnder,
  patternTileDataUrl,
  tileSize,
} from "./render.ts";

/**
 * The painters only ever talk to a canvas context, so in node a context that
 * writes down every call stands in for one. The real pixels are checked in
 * seamless.browser.test.ts; here it is the instructions themselves.
 */
function recorder() {
  const calls: string[] = [];
  const bad: string[] = [];
  const colors: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get(_target, key) {
        const name = String(key);
        if (name in state) return state[name];
        if (name === "createPattern") return () => ({ tile: true });
        return (...args: unknown[]) => {
          for (const arg of args.flat()) {
            if (typeof arg === "number" && !Number.isFinite(arg)) bad.push(name);
          }
          calls.push(
            `${name}(${args.map((arg) => (typeof arg === "object" ? "obj" : String(arg))).join(",")})`,
          );
        };
      },
      set(_target, key, value) {
        const name = String(key);
        state[name] = value;
        if (name === "fillStyle" || name === "strokeStyle") {
          if (typeof value === "string") colors.push(value);
        } else if (typeof value === "number" && !Number.isFinite(value)) bad.push(name);
        calls.push(`${name}=${typeof value === "object" ? "obj" : String(value)}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as Ctx2D, calls, bad, colors };
}

const COLOR = /^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+ \/ [\d.]+\))$/;

describe("the painters", () => {
  for (const pattern of PATTERNS) {
    it(`${pattern.id} gives the same instructions for the same seed, and others for another`, () => {
      const run = (seed: number) => {
        const tape = recorder();
        PAINTERS[pattern.id](tape.ctx, 256, [...pattern.defaultColors], seed);
        return tape;
      };
      const first = run(31);
      const again = run(31);
      const other = run(32);
      expect(first.calls.length).toBeGreaterThan(10);
      expect(again.calls).toEqual(first.calls);
      expect(other.calls).not.toEqual(first.calls);
    });

    it(`${pattern.id} never hands the canvas a broken number or colour`, () => {
      for (const seed of [0, 1, 77, 4294967295]) {
        for (const size of [8, 96, 1000]) {
          const tape = recorder();
          PAINTERS[pattern.id](tape.ctx, size, [...pattern.defaultColors], seed);
          expect(tape.bad).toEqual([]);
          expect(tape.colors.length).toBeGreaterThan(0);
          for (const color of tape.colors) expect(color).toMatch(COLOR);
        }
      }
    });

    it(`${pattern.id} lays its ground colour over the whole tile first`, () => {
      const tape = recorder();
      PAINTERS[pattern.id](tape.ctx, 200, [...pattern.defaultColors], 5);
      expect(tape.calls.slice(0, 2)).toEqual([
        `fillStyle=${pattern.defaultColors[0]}`,
        "fillRect(0,0,200,200)",
      ]);
    });

    it(`${pattern.id} uses every colour it asks for`, () => {
      const colors = ["#010101", "#020202", "#030303", "#040404"].slice(0, pattern.colorSlots);
      const used = new Set<string>();
      // an accent can sit out a roll, so look across a few
      for (let seed = 1; seed <= 12; seed += 1) {
        const tape = recorder();
        PAINTERS[pattern.id](tape.ctx, 128, colors, seed);
        for (const color of tape.colors) used.add(color);
      }
      for (const color of colors) expect(used.has(color)).toBe(true);
    });
  }
});

describe("drawPatternTile", () => {
  it("clips to the tile, resets the pen, and puts the context back", () => {
    const tape = recorder();
    drawPatternTile(tape.ctx, defaultSpec("checker", 3), 100.4);
    expect(tape.calls.slice(0, 4)).toEqual([
      "save()",
      "beginPath()",
      "rect(0,0,100,100)",
      "clip()",
    ]);
    expect(tape.calls).toContain("globalAlpha=1");
    expect(tape.calls).toContain("setLineDash(obj)");
    expect(tape.calls.at(-1)).toBe("restore()");
  });

  it("keeps the tile between 8 and 4096 pixels", () => {
    const tiny = recorder();
    drawPatternTile(tiny.ctx, defaultSpec("checker", 3), 0);
    expect(tiny.calls).toContain("rect(0,0,8,8)");
    const huge = recorder();
    drawPatternTile(huge.ctx, defaultSpec("checker", 3), 1e9);
    expect(huge.calls).toContain("rect(0,0,4096,4096)");
  });

  it("draws the default pattern when the spec is not one", () => {
    const tape = recorder();
    drawPatternTile(tape.ctx, { id: "plaid" } as unknown as PatternSpec, 64);
    const fallback = recorder();
    drawPatternTile(fallback.ctx, defaultSpec(), 64);
    expect(tape.calls).toEqual(fallback.calls);
  });
});

describe("drawPattern", () => {
  const made: number[] = [];
  class FakeCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      made.push(width);
    }
    getContext() {
      return recorder().ctx;
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    made.length = 0;
  });

  it("turns about the middle of the area and fills past every corner", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const tape = recorder();
    drawPattern(tape.ctx, { ...defaultSpec("razor", 901), scale: 0.5, rotation: 90 }, 300, 200, {
      unit: 200,
    });
    expect(made).toEqual([100]);
    expect(tape.calls).toContain("rect(0,0,300,200)");
    expect(tape.calls).toContain("translate(150,100)");
    expect(tape.calls).toContain(`rotate(${Math.PI / 2})`);
    expect(tape.calls).toContain("scale(1,1)");
    const reach = Math.hypot(300, 200) / 2 + 2;
    expect(tape.calls).toContain(`fillRect(${-reach},${-reach},${reach * 2},${reach * 2})`);
    expect(tape.calls.at(-1)).toBe("restore()");
  });

  it("keeps a tile it has drawn, so a turn or a second panel costs nothing", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const spec = defaultSpec("camo", 902);
    drawPattern(recorder().ctx, spec, 100, 100);
    drawPattern(recorder().ctx, { ...spec, rotation: 45 }, 640, 480);
    expect(made).toEqual([256]);
    drawPattern(recorder().ctx, { ...spec, seed: 903 }, 100, 100);
    drawPattern(recorder().ctx, { ...spec, colors: ["#000000"] }, 100, 100);
    expect(made).toEqual([256, 256, 256]);
  });

  it("draws a draft at a round size and stretches it", () => {
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const tape = recorder();
    drawPattern(tape.ctx, defaultSpec("tiger", 904), 400, 400, { unit: 300, draft: true });
    expect(made).toEqual([512]);
    expect(tape.calls).toContain(`scale(${300 / 512},${300 / 512})`);
  });

  it("works out the tile size from scale and unit, inside its limits", () => {
    expect(tileSize(defaultSpec("checker"))).toBe(256);
    expect(tileSize({ ...defaultSpec("checker"), scale: 2 }, 100)).toBe(200);
    expect(tileSize({ ...defaultSpec("checker"), scale: 0.25 }, 10)).toBe(8);
    expect(tileSize({ ...defaultSpec("checker"), scale: 4 }, 5000)).toBe(4096);
    expect(tileSize({ id: "plaid" } as unknown as PatternSpec, 90)).toBe(90);
    expect([1, 64, 65, 300, 4000].map(draftEdge)).toEqual([64, 64, 128, 512, 512]);
  });
});

describe("data URLs outside a browser", () => {
  it("say plainly that they need one", () => {
    const spec = defaultSpec("flames", 1);
    expect(() => patternDataUrl(spec, 10, 10)).toThrow(/only be made in a browser/);
    expect(() => patternTileDataUrl(spec, 10)).toThrow(/only be made in a browser/);
    expect(() => patternDataUrlUnder(spec, 10, 10, 1000)).toThrow(/only be made in a browser/);
  });
});
