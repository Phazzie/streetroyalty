import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpret, splitPieces } from "./split-pieces.ts";

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
