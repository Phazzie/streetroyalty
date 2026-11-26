import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { matchRealPiece } from "../lab/real-pieces.ts";
import { MAX_PLAN_PIECES, localPlan, parsePlan, planPrompt } from "./stylist.ts";

describe("stylist", () => {
  it("reads a plan out of a chatty answer", () => {
    const plan = parsePlan(
      'Sure! {"note":"Clean and warm.","pieces":[{"category":"tops","item":"black  hoodie"},{"category":"Bottoms","item":"grey sweatpants"},{"category":"Shoes","item":"black boots"}]} Enjoy.',
    );
    assert.ok(plan);
    assert.equal(plan.note, "Clean and warm.");
    assert.deepEqual(plan.pieces[0], { category: "Tops", spoken: "black hoodie" });
    // Boots aren't something the shop makes, so they are dropped.
    assert.equal(plan.pieces.length, 2);
  });
  it("drops unknown categories, repeats, and anything past the limit", () => {
    const pieces = [
      { category: "Socks", item: "red socks" },
      { category: "Tops", item: "white tee" },
      { category: "Tops", item: "White Tee" },
      { category: "Bottoms", item: "black sweatpants" },
      { category: "Tops", item: "black hoodie" },
      { category: "Tops", item: "bone crewneck" },
      { category: "Accessories", item: "black tote" },
    ];
    const plan = parsePlan(JSON.stringify({ note: "x", pieces }));
    assert.ok(plan);
    assert.equal(plan.pieces.length, MAX_PLAN_PIECES);
    assert.ok(plan.pieces.every((piece) => piece.spoken !== "red socks"));
    assert.equal(
      plan.pieces.filter((piece) => piece.spoken.toLowerCase() === "white tee").length,
      1,
    );
  });
  it("refuses an answer with no real outfit in it", () => {
    assert.equal(parsePlan("I can't help with that."), null);
    assert.equal(parsePlan("{broken json"), null);
    assert.equal(parsePlan('{"pieces":[{"category":"Tops","item":"tee"}]}'), null);
    assert.equal(parsePlan('{"pieces":"none"}'), null);
  });
  it("picks a house plan by the occasion and always has one", () => {
    assert.match(localPlan("my cousin's wedding").pieces[0].spoken, /crewneck/);
    assert.match(localPlan("first date, dinner downtown").note, /Dark base/);
    assert.match(localPlan("a snow day").pieces[0].spoken, /hoodie/);
    assert.equal(localPlan("").pieces.length, 2);
    for (const occasion of ["wedding", "gym", "beach", "", "date", "rain"]) {
      const plan = localPlan(occasion);
      assert.ok(plan.pieces.length >= 2 && plan.pieces.length <= MAX_PLAN_PIECES);
      // Every house piece is a real blank in a real colour.
      for (const piece of plan.pieces) {
        const real = matchRealPiece(piece.spoken);
        assert.ok(real, piece.spoken);
        assert.ok(piece.spoken.toLowerCase().startsWith(real.colorName.toLowerCase()), piece.spoken);
      }
    }
  });
  it("tells a courtroom from a basketball court", () => {
    assert.match(localPlan("pickup at the basketball court").note, /ready to move/);
    assert.match(localPlan("Tennis court, Saturday").note, /ready to move/);
    assert.match(localPlan("court date on Monday").pieces[0].spoken, /crewneck/);
    assert.match(localPlan("I have court tomorrow").pieces[0].spoken, /crewneck/);
    assert.match(localPlan("a day in the courtroom").pieces[0].spoken, /crewneck/);
  });
  it("matches whole words, not letters inside other words", () => {
    assert.match(localPlan("training session").note, /ready to move/);
    assert.match(localPlan("brunch with the crew").note, /everyday uniform/);
    assert.match(localPlan("a photoshoot").note, /everyday uniform/);
    assert.match(localPlan("runway show").note, /Dark base/);
    assert.match(localPlan("running errands in the rain").note, /weather/);
    assert.match(localPlan("a hot day").note, /Easy colours/);
  });
  it("keeps the occasion inside its own quotes in the prompt", () => {
    const prompt = planPrompt('brunch "with" the\n  crew');
    assert.match(prompt, /Occasion: "brunch 'with' the crew"\./);
  });
});
