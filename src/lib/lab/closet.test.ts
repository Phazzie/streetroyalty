import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { restoreItem, undoStillGood, withoutId } from "./closet.ts";

describe("closet undo", () => {
  it("removes one item and can put it back at the front", () => {
    const items = [
      { id: "a", name: "tee" },
      { id: "b", name: "hat" },
    ];
    const dropped = withoutId(items, "b");
    assert.equal(dropped.removed?.name, "hat");
    assert.deepEqual(dropped.next.map((item) => item.id), ["a"]);
    assert.deepEqual(restoreItem(dropped.next, dropped.removed!, 12).map((item) => item.id), ["b", "a"]);
  });

  it("does not duplicate a restore and ignores an unknown id", () => {
    const items = [{ id: "a" }];
    assert.deepEqual(withoutId(items, "missing").next, items);
    assert.deepEqual(restoreItem(items, { id: "a" }, 12), items);
  });

  it("expires an undo after the window", () => {
    assert.equal(undoStillGood({ at: 1_000 }, 5_000, 12_000), true);
    assert.equal(undoStillGood({ at: 1_000 }, 20_000, 12_000), false);
    assert.equal(undoStillGood(null, 20_000), false);
  });
});
