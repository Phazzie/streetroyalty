import { describe, expect, it } from "vitest";
import { atRest, MAX_ANGLE, step, type Swing } from "./pendulum.ts";

function run(start: Swing, seconds: number): { end: Swing; widest: number; crossings: number } {
  let swing = start;
  let widest = 0;
  let crossings = 0;
  for (let time = 0; time < seconds; time += 1 / 60) {
    const next = step(swing, 1 / 60);
    if (Math.sign(next.angle) !== Math.sign(swing.angle) && swing.angle !== 0) crossings += 1;
    widest = Math.max(widest, Math.abs(next.angle));
    swing = next;
  }
  return { end: swing, widest, crossings };
}

describe("the tag on its string", () => {
  it("stays put when nothing pushes it", () => {
    expect(step({ angle: 0, speed: 0 }, 1 / 60)).toEqual({ angle: 0, speed: 0 });
    expect(atRest({ angle: 0, speed: 0 })).toBe(true);
  });

  it("swings back and forth a few times, then comes to rest", () => {
    const pushed = run({ angle: 0, speed: 70 }, 1.5);
    expect(pushed.widest).toBeGreaterThan(6);
    expect(pushed.widest).toBeLessThan(12);
    expect(pushed.crossings).toBeGreaterThanOrEqual(2);
    expect(atRest(pushed.end)).toBe(false);

    const later = run({ angle: 0, speed: 70 }, 9);
    expect(atRest(later.end)).toBe(true);
  });

  it("swings the other way when pushed the other way", () => {
    expect(step({ angle: 0, speed: -70 }, 1 / 60).angle).toBeLessThan(0);
    expect(step({ angle: 0, speed: 70 }, 1 / 60).angle).toBeGreaterThan(0);
  });

  it("never tips past its limit, however hard or long the push", () => {
    const shoved = run({ angle: 0, speed: 100000 }, 3);
    expect(shoved.widest).toBeLessThanOrEqual(MAX_ANGLE);
    expect(Number.isFinite(shoved.end.angle)).toBe(true);
    // A stalled tab hands back one huge gap between frames. It is treated as a short one.
    const stalled = step({ angle: 5, speed: 0 }, 30);
    expect(Math.abs(stalled.angle)).toBeLessThanOrEqual(5);
  });
});
