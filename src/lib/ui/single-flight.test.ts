import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSingleFlight } from "./single-flight.ts";

describe("createSingleFlight", () => {
  it("runs the first call and drops the one that overlaps it", async () => {
    const run = createSingleFlight();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const first = run(async () => {
      started += 1;
      await gate;
      return "one";
    });
    const second = await run(async () => {
      started += 1;
      return "two";
    });
    assert.equal(second, undefined);
    assert.equal(started, 1);
    release();
    assert.equal(await first, "one");
    assert.equal(await run(async () => "three"), "three");
  });
});
