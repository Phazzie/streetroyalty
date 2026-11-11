import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpret, paidPlan, splitPieces } from "./split-pieces.ts";

describe("splitPieces", () => {
  it("keeps a short sleeve shirt as one top", () => {
    assert.deepEqual(splitPieces("short sleeve shirt"), [
      { category: "Tops", spoken: "short sleeve shirt" },
    ]);
  });

  it("keeps boot cut jeans as bottoms", () => {
    assert.deepEqual(splitPieces("boot cut jeans"), [
      { category: "Bottoms", spoken: "boot cut jeans" },
    ]);
  });

  it("treats a jean jacket as outerwear", () => {
    assert.deepEqual(splitPieces("jean jacket"), [{ category: "Outer", spoken: "jean jacket" }]);
  });

  it("treats a tank top as one top", () => {
    assert.deepEqual(splitPieces("black tank top"), [{ category: "Tops", spoken: "black tank top" }]);
  });

  it("splits a real outfit into separate pieces", () => {
    assert.deepEqual(splitPieces("white tee and black jeans and sneakers"), [
      { category: "Tops", spoken: "white tee" },
      { category: "Bottoms", spoken: "black jeans" },
      { category: "Shoes", spoken: "sneakers" },
    ]);
  });

  it("merges a trench coat into one outer piece", () => {
    assert.deepEqual(splitPieces("trench coat"), [{ category: "Outer", spoken: "trench coat" }]);
  });

  it("keeps two tops as two pieces", () => {
    assert.deepEqual(splitPieces("white tee and a polo"), [
      { category: "Tops", spoken: "white tee" },
      { category: "Tops", spoken: "polo" },
    ]);
  });

  it("names an added hat as the hat", () => {
    assert.deepEqual(splitPieces("add a hat"), [{ category: "Hats", spoken: "hat" }]);
  });

  it("returns nothing when no garment is named", () => {
    assert.deepEqual(splitPieces("something cool"), []);
  });
});

describe("interpret", () => {
  it("hears wear, save, redo, and runway", () => {
    assert.equal(interpret("put it on me").type, "wear");
    assert.equal(interpret("save this").type, "save");
    assert.equal(interpret("try again").type, "again");
    assert.equal(interpret("runway with boos").type, "runway");
  });

  it("does not invent pieces from chatter", () => {
    assert.equal(interpret("hello there").type, "unclear");
  });
});

describe("paidPlan", () => {
  it("builds two tops instead of one shirt", () => {
    const plan = paidPlan("white tee and a polo", "hub");
    assert.equal(plan.kind, "pieces");
    if (plan.kind === "pieces") assert.equal(plan.pieces.length, 2);
  });

  it("adds a hat on the look instead of rewriting the photo", () => {
    const plan = paidPlan("add a hat", "look");
    assert.equal(plan.kind, "pieces");
    if (plan.kind === "pieces") assert.equal(plan.pieces[0]?.spoken, "hat");
  });

  it("keeps a shorter coat as a change to the photo", () => {
    assert.equal(paidPlan("shorter coat", "look").kind, "tweak");
    assert.equal(paidPlan("make it black", "look").kind, "tweak");
  });
});
