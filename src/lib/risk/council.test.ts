import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectBait, detectSafe, scoreVerdict } from "./council.ts";
import type { Proposal } from "./types.ts";

function prop(partial: Partial<Proposal> & Pick<Proposal, "title" | "body" | "riskPastComfort">): Proposal {
  return {
    id: "p1",
    agentId: "a1",
    round: 1,
    createdAt: 0,
    critiques: [],
    ...partial,
  };
}

describe("risk council verdicts", () => {
  it("flags finger/hand glitch bait", () => {
    assert.equal(detectBait("extra fingers and warped hands"), true);
    assert.equal(
      scoreVerdict(prop({ title: "Glitch hands", body: "deformed fingers close-up", riskPastComfort: 90 })),
      "cheap_bait",
    );
  });

  it("flags low-risk safe pitches", () => {
    assert.equal(detectSafe("straightforward classic montage", 20), true);
    assert.equal(
      scoreVerdict(
        prop({
          title: "Safe pack",
          body: "Generic lifestyle product shot montage",
          riskPastComfort: 18,
        }),
      ),
      "too_conservative",
    );
  });

  it("rewards true artistic stretch", () => {
    assert.equal(
      scoreVerdict(
        prop({
          title: "Unreliable light narrator",
          body: "Chapters lit by lamps that remember differently",
          riskPastComfort: 79,
        }),
      ),
      "true_stretch",
    );
  });
});
