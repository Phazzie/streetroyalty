/** Absolute quantity from a client. Null means remove the line. */
export function normalizeCartQuantity(quantity: number): number | null {
  if (!Number.isFinite(quantity)) throw new Error("Quantity has to be a number.");
  const next = Math.round(quantity);
  if (next <= 0) return null;
  return Math.min(10, next);
}

/** One step up or down. Removing is how a line hits zero. */
export function cartDelta(delta: number): -1 | 1 {
  if (delta === 1 || delta === -1) return delta;
  throw new Error("Quantity moves by one.");
}
