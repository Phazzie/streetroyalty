export const UNDO_MS = 12_000;

export function withoutId<T extends { id: string }>(
  items: readonly T[],
  id: string,
): { next: T[]; removed: T | null } {
  const removed = items.find((item) => item.id === id) ?? null;
  if (!removed) return { next: [...items], removed: null };
  return { next: items.filter((item) => item.id !== id), removed };
}

export function restoreItem<T extends { id: string }>(items: readonly T[], item: T, limit: number): T[] {
  if (items.some((entry) => entry.id === item.id)) return [...items];
  return [item, ...items].slice(0, limit);
}

export function undoStillGood(undo: { at: number } | null, now: number, ttl = UNDO_MS): boolean {
  return Boolean(undo && now - undo.at <= ttl);
}
