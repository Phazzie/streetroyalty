import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  HOUSE_BLANKS,
  houseBlank,
  houseVariantIds,
  placementExtraCents,
  printfulVariantFor,
  sizeCode,
} from "./house-blanks.ts";

describe("the house pieces", () => {
  it("are real Printful products, with no hat and no made-up colour", () => {
    assert.deepEqual(
      HOUSE_BLANKS.map((blank) => [blank.id, blank.printfulId]),
      [
        ["tee-heavy", 586],
        ["hoodie-pullover", 380],
        ["crew-sweat", 411],
        ["longsleeve-block", 753],
        ["jogger-court", 412],
        ["tote-corner", 367],
      ],
    );
    assert.equal(houseBlank("hat-dad"), null);
    for (const blank of HOUSE_BLANKS) {
      const ids = houseVariantIds(blank);
      assert.equal(new Set(ids).size, ids.length, `${blank.id} repeats a variant id`);
      for (const color of blank.colors) {
        assert.match(color.hex, /^#[0-9a-f]{6}$/i);
        assert.deepEqual(Object.keys(color.variants), blank.sizes, `${blank.id} ${color.name}`);
      }
      // Only DTG spots: the studio exports one flat picture per spot.
      for (const spot of blank.placements) assert.doesNotMatch(spot.placement, /embroidery|dtf|label/);
    }
  });

  it("maps a sandbox variant to the same colour and size on Printful", () => {
    assert.equal(printfulVariantFor("tee-heavy-black-m"), "15115");
    assert.equal(printfulVariantFor("crew-sweat-bone-3xl"), "20352");
    assert.equal(printfulVariantFor("tote-corner-oyster-one-size"), "10458");
    assert.equal(printfulVariantFor("tee-heavy-hot-pink-m"), null);
    assert.equal(printfulVariantFor("aop-hoodie-printed-m"), null);
    assert.equal(sizeCode("One size"), "one-size");
  });

  it("adds each spot's surcharge once", () => {
    const tee = houseBlank("tee-heavy");
    assert.equal(placementExtraCents(tee, ["front"]), 0);
    assert.equal(placementExtraCents(tee, ["front", "back", "back", "sleeve_left"]), 595 + 249);
    assert.equal(placementExtraCents(null, ["back"]), 0);
  });
});
