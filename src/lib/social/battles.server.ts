import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { safeEqualText } from "../pod/signature.ts";
import { getSql, type Sql } from "../db.ts";
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
const MAX_SKIP = 24;

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

/** Votes one person can cast in a day. A real person judging pairs never gets near it. */
export const DAILY_VOTE_LIMIT = 500;

const ticketRef = globalThis as typeof globalThis & { __srBattleTicketSecret__?: string };

/** Signs tickets with the app's own secret, or with one that lasts the process, the way sign-in does. */
function ticketSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (configured) return `battle-ticket:${configured}`;
  ticketRef.__srBattleTicketSecret__ ??= randomBytes(32).toString("hex");
  return ticketRef.__srBattleTicketSecret__;
}

/** The ticket that says this pair was shown to this voter on this UTC day. */
export function battleTicket(voterId: string, key: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", ticketSecret())
    .update(`${voterId}|${key}|${day}`)
    .digest("base64url");
}

/** A ticket from today or yesterday, so a pair shown just before midnight can still be judged. */
export function ticketValid(
  voterId: string,
  key: string,
  ticket: string,
  now: Date = new Date(),
): boolean {
  if (!ticket) return false;
  const yesterday = new Date(now.getTime() - 86_400_000);
  return [now, yesterday].some((day) => safeEqualText(battleTicket(voterId, key, day), ticket));
}

/** One piece's picture, read on its own so ranking never has to carry every picture. */
async function withPicture(sql: Sql, row: PieceRow): Promise<PieceRow> {
  const found = await sql<{ mockup_url: string | null }>`
    select mockup_url from designs where id = ${row.id}
  `;
  return { ...row, mockup_url: found[0]?.mockup_url ?? null };
}

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
  const { ensureLabelStock } = await import("../label/stock.server.ts");
  await ensureLabelStock();
  const sql = await getSql();
  const signedIn = userId !== null;
  const rows = await sql<PieceRow>`
    select * from (
      select d.id, d.slug, d.title, null::text as mockup_url, d.user_id, d.updated_at,
        coalesce(p.display_name, 'A maker') as maker_name,
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
    pair: {
      key: pairKey(first.id, second.id),
      left: toSide(await withPicture(sql, first.row)),
      right: toSide(await withPicture(sql, second.row)),
      ticket: userId === null ? undefined : battleTicket(userId, pairKey(first.id, second.id)),
    },
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
  input: { winnerId: string; loserId: string; ticket?: string },
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
  // Only a pair the server showed this voter counts. Without this, a script could vote one
  // piece over every other piece and put it on the throne.
  if (!ticketValid(voterId, key, String(input.ticket ?? ""))) {
    throw new Error("Vote on the pair you were shown. Load a new pair and pick again.");
  }
  const { takeQuota, windowKey } = await import("./quota.server.ts");
  const allowed = await takeQuota(sql, {
    userId: voterId,
    action: "vote",
    window: windowKey(new Date(), "day"),
    limit: DAILY_VOTE_LIMIT,
  });
  if (!allowed) throw new Error("That is a lot of battles for one day. Come back tomorrow.");
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
    select d.id, d.slug, d.title, null::text as mockup_url, d.user_id,
      coalesce(p.display_name, 'A maker') as maker_name,
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
  const ranked = rankByScore(
    rows.map((row) => ({ id: row.id, wins: Number(row.wins), losses: Number(row.losses) })),
    limit,
  );
  // Only the pieces on the board bring their pictures, so the read stays small as the rack grows.
  for (const entry of ranked) {
    const row = byId.get(entry.id);
    if (row) byId.set(entry.id, await withPicture(sql, row));
  }
  return ranked.flatMap((ranked) => {
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
