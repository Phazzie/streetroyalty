import { describe, expect, it } from "vitest";
import { colorName, hexToOklch, hueGap, normalizeHex, oklchToHex, temperature } from "./color";

describe("normalizeHex", () => {
  it("accepts short, long, bare and upper-case hex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex(" #FF2D95 ")).toBe("#ff2d95");
    expect(normalizeHex("ff2d95")).toBe("#ff2d95");
  });

  it("turns anything else into null", () => {
    for (const bad of ["", "#12", "#gggggg", "red", "#1234567", null, undefined, 12, {}]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("hexToOklch", () => {
  it("puts black at 0 and white at 1 with no chroma", () => {
    const black = hexToOklch("#000000");
    const white = hexToOklch("#ffffff");
    expect(black?.l).toBeCloseTo(0, 3);
    expect(white?.l).toBeCloseTo(1, 3);
    expect(black?.c).toBeLessThan(0.001);
    expect(white?.c).toBeLessThan(0.001);
  });

  it("matches the published OKLCH values for the sRGB primaries", () => {
    const red = hexToOklch("#ff0000");
    expect(red?.l).toBeCloseTo(0.628, 2);
    expect(red?.c).toBeCloseTo(0.2577, 2);
    expect(red?.h).toBeCloseTo(29.23, 0);
    const blue = hexToOklch("#0000ff");
    expect(blue?.l).toBeCloseTo(0.452, 2);
    expect(blue?.h).toBeCloseTo(264.05, 0);
  });

  it("returns null for something that is not a colour", () => {
    expect(hexToOklch("nope")).toBeNull();
  });
});

describe("oklchToHex", () => {
  it("round-trips real colours", () => {
    for (const hex of [
      "#ff2d95",
      "#12343a",
      "#d6ff3c",
      "#f5ebdd",
      "#000000",
      "#ffffff",
      "#7c5cff",
    ]) {
      const color = hexToOklch(hex);
      expect(color).not.toBeNull();
      if (color) expect(oklchToHex(color)).toBe(hex);
    }
  });

  it("gives up chroma, not hue, for a colour no screen can show", () => {
    const hex = oklchToHex({ l: 0.7, c: 0.9, h: 150 });
    const back = hexToOklch(hex);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(back?.h).toBeCloseTo(150, -1);
    expect(back?.c).toBeLessThan(0.4);
  });

  it("wraps hues and clamps lightness", () => {
    expect(oklchToHex({ l: 2, c: 0, h: 0 })).toBe("#ffffff");
    expect(oklchToHex({ l: -1, c: 0, h: 720 })).toBe("#000000");
  });
});

describe("hueGap", () => {
  it("goes the short way round", () => {
    expect(hueGap(350, 10)).toBe(20);
    expect(hueGap(0, 180)).toBe(180);
    expect(hueGap(90, 300)).toBe(150);
  });
});

describe("colorName", () => {
  it("names the house colours the way the label does", () => {
    expect(colorName("#b9a3ee")).toBe("lilac");
    expect(colorName("#f6ecd9")).toBe("cream");
    expect(colorName("#a5dccb")).toBe("mint");
    expect(colorName("#f9c4a6")).toBe("peach");
    expect(colorName("#ff2d95")).toBe("hot pink");
    expect(colorName("#d6ff3c")).toBe("lime");
  });

  it("names neutrals and near misses", () => {
    expect(colorName("#000")).toBe("black");
    expect(colorName("#fff")).toBe("white");
    expect(colorName("#808080")).toBe("grey");
    expect(colorName("#fe6b02")).toBe("orange");
  });

  it("does not throw on rubbish", () => {
    expect(colorName("rubbish")).toBe("no colour");
    expect(colorName(undefined)).toBe("no colour");
  });
});

describe("temperature", () => {
  it("sorts hues into warm, cold and neither", () => {
    const of = (hex: string) => {
      const color = hexToOklch(hex);
      return color ? temperature(color) : "none";
    };
    expect(of("#ff6a00")).toBe("warm");
    expect(of("#ff2d95")).toBe("warm");
    expect(of("#3d7eff")).toBe("cold");
    expect(of("#2faa4a")).toBe("cold");
    expect(of("#888888")).toBe("neutral");
  });
});
