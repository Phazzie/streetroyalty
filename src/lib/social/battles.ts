/**
 * Battles: the maths and the shapes. No database and no network in here, so it is safe
 * to import from client code and cheap to test.
 */

export type BattleMaker = {
  name: string;
  /** Null when the maker has not picked a handle yet. */
  handle: string | null;
};

/** One side of a battle. */
export type BattleSide = {
  id: string;
  slug: string;
  title: string;
  mockupUrl: string | null;
  maker: BattleMaker;
};

export type BattlePair = {
  /** The two design ids, sorted, joined by ":". */
  key: string;
  left: BattleSide;
  right: BattleSide;
};

/**
 * Why there is, or is not, a pair to judge.
 *   ready  a pair is waiting
 *   few    fewer than two pieces are on the rack
 *   own    the rack has pieces, but not two that belong to somebody else
 *   done   the viewer has judged every pair there is
 */
export type BattleReason = "ready" | "few" | "own" | "done";

export type NextBattle = {
  pair: BattlePair | null;
  reason: BattleReason;
  /** Whether a vote from this viewer would count. */
  signedIn: boolean;
  /** Pairs this viewer has not judged yet, counting the one on screen. Null when signed out. */
  pairsLeft: number | null;
};

/** How everyone has voted on one pair. Only handed out after the viewer has voted. */
export type VoteTally = {
  pairKey: string;
  winnerId: string;
  loserId: string;
  winnerVotes: number;
  loserVotes: number;
  total: number;
};

export type ThroneRow = {
  rank: number;
  id: string;
  slug: string;
  title: string;
  mockupUrl: string | null;
  maker: BattleMaker;
  wins: number;
  losses: number;
  /** Wilson lower bound on the win rate, 0 to 1. */
  score: number;
};

/** The key a pair is stored under: the same whichever side each piece stood on. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * The Wilson lower bound on a win rate: the lowest win rate the record still supports,
 * at about 95% confidence. A piece that won its only battle scores about 0.21 and one
 * that won 40 of 50 scores about 0.67, so a lucky start does not take the throne.
 * No battles scores 0.
 */
export function wilsonLowerBound(wins: number, losses: number, z = 1.96): number {
  const won = count(wins);
  const total = won + count(losses);
  if (total === 0) return 0;
  const rate = won / total;
  const z2 = z * z;
  const centre = rate + z2 / (2 * total);
  const margin = z * Math.sqrt((rate * (1 - rate) + z2 / (4 * total)) / total);
  const bound = (centre - margin) / (1 + z2 / total);
  return Math.min(1, Math.max(0, bound));
}

export type BattleRecord = { id: string; wins: number; losses: number };

/**
 * Best first. The fair score decides; on a tie the piece with more wins goes first,
 * then the one with fewer losses, then the id so the order never flickers.
 */
export function rankByScore<T extends BattleRecord>(
  rows: readonly T[],
  limit = 10,
): (T & { rank: number; score: number })[] {
  return rows
    .map((row) => ({ ...row, score: wilsonLowerBound(row.wins, row.losses) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.wins - a.wins ||
        a.losses - b.losses ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, Math.max(0, limit))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Two whole percentages that always add up to 100, winner first. With no votes it is an
 * even split.
 */
export function splitPercent(winnerVotes: number, loserVotes: number): [number, number] {
  const won = count(winnerVotes);
  const total = won + count(loserVotes);
  if (total === 0) return [50, 50];
  const share = Math.round((won / total) * 100);
  return [share, 100 - share];
}

export type Contender = {
  id: string;
  makerId: string;
  /** How many battles this piece has been in, for everyone. */
  battles: number;
};

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = held;
  }
  return copy;
}

/**
 * Pick the next pair. The piece that has been seen least goes first, and it meets the
 * least-seen piece it has not already been judged against, from a different maker when
 * there is one. Pieces in `rested` were on screen a moment ago and wait at the back, so
 * the same piece does not fight twice in a row while others are free. Which side each
 * stands on is a coin toss. Null when no pair is left.
 */
export function pickPair<T extends Contender>(
  contenders: readonly T[],
  judged: ReadonlySet<string>,
  random: () => number = Math.random,
  rested: ReadonlySet<string> = new Set(),
): [T, T] | null {
  const tired = (item: T) => (rested.has(item.id) ? 1 : 0);
  // Shuffle first, then a stable sort: pieces that are level come out in a random order.
  const order = shuffled(contenders, random).sort(
    (a, b) => tired(a) - tired(b) || a.battles - b.battles,
  );
  for (const first of order) {
    let rival: T | null = null;
    let rivalIsStranger = false;
    for (const other of order) {
      if (other.id === first.id || judged.has(pairKey(first.id, other.id))) continue;
      const stranger = other.makerId !== first.makerId;
      // `order` is already least-seen first, so the first match of each kind is the best one.
      if (!rival || (stranger && !rivalIsStranger)) {
        rival = other;
        rivalIsStranger = stranger;
      }
      if (rivalIsStranger) break;
    }
    if (rival) return random() < 0.5 ? [first, rival] : [rival, first];
  }
  return null;
}

/** How many pairs among these pieces the viewer has not judged. */
export function pairsLeft(ids: readonly string[], judged: ReadonlySet<string>): number {
  const present = new Set(ids);
  let done = 0;
  for (const key of judged) {
    const [a, b] = key.split(":");
    if (a && b && present.has(a) && present.has(b)) done += 1;
  }
  const total = (present.size * (present.size - 1)) / 2;
  return Math.max(0, total - done);
}
