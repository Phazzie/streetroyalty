import { randomUUID } from "node:crypto";
import { getSql } from "../db.ts";
import {
  pairKey,
  pairsLeft,
  pickPair,
  rankByScore,
  type BattleSide,
  type NextBattle,
  type ThroneRow,
  type VoteTally,
} from "./battles.ts";

/**
 * Battles against the database. Reads are open; the one write, a vote, always belongs to
 * the verified user id it is handed and never to an id from the client.
 */

/** Enough pieces to keep every pair fresh without loading the whole rack into memory. */
const RING_SIZE = 400;
/** How many pairs a viewer can ask to step past in one request. */
const MAX_SKIP = 60;

type PieceRow = {
  id: string;
  slug: string;
  title: string;
  mockup_url: string | null;
  user_id: string;
  maker_name: string | null;
  maker_handle: string | null;
  wins: number;
  losses: number;
};

function toSide(row: PieceRow): BattleSide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    mockupUrl: row.mockup_url,
    maker: { name: row.maker_name?.trim() || "A maker", handle: row.maker_handle },
  };
}

export type NextBattleOptions = {
  /** Pair keys the viewer has just stepped past. Avoided while anything else is left. */
  skip?: readonly string[];
  /** The pair key that was on screen last. Its two pieces sit the next round out when they can. */
  after?: string;
};

/**
 * The next pair for this viewer: two published pieces they have not judged against each
 * other, never one of their own, least-seen pieces first.
 */
export async function nextBattle(
  userId: string | null,
  options: NextBattleOptions = {},
  random: () => number = Math.random,
): Promise<NextBattle> {
  const sql = await getSql();
  const signedIn = userId !== null;
  const rows = await sql<PieceRow>`
    select * from (
      select d.id, d.slug, d.title, d.mockup_url, d.user_id, d.updated_at,
        coalesce(p.display_name, u."name") as maker_name,
        p.handle as maker_handle,
        (select count(*)::int from battle_votes v where v.winner_id = d.id) as wins,
        (select count(*)::int from battle_votes v where v.loser_id = d.id) as losses
      from designs d
      left join profiles p on p.user_id = d.user_id
      left join "user" u on u."id" = d.user_id
      where d.status = 'published'
    ) piece
    order by piece.wins + piece.losses asc, piece.updated_at desc
    limit ${RING_SIZE}
  `;
  if (rows.length < 2) return { pair: null, reason: "few", signedIn, pairsLeft: null };

  const others = userId === null ? rows : rows.filter((row) => row.user_id !== userId);
  if (others.length < 2) return { pair: null, reason: "own", signedIn, pairsLeft: null };

  const judged = new Set<string>();
  if (userId !== null) {
    const votes = await sql<{ pair_key: string }>`
      select pair_key from battle_votes where voter_id = ${userId}
    `;
    for (const vote of votes) judged.add(vote.pair_key);
  }

  const contenders = others.map((row) => ({
    id: row.id,
    makerId: row.user_id,
    battles: Number(row.wins) + Number(row.losses),
    row,
  }));
  const left = signedIn
    ? pairsLeft(
        contenders.map((item) => item.id),
        judged,
      )
    : null;

  const stepped = (options.skip ?? []).slice(-MAX_SKIP).map(String);
  const rested = new Set(
    String(options.after ?? "")
      .split(":")
      .filter(Boolean)
      .slice(0, 2),
  );
  const picked =
    (stepped.length > 0
      ? pickPair(contenders, new Set([...judged, ...stepped]), random, rested)
      : null) ?? pickPair(contenders, judged, random, rested);
  if (!picked) return { pair: null, reason: "done", signedIn, pairsLeft: 0 };

  const [first, second] = picked;
  return {
    pair: { key: pairKey(first.id, second.id), left: toSide(first.row), right: toSide(second.row) },
    reason: "ready",
    signedIn,
    pairsLeft: left,
  };
}

async function tally(pairKeyValue: string, winnerId: string, loserId: string): Promise<VoteTally> {
  const sql = await getSql();
  const rows = await sql<{ winner_id: string; votes: number }>`
    select winner_id, count(*)::int as votes
    from battle_votes
    where pair_key = ${pairKeyValue}
    group by winner_id
  `;
  const votesFor = (id: string) => Number(rows.find((row) => row.winner_id === id)?.votes ?? 0);
  const winnerVotes = votesFor(winnerId);
  const loserVotes = votesFor(loserId);
  return {
    pairKey: pairKeyValue,
    winnerId,
    loserId,
    winnerVotes,
    loserVotes,
    total: winnerVotes + loserVotes,
  };
}

/**
 * Record this voter's pick for a pair. One vote per person per pair: voting on the same
 * pair again moves the vote. Hands back how everyone has voted on the pair, which the
 * voter only sees now that their own vote is in.
 */
export async function castVote(
  voterId: string,
  input: { winnerId: string; loserId: string },
): Promise<VoteTally> {
  const winnerId = String(input.winnerId ?? "").trim();
  const loserId = String(input.loserId ?? "").trim();
  if (!voterId) throw new Error("Sign in to vote.");
  if (!winnerId || !loserId) throw new Error("Pick one of the two pieces.");
  if (winnerId === loserId) throw new Error("A piece cannot battle itself.");

  const sql = await getSql();
  const pieces = await sql<{ id: string; user_id: string }>`
    select id, user_id from designs
    where id in (${winnerId}, ${loserId}) and status = 'published'
  `;
  if (pieces.length !== 2) throw new Error("One of those pieces is not on the rack.");
  if (pieces.some((piece) => piece.user_id === voterId)) {
    throw new Error("You cannot vote in a battle with your own piece.");
  }

  const key = pairKey(winnerId, loserId);
  await sql`
    insert into battle_votes (id, voter_id, pair_key, winner_id, loser_id)
    values (${randomUUID()}, ${voterId}, ${key}, ${winnerId}, ${loserId})
    on conflict (voter_id, pair_key)
    do update set winner_id = excluded.winner_id, loser_id = excluded.loser_id, created_at = now()
  `;
  return tally(key, winnerId, loserId);
}

/**
 * The throne: the ten published pieces with the best fair score. A piece has to have
 * been in at least one battle to hold a place.
 */
export async function throne(limit = 10): Promise<ThroneRow[]> {
  const sql = await getSql();
  const rows = await sql<PieceRow>`
    select d.id, d.slug, d.title, d.mockup_url, d.user_id,
      coalesce(p.display_name, u."name") as maker_name,
      p.handle as maker_handle,
      (select count(*)::int from battle_votes v where v.winner_id = d.id) as wins,
      (select count(*)::int from battle_votes v where v.loser_id = d.id) as losses
    from designs d
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    where d.status = 'published'
      and exists (
        select 1 from battle_votes v where v.winner_id = d.id or v.loser_id = d.id
      )
  `;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rankByScore(
    rows.map((row) => ({ id: row.id, wins: Number(row.wins), losses: Number(row.losses) })),
    limit,
  ).flatMap((ranked) => {
    const row = byId.get(ranked.id);
    if (!row) return [];
    return [
      {
        ...toSide(row),
        rank: ranked.rank,
        wins: ranked.wins,
        losses: ranked.losses,
        score: ranked.score,
      },
    ];
  });
}
