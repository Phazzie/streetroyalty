import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addLine,
  bagCount,
  bagSubtotalCents,
  parseStoredBag,
  setLineQuantity,
  useBag,
} from "./bag.ts";
import { MAX_BAG_LINES, MAX_LINE_QUANTITY, type BagLine } from "./types.ts";

function line(variantId: string, quantity = 1, priceCents = 4200): BagLine {
  return {
    variantId,
    slug: "crown-tee",
    name: "Crown Tee",
    variantLabel: "Cream / M",
    priceCents,
    imageUrl: "/a.webp",
    quantity,
  };
}

describe("bag", () => {
  it("adds a new line and merges a repeat of the same variant", () => {
    const one = addLine([], line("a"));
    const two = addLine(one, line("a", 2));
    assert.equal(two.length, 1);
    assert.equal(two[0].quantity, 3);
  });
  it("caps one line at the quantity limit", () => {
    const lines = addLine([line("a", MAX_LINE_QUANTITY)], line("a", 5));
    assert.equal(lines[0].quantity, MAX_LINE_QUANTITY);
  });
  it("stops adding lines past the bag limit", () => {
    let lines: BagLine[] = [];
    for (let i = 0; i < MAX_BAG_LINES + 3; i += 1) lines = addLine(lines, line(`v${i}`));
    assert.equal(lines.length, MAX_BAG_LINES);
  });
  it("sets a quantity and removes the line at zero", () => {
    const lines = [line("a", 2), line("b", 1)];
    assert.equal(setLineQuantity(lines, "a", 5)[0].quantity, 5);
    assert.deepEqual(
      setLineQuantity(lines, "a", 0).map((item) => item.variantId),
      ["b"],
    );
    assert.equal(setLineQuantity(lines, "a", 99)[0].quantity, MAX_LINE_QUANTITY);
  });
  it("says so when a full bag turns a piece away", () => {
    useBag.getState().clear();
    for (let i = 0; i < MAX_BAG_LINES; i += 1) useBag.getState().add(line(`v${i}`));
    assert.equal(useBag.getState().notice, "");
    useBag.getState().add(line("one-too-many"));
    assert.equal(useBag.getState().lines.length, MAX_BAG_LINES);
    assert.ok(useBag.getState().notice.length > 0);
    useBag.getState().remove("v0");
    assert.equal(useBag.getState().notice, "");
    useBag.getState().clear();
  });
  it("forgets the trip to checkout once the bag is changed", () => {
    useBag.getState().clear();
    useBag.getState().add(line("a", 2));
    useBag.getState().add(line("b"));
    useBag.getState().markSent();
    useBag.getState().setQuantity("a", 3);
    assert.equal(useBag.getState().sent, false);
    useBag.getState().markSent();
    useBag.getState().remove("b");
    assert.equal(useBag.getState().sent, false);
    useBag.getState().clear();
  });
  it("counts pieces and totals cents", () => {
    const lines = [line("a", 2, 4200), line("b", 1, 11800)];
    assert.equal(bagCount(lines), 3);
    assert.equal(bagSubtotalCents(lines), 20200);
  });
  it("reads a stored bag and drops anything malformed", () => {
    assert.deepEqual(parseStoredBag(null), []);
    assert.deepEqual(parseStoredBag("{not json"), []);
    assert.deepEqual(parseStoredBag('{"a":1}'), []);
    const stored = JSON.stringify([
      line("a", 2),
      { variantId: 5 },
      { variantId: "x", slug: "s", name: "n", priceCents: -1 },
      "junk",
    ]);
    const parsed = parseStoredBag(stored);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].variantId, "a");
    assert.equal(parsed[0].quantity, 2);
  });
});
