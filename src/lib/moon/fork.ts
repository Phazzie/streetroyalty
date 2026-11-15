/**
 * Fork culture rules. A fork is a copy of a design that lands on the
 * forker's own rack as a draft, with the originator's title baked in as
 * credit. The rule mirrors `canBuyDesign` on purpose — one ownership
 * language across the app:
 *
 * - Your own design: fork it any time (draft or published).
 * - Someone else's PUBLISHED design: fork it. That is the whole point.
 * - Someone else's PRIVATE draft: never. Not forkable, not buyable.
 */

export type ForkSource = {
  ownerId: string;
  status: string;
  title: string;
};

export function canForkDesign(source: ForkSource, userId: string): boolean {
  if (!userId || !source.ownerId) return false;
  if (source.ownerId === userId) return true;
  return source.status === "published";
}

/** Title for the forked copy — credit travels with the piece. */
export function forkTitle(source: ForkSource): string {
  return source.title.slice(0, 80);
}

/** Credit line shown wherever a fork appears. */
export function forkCredit(source: ForkSource): string {
  return `Forked from “${source.title}”`;
}
