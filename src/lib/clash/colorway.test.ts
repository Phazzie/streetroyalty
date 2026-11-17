import { describe, expect, it } from "vitest";
import { clashScore } from "./score";
import {
  addKept,
  decodeColorway,
  DEFAULT_COLORWAY,
  describeColorway,
  encodeColorway,
  KEPT_LIMIT,
  paletteOf,
  parseKept,
  PRESETS,
  REEL_COLORS,
  removeKept,
} from "./colorway";
import { normalizeHex } from "./color";

describe("colourway links", () => {
  it("round-trips", () => {
    const code = encodeColorway(DEFAULT_COLORWAY);
    expect(code).toBe("b9a3ee-f6ecd9-ff8a3d");
    expect(decodeColorway(code)).toEqual(DEFAULT_COLORWAY);
  });

  it("accepts short and upper-case hex", () => {
    expect(decodeColorway("FFF-000-Ff2D95")).toEqual({
      body: "#ffffff",
      panel: "#000000",
      piping: "#ff2d95",
    });
  });

  it("refuses anything that is not three colours", () => {
    for (const bad of [
      "",
      "b9a3ee",
      "b9a3ee-f6ecd9",
      "a-b-c",
      "b9a3ee-f6ecd9-ff8a3d-000000",
      111111,
      null,
      undefined,
    ]) {
      expect(decodeColorway(bad)).toBeNull();
    }
  });

  it("never encodes to something a parser would read as a number", () => {
    expect(encodeColorway({ body: "#111111", panel: "#222222", piping: "#333333" })).toBe(
      "111111-222222-333333",
    );
    expect(encodeColorway({ body: "nope", panel: "#222", piping: "#333333" })).toBe(
      "000000-222222-333333",
    );
  });
});

describe("house presets", () => {
  it("are the two sweatsuits on record", () => {
    expect(PRESETS.map((preset) => preset.name)).toEqual(["Lilac", "Mint"]);
    expect(describeColorway(PRESETS[0]?.colors ?? DEFAULT_COLORWAY)).toBe(
      "lilac, cream and orange",
    );
    expect(describeColorway(PRESETS[1]?.colors ?? DEFAULT_COLORWAY)).toBe(
      "mint, peach and royal blue",
    );
  });

  it("sit on the reels, so a preset never needs the spare slot", () => {
    for (const preset of PRESETS) {
      for (const hex of paletteOf(preset.colors)) expect(REEL_COLORS).toContain(hex);
    }
  });

  it("keeps the reels to valid, distinct colours that can reach both ends of the score", () => {
    expect(new Set(REEL_COLORS).size).toBe(REEL_COLORS.length);
    for (const hex of REEL_COLORS) expect(normalizeHex(hex)).toBe(hex);
    const scores: number[] = [];
    for (const body of REEL_COLORS)
      for (const panel of REEL_COLORS) scores.push(clashScore([body, panel]).score);
    expect(Math.min(...scores)).toBe(0);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(80);
  });
});

describe("kept colourways", () => {
  const mint = PRESETS[1]?.colors ?? DEFAULT_COLORWAY;

  it("adds newest first without repeats", () => {
    let list = addKept([], DEFAULT_COLORWAY);
    list = addKept(list, mint);
    list = addKept(list, DEFAULT_COLORWAY);
    expect(list).toEqual([encodeColorway(DEFAULT_COLORWAY), encodeColorway(mint)]);
  });

  it("caps the list", () => {
    let list: string[] = [];
    for (let i = 0; i < KEPT_LIMIT + 6; i += 1) {
      const hex = `#${i.toString(16).padStart(2, "0")}aa33`;
      list = addKept(list, { body: hex, panel: "#ffffff", piping: "#000000" });
    }
    expect(list).toHaveLength(KEPT_LIMIT);
  });

  it("removes one", () => {
    const list = addKept(addKept([], DEFAULT_COLORWAY), mint);
    expect(removeKept(list, encodeColorway(mint))).toEqual([encodeColorway(DEFAULT_COLORWAY)]);
  });

  it("survives whatever is in storage", () => {
    expect(parseKept(null)).toEqual([]);
    expect(parseKept("not json")).toEqual([]);
    expect(parseKept('{"a":1}')).toEqual([]);
    expect(parseKept('["b9a3ee-f6ecd9-ff8a3d", 4, "junk", "B9A3EE-F6ECD9-FF8A3D"]')).toEqual([
      "b9a3ee-f6ecd9-ff8a3d",
    ]);
  });
});
