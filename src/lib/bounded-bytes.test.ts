import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declaredByteLength, readCappedBytes } from "./bounded-bytes.ts";

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

describe("declaredByteLength", () => {
  it("reads a finite length and ignores junk", () => {
    assert.equal(declaredByteLength("1200"), 1200);
    assert.equal(declaredByteLength(null), null);
    assert.equal(declaredByteLength("nope"), null);
    assert.equal(declaredByteLength("-1"), null);
  });
});

describe("readCappedBytes", () => {
  it("returns bytes under the cap", async () => {
    const bytes = await readCappedBytes(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]), 4);
    assert.deepEqual(Array.from(bytes ?? []), [1, 2, 3]);
  });

  it("cancels once the next chunk would pass the cap", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const bytes = await readCappedBytes(stream, 4);
    assert.equal(bytes, null);
    assert.equal(cancelled, true);
  });

  it("rejects an empty body", async () => {
    assert.equal(await readCappedBytes(streamOf([]), 8), null);
  });
});
