import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  PATTERNS,
  PATTERN_IDS,
  clashColors,
  decodeSpec,
  defaultSpec,
  encodeSpec,
  fitColors,
  hashUnit,
  hslToHex,
  luminance,
  mixHex,
  mod,
  mulberry32,
  normalizeHex,
  normalizeSpec,
  parseHex,
  resolveColors,
  type PatternSpec,
} from "./core.ts";

describe("the pattern list", () => {
  it("has at least ten patterns, each named once", () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(10);
    expect(PATTERNS.map((pattern) => pattern.id).sort()).toEqual([...PATTERN_IDS].sort());
    expect(new Set(PATTERNS.map((pattern) => pattern.name)).size).toBe(PATTERNS.length);
  });

  it("gives every colour slot a real default colour", () => {
    for (const pattern of PATTERNS) {
      expect(pattern.defaultColors).toHaveLength(pattern.colorSlots);
      expect(pattern.colorSlots).toBeGreaterThanOrEqual(2);
      for (const color of pattern.defaultColors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("mulberry32", () => {
  it("gives the same numbers for the same seed", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    expect(Array.from({ length: 8 }, () => a())).toEqual(Array.from({ length: 8 }, () => b()));
  });

  it("gives different numbers for a different seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("stays from 0 up to 1 and spreads out", () => {
    const random = mulberry32(99);
    const values = Array.from({ length: 2000 }, () => random());
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it("pins the first number, so a pattern cannot change under a saved link", () => {
    expect(mulberry32(1)()).toBeCloseTo(0.6270739405881613, 12);
  });
});

describe("hashUnit", () => {
  it("is steady for a lattice point and differs between points", () => {
    expect(hashUnit(7, 2, 3)).toBe(hashUnit(7, 2, 3));
    expect(hashUnit(7, 2, 3)).not.toBe(hashUnit(7, 3, 2));
    expect(hashUnit(7, 2, 3)).not.toBe(hashUnit(8, 2, 3));
    for (let index = 0; index < 200; index += 1) {
      const value = hashUnit(index, index * 3, -index);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("colour parsing", () => {
  it("reads long and short hex, with or without the hash", () => {
    expect(parseHex("#ff2d95")).toEqual([255, 45, 149]);
    expect(parseHex("FF2D95")).toEqual([255, 45, 149]);
    expect(parseHex("#f0a")).toEqual([255, 0, 170]);
    expect(parseHex("  #000000 ")).toEqual([0, 0, 0]);
  });

  it("turns away anything that is not a colour", () => {
    for (const bad of [
      "",
      "#ff",
      "#gggggg",
      "red",
      "#ff2d9500",
      "rgb(1,2,3)",
      null,
      undefined,
      12,
      {},
    ]) {
      expect(parseHex(bad)).toBeNull();
      expect(normalizeHex(bad)).toBeNull();
    }
  });

  it("normalises to lower-case #rrggbb", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(normalizeHex("#D6FF3C")).toBe("#d6ff3c");
  });

  it("mixes, and clamps the amount", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#ffffff", 0)).toBe("#102030");
    expect(mixHex("#102030", "#ffffff", 4)).toBe("#ffffff");
    expect(mixHex("nope", "#ffffff", 1)).toBe("#ffffff");
  });

  it("knows light from dark", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 6);
    expect(luminance("#d6ff3c")).toBeGreaterThan(luminance("#7c5cff"));
  });

  it("converts hue, saturation and lightness", () => {
    expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
    expect(hslToHex(120, 1, 0.5)).toBe("#00ff00");
    expect(hslToHex(240, 1, 0.5)).toBe("#0000ff");
    expect(hslToHex(-120, 1, 0.5)).toBe("#0000ff");
    expect(hslToHex(40, 0, 1)).toBe("#ffffff");
  });

  it("keeps mod positive", () => {
    expect(mod(-1, 4)).toBe(3);
    expect(mod(9, 4)).toBe(1);
  });
});

describe("clashColors", () => {
  it("returns as many loud, valid colours as asked, the same for the same seed", () => {
    const colors = clashColors(42, 4);
    expect(colors).toHaveLength(4);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(clashColors(42, 4)).toEqual(colors);
    expect(clashColors(43, 4)).not.toEqual(colors);
  });

  it("sets light against dark so neighbours never blur together", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const [first, second] = clashColors(seed, 2) as [string, string];
      expect(Math.abs(luminance(first) - luminance(second))).toBeGreaterThan(0.25);
      expect(first).not.toBe(second);
    }
  });
});

describe("normalizeSpec", () => {
  it("fills in what is missing and clamps what is out of range", () => {
    expect(
      normalizeSpec({ id: "camo", seed: -5.9, colors: ["#fff", "nope"], scale: 99, rotation: -90 }),
    ).toEqual({
      id: "camo",
      seed: 5,
      colors: ["#ffffff", "#2f3b22", "#a89a6a", "#17101f"],
      scale: MAX_SCALE,
      rotation: 270,
    });
    expect(normalizeSpec({ id: "camo", seed: 1, colors: [], scale: 0.01 })?.scale).toBe(MIN_SCALE);
    expect(normalizeSpec({ id: "camo", seed: "x", colors: "no", scale: Number.NaN })).toMatchObject(
      {
        seed: 0,
        scale: 1,
        rotation: 0,
      },
    );
  });

  it("refuses things that are not a spec", () => {
    for (const bad of [null, undefined, 3, "flames", [], { id: "plaid" }, { seed: 2 }]) {
      expect(normalizeSpec(bad)).toBeNull();
    }
  });

  it("drops colours past the pattern's slots and keeps the caller's object untouched", () => {
    const spec: PatternSpec = {
      id: "warp-checker",
      seed: 3,
      colors: ["#111111", "#222222", "#333333"],
      scale: 1,
    };
    expect(normalizeSpec(spec)?.colors).toEqual(["#111111", "#222222"]);
    expect(spec.colors).toHaveLength(3);
  });
});

describe("colour hand-over between patterns", () => {
  it("falls back slot by slot", () => {
    expect(resolveColors("checker", ["#000", undefined, "zzz"])).toEqual([
      "#000000",
      "#17101f",
      "#7c5cff",
    ]);
    expect(resolveColors("checker", undefined)).toEqual(["#f5ebdd", "#17101f", "#7c5cff"]);
  });

  it("repeats colours when the new pattern has more slots, and trims when it has fewer", () => {
    expect(fitColors("flames", ["#111111", "#eeeeee"])).toEqual([
      "#111111",
      "#eeeeee",
      "#111111",
      "#eeeeee",
    ]);
    expect(fitColors("warp-checker", ["#111111", "#222222", "#333333"])).toEqual([
      "#111111",
      "#222222",
    ]);
    expect(fitColors("warp-checker", ["nope"])).toEqual(["#b9a3ee", "#17101f"]);
  });
});

describe("encodeSpec and decodeSpec", () => {
  it("round trips every pattern", () => {
    for (const pattern of PATTERNS) {
      const spec: PatternSpec = {
        id: pattern.id,
        seed: 4294967295,
        colors: [...pattern.defaultColors].reverse(),
        scale: 2.35,
        rotation: 217,
      };
      const text = encodeSpec(spec);
      expect(decodeSpec(text)).toEqual(spec);
      expect(encodeSpec(decodeSpec(text)!)).toBe(text);
    }
  });

  it("is safe to put in a URL as it is", () => {
    for (const pattern of PATTERNS) {
      const text = encodeSpec(defaultSpec(pattern.id, 77));
      expect(text).toMatch(/^[a-z0-9.-]+$/);
      expect(encodeURIComponent(text)).toBe(text);
      expect(text.length).toBeLessThan(80);
    }
  });

  it("reads a short form, filling the rest with defaults", () => {
    expect(decodeSpec("tiger.a")).toEqual({
      id: "tiger",
      seed: 10,
      colors: ["#ff8a00", "#17101f", "#ffd9a0"],
      scale: 1,
      rotation: 0,
    });
  });

  it("returns null for anything that is not a spec", () => {
    const bad: unknown[] = [
      "",
      "flames",
      "plaid.1.000000.100.0",
      "flames.!!.000000.100.0",
      "flames.zzzzzzzz.000000.100.0",
      "flames.1.00000g.100.0",
      "flames.1.000.100.0",
      "flames.1.000000.abc.0",
      "flames.1.000000.100.-4",
      "flames.1.000000.100.0.extra",
      "flames.1.000000.100000.0",
      "<script>alert(1)</script>",
      "x".repeat(500),
      null,
      undefined,
      42,
      { id: "flames" },
    ];
    for (const text of bad) expect(decodeSpec(text)).toBeNull();
  });

  it("clamps a scale or turn that is out of range instead of drawing it", () => {
    expect(decodeSpec("flames.1.000000.9999.0")?.scale).toBe(MAX_SCALE);
    expect(decodeSpec("flames.1.000000.1.0")?.scale).toBe(MIN_SCALE);
    expect(decodeSpec("flames.1.000000.100.725")?.rotation).toBe(5);
  });

  it("encodes a broken spec as the default instead of throwing", () => {
    expect(encodeSpec({ id: "plaid" } as unknown as PatternSpec)).toBe(encodeSpec(defaultSpec()));
  });
});
