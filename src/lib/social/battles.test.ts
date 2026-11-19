import { describe, expect, it } from "vitest";
import {
  pairKey,
  pairsLeft,
  pickPair,
  rankByScore,
  splitPercent,
  wilsonLowerBound,
  type Contender,
} from "./battles.ts";

/** A random source that replays a fixed list, so a pick can be pinned down. */
function replay(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("pairKey", () => {
  it("is the same whichever side each piece stood on", () => {
    expect(pairKey("b", "a")).toBe("a:b");
    expect(pairKey("a", "b")).toBe("a:b");
  });

  it("sorts as plain text, the way the database compares ids", () => {
    expect(pairKey("design-10", "design-9")).toBe("design-10:design-9");
    expect(pairKey("Z", "a")).toBe("Z:a");
  });
});

describe("wilsonLowerBound", () => {
  it("scores a piece with no battles as zero", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("scores a piece that has only lost as zero", () => {
    expect(wilsonLowerBound(0, 7)).toBe(0);
  });

  it("matches the worked values", () => {
    expect(wilsonLowerBound(1, 0)).toBeCloseTo(0.2065, 3);
    expect(wilsonLowerBound(40, 10)).toBeCloseTo(0.6696, 3);
    expect(wilsonLowerBound(5, 5)).toBeCloseTo(0.2366, 3);
  });

  it("does not let one lucky win outrank a long winning record", () => {
    expect(wilsonLowerBound(40, 10)).toBeGreaterThan(wilsonLowerBound(1, 0));
  });

  it("rises with more proof at the same win rate", () => {
    expect(wilsonLowerBound(80, 20)).toBeGreaterThan(wilsonLowerBound(8, 2));
  });

  it("stays between zero and one", () => {
    for (const [wins, losses] of [
      [1, 0],
      [1000, 0],
      [0, 1000],
      [3, 9],
    ] as const) {
      const score = wilsonLowerBound(wins, losses);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("treats junk counts as none", () => {
    expect(wilsonLowerBound(-3, Number.NaN)).toBe(0);
    expect(wilsonLowerBound(2.9, 0)).toBe(wilsonLowerBound(2, 0));
  });
});

describe("rankByScore", () => {
  it("puts the proven piece above the lucky one", () => {
    const ranked = rankByScore([
      { id: "lucky", wins: 1, losses: 0 },
      { id: "proven", wins: 40, losses: 10 },
    ]);
    expect(ranked.map((row) => [row.rank, row.id])).toEqual([
      [1, "proven"],
      [2, "lucky"],
    ]);
  });

  it("breaks a tied score by fewer losses, then by id", () => {
    const ranked = rankByScore([
      { id: "c", wins: 0, losses: 3 },
      { id: "b", wins: 0, losses: 0 },
      { id: "a", wins: 0, losses: 0 },
      { id: "d", wins: 0, losses: 1 },
    ]);
    expect(ranked.map((row) => row.id)).toEqual(["a", "b", "d", "c"]);
    expect(ranked.every((row) => row.score === 0)).toBe(true);
  });

  it("gives identical records the same order every time", () => {
    const rows = [
      { id: "y", wins: 3, losses: 1 },
      { id: "x", wins: 3, losses: 1 },
    ];
    expect(rankByScore(rows).map((row) => row.id)).toEqual(["x", "y"]);
    expect(rankByScore([...rows].reverse()).map((row) => row.id)).toEqual(["x", "y"]);
  });

  it("keeps the top ten and numbers them from one", () => {
    const rows = Array.from({ length: 14 }, (_, index) => ({
      id: `p${String(index).padStart(2, "0")}`,
      wins: index,
      losses: 2,
    }));
    const ranked = rankByScore(rows);
    expect(ranked).toHaveLength(10);
    expect(ranked[0]).toMatchObject({ id: "p13", rank: 1 });
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("returns nothing for an empty rack and leaves its input alone", () => {
    expect(rankByScore([])).toEqual([]);
    const rows = [
      { id: "b", wins: 0, losses: 1 },
      { id: "a", wins: 1, losses: 0 },
    ];
    rankByScore(rows);
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
  });
});

describe("splitPercent", () => {
  it("always adds up to one hundred", () => {
    expect(splitPercent(8, 5)).toEqual([62, 38]);
    expect(splitPercent(1, 2)).toEqual([33, 67]);
    expect(splitPercent(1, 0)).toEqual([100, 0]);
  });

  it("is an even split before anybody has voted", () => {
    expect(splitPercent(0, 0)).toEqual([50, 50]);
  });
});

describe("pickPair", () => {
  const piece = (id: string, makerId: string, battles = 0): Contender => ({ id, makerId, battles });

  it("returns null with fewer than two pieces", () => {
    expect(pickPair([], new Set())).toBeNull();
    expect(pickPair([piece("a", "ada")], new Set())).toBeNull();
  });

  it("puts the least-seen piece in the battle", () => {
    const rack = [piece("a", "ada", 9), piece("b", "bo", 9), piece("c", "cy", 0)];
    for (let run = 0; run < 20; run += 1) {
      const pair = pickPair(rack, new Set());
      expect(pair?.map((item) => item.id)).toContain("c");
    }
  });

  it("picks two different makers when it can", () => {
    const rack = [piece("a1", "ada"), piece("a2", "ada"), piece("a3", "ada"), piece("b1", "bo", 5)];
    for (let run = 0; run < 20; run += 1) {
      const pair = pickPair(rack, new Set());
      expect(new Set(pair?.map((item) => item.makerId)).size).toBe(2);
    }
  });

  it("falls back to one maker against themselves when nobody else is left", () => {
    const rack = [piece("a1", "ada"), piece("a2", "ada")];
    expect(
      pickPair(rack, new Set())
        ?.map((item) => item.id)
        .sort(),
    ).toEqual(["a1", "a2"]);
  });

  it("never repeats a judged pair, and stops when every pair is judged", () => {
    const rack = [piece("a", "ada"), piece("b", "bo"), piece("c", "cy")];
    const judged = new Set<string>();
    for (let round = 0; round < 3; round += 1) {
      const pair = pickPair(rack, judged);
      if (!pair) throw new Error("ran out of pairs early");
      const key = pairKey(pair[0].id, pair[1].id);
      expect(judged.has(key)).toBe(false);
      judged.add(key);
    }
    expect(judged.size).toBe(3);
    expect(pickPair(rack, judged)).toBeNull();
  });

  it("rests the pieces that were just on screen while others are free", () => {
    const rack = [piece("a", "ada"), piece("b", "bo"), piece("c", "cy", 4), piece("d", "dee", 4)];
    for (let run = 0; run < 20; run += 1) {
      const pair = pickPair(rack, new Set(), Math.random, new Set(["a", "b"]));
      expect(pair?.map((item) => item.id).sort()).toEqual(["c", "d"]);
    }
  });

  it("still uses a rested piece when it is the only way to make a pair", () => {
    const rack = [piece("a", "ada"), piece("b", "bo"), piece("c", "cy")];
    const pair = pickPair(rack, new Set(["a:c", "b:c"]), Math.random, new Set(["a", "b"]));
    expect(pair?.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("tosses a coin for which side each piece stands on", () => {
    const rack = [piece("a", "ada"), piece("b", "bo", 1)];
    const heads = pickPair(rack, new Set(), replay([0.1]));
    const tails = pickPair(rack, new Set(), replay([0.9]));
    expect(heads?.[0].id).not.toBe(tails?.[0].id);
  });
});

describe("pairsLeft", () => {
  it("counts every pair when nothing is judged", () => {
    expect(pairsLeft(["a", "b", "c", "d"], new Set())).toBe(6);
  });

  it("leaves out judged pairs, and ignores votes on pieces that are gone", () => {
    expect(pairsLeft(["a", "b", "c"], new Set(["a:b", "a:zz"]))).toBe(2);
    expect(pairsLeft(["a", "b"], new Set(["a:b"]))).toBe(0);
    expect(pairsLeft(["a"], new Set())).toBe(0);
  });
});
