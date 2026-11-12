import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settleRetry } from "./piece-batch.ts";

describe("settleRetry", () => {
  it("swaps only the pieces that regenerated", () => {
    const { nextIds, replaced } = settleRetry(["tee", "jeans", "shoes"], ["tee-2", null, "shoes-2"]);
    assert.deepEqual(nextIds, ["tee-2", "jeans", "shoes-2"]);
    assert.deepEqual(replaced, ["tee", "shoes"]);
  });

  it("keeps a hole so the next retry stays aligned", () => {
    const first = settleRetry([], ["tee", null, "shoes"]);
    assert.deepEqual(first.nextIds, ["tee", null, "shoes"]);
    const second = settleRetry(first.nextIds, ["tee-2", "jeans", null]);
    assert.deepEqual(second.nextIds, ["tee-2", "jeans", "shoes"]);
    assert.deepEqual(second.replaced, ["tee"]);
  });
});
