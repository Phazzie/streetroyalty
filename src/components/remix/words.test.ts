import { describe, expect, it } from "vitest";
import {
  countPieces,
  countRemixes,
  familySummary,
  generationLabel,
  ordinal,
  remixLineNote,
} from "./words.ts";

describe("family tree words", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [102, "102nd"],
    [111, "111th"],
  ])("writes %i as %s", (value, expected) => {
    expect(ordinal(value)).toBe(expected);
  });

  it("names each stop, with the original first", () => {
    expect(generationLabel(0)).toBe("The original");
    expect(generationLabel(1)).toBe("2nd generation");
    expect(generationLabel(2)).toBe("3rd generation");
  });

  it("counts one and many", () => {
    expect(countPieces(1)).toBe("1 piece");
    expect(countPieces(4)).toBe("4 pieces");
    expect(countRemixes(1)).toBe("1 remix");
    expect(countRemixes(0)).toBe("0 remixes");
  });

  it("sums a family up in one line", () => {
    expect(familySummary({ generation: 1, broken: false, descendants: 0 })).toBe(
      "An original. Nobody has remixed it yet.",
    );
    expect(familySummary({ generation: 1, broken: false, descendants: 5 })).toBe(
      "An original. 5 pieces on the rack came from this one.",
    );
    expect(familySummary({ generation: 3, broken: false, descendants: 1 })).toBe(
      "3rd generation. 1 piece on the rack came from this one.",
    );
    expect(familySummary({ generation: 3, broken: true, descendants: 0 })).toBe(
      "Part of a longer line. Nobody has remixed it yet.",
    );
  });

  it("says at least when the family was too big to count in full", () => {
    expect(familySummary({ generation: 1, broken: false, descendants: 5000, atLeast: true })).toBe(
      "An original. At least 5000 pieces on the rack came from this one.",
    );
    expect(remixLineNote({ shown: 24, remixCount: 40, descendants: 5000, atLeast: true })).toBe(
      "At least 40 remixes on the rack, 5000 pieces down the whole line. Showing the first 24.",
    );
  });

  it("describes the remix line without repeating itself", () => {
    expect(remixLineNote({ shown: 2, remixCount: 2, descendants: 2 })).toBe(
      "2 remixes on the rack.",
    );
    expect(remixLineNote({ shown: 1, remixCount: 1, descendants: 4 })).toBe(
      "1 remix on the rack, 4 pieces down the whole line.",
    );
    expect(remixLineNote({ shown: 24, remixCount: 30, descendants: 30 })).toBe(
      "30 remixes on the rack. Showing the first 24.",
    );
  });
});
