import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_PLAN_PIECES, localPlan, parsePlan, planPrompt } from "./stylist.ts";

describe("stylist", () => {
  it("reads a plan out of a chatty answer", () => {
    const plan = parsePlan(
      'Sure! {"note":"Clean and warm.","pieces":[{"category":"tops","item":"black  wool turtleneck"},{"category":"Bottoms","item":"grey flannel trousers"},{"category":"Shoes","item":"black boots"}]} Enjoy.',
    );
    assert.ok(plan);
    assert.equal(plan.note, "Clean and warm.");
    assert.deepEqual(plan.pieces[0], { category: "Tops", spoken: "black wool turtleneck" });
    assert.equal(plan.pieces.length, 3);
  });
  it("drops unknown categories, repeats, and anything past the limit", () => {
    const pieces = [
      { category: "Socks", item: "red socks" },
      { category: "Tops", item: "white tee" },
      { category: "Tops", item: "White Tee" },
      { category: "Bottoms", item: "black jeans" },
      { category: "Shoes", item: "white sneakers" },
      { category: "Hats", item: "black beanie" },
      { category: "Outer", item: "denim jacket" },
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
    assert.match(localPlan("my cousin's wedding").pieces[0].spoken, /blazer/);
    assert.match(localPlan("first date, dinner downtown").note, /Dark base/);
    assert.match(localPlan("a snow day").pieces[0].spoken, /puffer/);
    assert.equal(localPlan("").pieces.length, 4);
    for (const occasion of ["wedding", "gym", "beach", "", "date", "rain"]) {
      const plan = localPlan(occasion);
      assert.ok(plan.pieces.length >= 3 && plan.pieces.length <= MAX_PLAN_PIECES);
    }
  });
  it("tells a courtroom from a basketball court", () => {
    assert.match(localPlan("pickup at the basketball court").note, /ready to move/);
    assert.match(localPlan("Tennis court, Saturday").note, /ready to move/);
    assert.match(localPlan("court date on Monday").pieces[0].spoken, /blazer/);
    assert.match(localPlan("I have court tomorrow").pieces[0].spoken, /blazer/);
    assert.match(localPlan("a day in the courtroom").pieces[0].spoken, /blazer/);
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
