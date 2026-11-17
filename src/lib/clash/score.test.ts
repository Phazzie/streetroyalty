import { describe, expect, it } from "vitest";
import { clashLabel, clashScore, louder, quieter } from "./score";

const LILAC = ["#b9a3ee", "#f6ecd9", "#ff8a3d"];
const MINT = ["#a5dccb", "#f9c4a6", "#3d5fd0"];
const GREYS = ["#111111", "#888888", "#eeeeee"];
const BLUES = ["#1d2b6b", "#3d7eff", "#8fc8ff"];
const NEON = ["#ff2d95", "#19e06a", "#ff6a00"];

describe("clashLabel", () => {
  it("names each band", () => {
    expect(clashLabel(0)).toBe("Quiet");
    expect(clashLabel(14)).toBe("Quiet");
    expect(clashLabel(15)).toBe("Smooth");
    expect(clashLabel(35)).toBe("Loud");
    expect(clashLabel(60)).toBe("Clashing");
    expect(clashLabel(80)).toBe("Riot");
    expect(clashLabel(100)).toBe("Riot");
  });
});

describe("clashScore", () => {
  it("keeps every score a whole number from 0 to 100 with a matching label", () => {
    for (const palette of [LILAC, MINT, GREYS, BLUES, NEON, [], ["#fff"]]) {
      const result = clashScore(palette);
      expect(Number.isInteger(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.label).toBe(clashLabel(result.score));
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it("scores neutrals at nothing and says so kindly", () => {
    const result = clashScore(GREYS);
    expect(result.score).toBe(0);
    expect(result.label).toBe("Quiet");
    expect(result.reasons[0]).toMatch(/neutrals/);
  });

  it("scores one family low", () => {
    const result = clashScore(BLUES);
    expect(result.score).toBeLessThan(35);
    expect(result.reasons[0]).toMatch(/one family/);
  });

  it("scores saturated near-miss opposites as a riot", () => {
    const result = clashScore(NEON);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe("Riot");
    expect(result.reasons[0]).toBe("hot pink and green are fighting");
  });

  it("puts the two house colourways in the loud band, between the tonal and the neon", () => {
    for (const palette of [LILAC, MINT]) {
      const score = clashScore(palette).score;
      expect(clashScore(palette).label).toBe("Loud");
      expect(score).toBeGreaterThan(clashScore(BLUES).score);
      expect(score).toBeLessThan(clashScore(NEON).score);
    }
  });

  it("says pink and lime are fighting", () => {
    expect(clashScore(["#ff2d95", "#d6ff3c"]).reasons).toContain("hot pink and lime are fighting");
  });

  it("names the warm colour first when hot meets cold", () => {
    const reasons = clashScore(["#12d6a0", "#ffe433"]).reasons.join(" ");
    expect(reasons).not.toMatch(/mint runs hot|green runs hot|aqua runs hot/);
  });

  it("rates a near miss above a true opposite, and level neighbours above stepped ones", () => {
    // Hot pink sits near hue 355. Its opposite is near 175, and the near miss is about 30 short of that.
    const miss = clashScore(["#ff2d95", "#19e06a"]).score;
    const opposite = clashScore(["#ff2d95", "#00c9a7"]).score;
    expect(miss).toBeGreaterThan(opposite);
    const level = clashScore(["#ff2d95", "#ff5a36"]).score;
    const stepped = clashScore(["#ff2d95", "#6b1408"]).score;
    expect(level).toBeGreaterThan(stepped);
  });

  it("does not care about order or repeats", () => {
    const base = clashScore(NEON).score;
    expect(clashScore([...NEON].reverse()).score).toBe(base);
    expect(clashScore([...NEON, ...NEON]).score).toBe(base);
    expect(clashScore(["#FF2D95", "ff2d95", "#ff2d95"]).score).toBe(clashScore(["#ff2d95"]).score);
  });

  it("is the same every time", () => {
    expect(clashScore(MINT)).toEqual(clashScore(MINT));
  });

  it("handles one colour, none, and rubbish without throwing", () => {
    expect(clashScore(["#ff2d95"]).reasons[0]).toMatch(/one colour, hot pink/);
    expect(clashScore(["#ff2d95"]).score).toBeLessThan(35);
    expect(clashScore([])).toEqual({ score: 0, label: "Quiet", reasons: ["no colours yet"] });
    expect(clashScore(["nope", "#12", "", null, 4]).score).toBe(0);
    expect(clashScore(undefined as unknown as string[]).score).toBe(0);
    expect(clashScore(["nope", ...NEON]).score).toBe(clashScore(NEON).score);
  });

  it("gives one loud colour among neutrals the floor", () => {
    const result = clashScore(["#0d0d10", "#d6ff3c", "#ffffff"]);
    expect(result.score).toBeLessThan(35);
    expect(result.reasons[0]).toBe("lime has the floor to itself");
  });
});

describe("louder and quieter", () => {
  const palettes = [LILAC, MINT, GREYS, BLUES, NEON, ["#ff2d95", "#ff2d95"]];

  it("never lowers the score when asked for louder, and gets a calm palette to clashing", () => {
    for (const start of palettes) {
      let palette = start;
      let last = clashScore(palette).score;
      for (let i = 0; i < 10; i += 1) {
        palette = louder(palette);
        const score = clashScore(palette).score;
        expect(score).toBeGreaterThanOrEqual(last);
        last = score;
      }
      expect(palette).toHaveLength(start.length);
      expect(last).toBeGreaterThanOrEqual(60);
    }
  });

  it("never raises the score when asked for quieter, and gets a riot down to quiet", () => {
    for (const start of [LILAC, MINT, BLUES, NEON]) {
      let palette = start;
      let last = clashScore(palette).score;
      for (let i = 0; i < 10; i += 1) {
        palette = quieter(palette);
        const score = clashScore(palette).score;
        expect(score).toBeLessThanOrEqual(last);
        last = score;
      }
      expect(last).toBeLessThan(15);
    }
  });

  it("moves one step at a time, not all the way", () => {
    const before = clashScore(LILAC).score;
    const up = clashScore(louder(LILAC)).score;
    const down = clashScore(quieter(LILAC)).score;
    expect(up).toBeGreaterThan(before);
    expect(up - before).toBeLessThanOrEqual(25);
    expect(down).toBeLessThan(before);
    expect(before - down).toBeLessThanOrEqual(25);
  });

  it("changes one colour per press and returns valid hex", () => {
    const next = louder(MINT);
    expect(next.filter((hex, index) => hex !== MINT[index])).toHaveLength(1);
    for (const hex of next) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("leaves locked colours alone", () => {
    let palette = LILAC;
    for (let i = 0; i < 6; i += 1) palette = louder(palette, [true, false, true]);
    expect(palette[0]).toBe(LILAC[0]);
    expect(palette[2]).toBe(LILAC[2]);
    expect(palette[1]).not.toBe(LILAC[1]);
    expect(quieter(NEON, [true, true, true])).toEqual(NEON);
  });

  it("is the same every time and never throws on rubbish", () => {
    expect(louder(MINT)).toEqual(louder(MINT));
    expect(quieter(MINT)).toEqual(quieter(MINT));
    expect(louder(["nope", "#ff2d95", ""])).toHaveLength(3);
    expect(louder(["nope", "#ff2d95", ""])[0]).toBe("nope");
    expect(louder([])).toEqual([]);
    expect(quieter(undefined as unknown as string[])).toEqual([]);
  });

  it("stays put when there is nowhere left to go", () => {
    expect(quieter(GREYS)).toEqual(GREYS);
  });
});

describe("reasons match the volume", () => {
  it("does not say a soft pair is turned all the way up", () => {
    const result = clashScore(["#0d0d10", "#141f52", "#6e1429"]);
    expect(result.score).toBeLessThan(35);
    expect(result.reasons.join(" ")).not.toMatch(/all the way up|fighting|squaring up/);
  });

  it("keeps the hard words for the hard fights", () => {
    expect(clashScore(["#e3202a", "#3d7eff"]).reasons[0]).toMatch(
      /fighting|squaring up|all the way up/,
    );
  });
});
