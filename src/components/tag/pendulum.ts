/**
 * A tag on a string is a pendulum: gravity pulls it back to straight, the air slows it.
 * This is that sum, one small step at a time. Angles are degrees, time is seconds.
 */

export type Swing = { angle: number; speed: number };

/** How hard it is pulled back to straight. About one swing a second. */
const PULL = 38;
/** How fast it loses speed. It comes to rest in about three seconds. */
const DRAG = 1.6;
/** It can never tip further than this, however hard it is pushed. */
export const MAX_ANGLE = 24;

export function step(swing: Swing, seconds: number): Swing {
  const dt = Math.min(0.032, Math.max(0, seconds));
  const speed = swing.speed + (-PULL * swing.angle - DRAG * swing.speed) * dt;
  const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, swing.angle + speed * dt));
  return { angle, speed: Math.abs(angle) === MAX_ANGLE ? 0 : speed };
}

/** Still enough that nobody would see it move: under a pixel at the bottom of the tag. */
export function atRest(swing: Swing): boolean {
  return Math.abs(swing.angle) < 0.12 && Math.abs(swing.speed) < 0.8;
}
