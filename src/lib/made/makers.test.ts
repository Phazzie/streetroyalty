import { describe, expect, it } from "vitest";
import { MAKERS, makersFor, METHODS, routableMakersFor, sourcesOf } from "./makers.ts";

describe("who makes what", () => {
  it("has a claim for every method on every maker", () => {
    for (const maker of MAKERS) {
      for (const method of METHODS) {
        expect(maker.methods[method.id], `${maker.id} ${method.id}`).toBeDefined();
      }
    }
  });

  it("backs every yes with a page on the maker's own site and a check date", () => {
    for (const maker of MAKERS) {
      expect(maker.checkedOn).toBe("17 Nov 2026");
      const claims = [maker.whoMakesIt, maker.noMinimum, ...Object.values(maker.methods)];
      for (const claim of claims) {
        if (claim.status !== "says-yes") continue;
        const url = new URL(claim.sourceUrl);
        expect(url.protocol).toBe("https:");
        expect(url.hostname === `${maker.id}.com` || url.hostname === `www.${maker.id}.com`).toBe(
          true,
        );
        expect(claim.saw.length).toBeGreaterThan(8);
      }
      expect(sourcesOf(maker).length).toBeGreaterThan(0);
    }
  });

  it("carries no prices", () => {
    expect(JSON.stringify(MAKERS)).not.toMatch(/[$£€]\s?\d/);
  });

  it("finds makers by what they can do", () => {
    expect(makersFor(["dtg", "embroidery"]).map((maker) => maker.id)).toEqual([
      "printful",
      "printify",
      "gooten",
    ]);
    expect(makersFor(["cut-and-sew", "dtf"]).map((maker) => maker.id)).toEqual([
      "printful",
      "printify",
    ]);
    expect(makersFor(["screen"])).toEqual([]);
    expect(makersFor([])).toHaveLength(MAKERS.length);
  });

  it("routes only to makers that are wired in", () => {
    expect(routableMakersFor(["all-over"]).map((maker) => maker.id)).toEqual(["printful"]);
  });
});
