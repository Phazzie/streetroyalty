import { getSql, type Sql } from "../db.ts";
import {
  checkBio,
  checkDisplayName,
  checkHandle,
  handleCandidate,
  handleFromName,
  isHouseName,
  isReservedHandle,
  normalizeHandle,
  NAME_MAX,
} from "./handles.ts";
import { piecesFor } from "./rack.server.ts";
import type { MakerProfile, RackPiece } from "./types.ts";

export type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
  created_at: string;
};

type ProfileStatsRow = ProfileRow & {
  pieces: number;
  followers: number;
  following: number;
  crowns: number;
  followed_by_me: boolean;
};

async function profileOf(sql: Sql, userId: string): Promise<ProfileRow | null> {
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  return rows[0] ?? null;
}

/**
 * Every account gets a maker profile the first time one is needed. The handle comes
 * from the account's name, with digits added until it is free and not reserved.
 */
export async function ensureProfile(userId: string): Promise<ProfileRow> {
  const sql = await getSql();
  const existing = await profileOf(sql, userId);
  if (existing) return existing;

  const users = await sql<{ name: string | null; email: string | null }>`
    select "name", "email" from "user" where "id" = ${userId}
  `;
  const user = users[0];
  if (!user) throw new Error("That account does not exist.");
  const accountName = String(user.name ?? "").trim();
  // Sign-up falls back to the part of the email before the @ when no name is typed. That
  // is private, so it never becomes a public name or handle. The maker picks one on /me.
  const mailbox = String(user.email ?? "")
    .split("@")[0]
    ?.trim()
    .toLowerCase();
  const fromEmail =
    accountName.includes("@") || (Boolean(mailbox) && accountName.toLowerCase() === mailbox);
  const rawName = fromEmail ? "" : accountName;
  const named = checkDisplayName(rawName.slice(0, NAME_MAX));
  const displayName = named.ok ? named.value : "Maker";
  // An account called "Admin" or "Street Royalty" does not get @admin2: it starts as a plain maker.
  const derived = handleFromName(rawName);
  const base = isHouseName(derived) ? "maker" : derived;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    // The first tries count up (ada, ada2, ada3). After that the number is drawn at random,
    // so a crowded name like "maker" still lands in a try or two however many there are.
    const handle =
      attempt < 8
        ? handleCandidate(base, attempt)
        : handleCandidate(base, 99 + Math.floor(Math.random() * 999_900));
    if (isReservedHandle(handle)) continue;
    const made = await sql<ProfileRow>`
      insert into profiles (user_id, handle, display_name)
      values (${userId}, ${handle}, ${displayName})
      on conflict do nothing
      returning *
    `;
    if (made[0]) return made[0];
    // Nothing came back: either the handle is taken, or another request made this profile first.
    const raced = await profileOf(sql, userId);
    if (raced) return raced;
  }
  throw new Error("Could not find a free handle. Pick one on your maker page.");
}

async function profileStats(
  sql: Sql,
  viewerId: string | null,
  where: { handle: string } | { userId: string },
): Promise<ProfileStatsRow | null> {
  const viewer = viewerId ?? "";
  const handle = "handle" in where ? where.handle : "";
  const userId = "userId" in where ? where.userId : "";
  const rows = await sql<ProfileStatsRow>`
    select p.*,
      (select count(*) from designs d
        where d.user_id = p.user_id and d.status = 'published')::int as pieces,
      (select count(*) from follows f where f.maker_id = p.user_id)::int as followers,
      (select count(*) from follows f where f.follower_id = p.user_id)::int as following,
      (select count(*) from crowns c join designs d on d.id = c.design_id
        where d.user_id = p.user_id and d.status = 'published')::int as crowns,
      exists(
        select 1 from follows f where f.maker_id = p.user_id and f.follower_id = ${viewer}
      ) as followed_by_me
    from profiles p
    where (${handle}::text <> '' and p.handle = ${handle})
       or (${userId}::text <> '' and p.user_id = ${userId})
  `;
  return rows[0] ?? null;
}

function toProfile(row: ProfileStatsRow, viewerId: string | null): MakerProfile {
  return {
    handle: row.handle,
    name: row.display_name,
    bio: row.bio,
    joinedAt: String(row.created_at),
    pieces: Number(row.pieces),
    followers: Number(row.followers),
    following: Number(row.following),
    crowns: Number(row.crowns),
    followedByMe: Boolean(row.followed_by_me),
    isMe: viewerId != null && viewerId === row.user_id,
  };
}

/** The signed-in maker's own profile, made on first visit. */
export async function myProfile(userId: string): Promise<MakerProfile> {
  await ensureProfile(userId);
  const sql = await getSql();
  const row = await profileStats(sql, userId, { userId });
  if (!row) throw new Error("Your maker page did not load.");
  return toProfile(row, userId);
}

/** A maker's shop window: who they are and what they have on the rack. */
export async function makerPage(
  viewerId: string | null,
  rawHandle: string,
): Promise<{ maker: MakerProfile; pieces: RackPiece[] }> {
  const handle = normalizeHandle(rawHandle);
  const sql = await getSql();
  const row = handle ? await profileStats(sql, viewerId, { handle }) : null;
  if (!row) throw new Error("No maker goes by that handle.");
  const pieces = await piecesFor({ viewerId, sort: "fresh", makerId: row.user_id });
  return { maker: toProfile(row, viewerId), pieces };
}

function isUniqueViolation(reason: unknown): boolean {
  if (typeof reason !== "object" || reason === null) return false;
  const code = "code" in reason ? String(reason.code) : "";
  const message = "message" in reason ? String(reason.message) : "";
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

/** Change your own name, handle and bio. The row is always the caller's. */
export async function updateProfile(
  userId: string,
  input: { name?: unknown; handle?: unknown; bio?: unknown },
): Promise<MakerProfile> {
  const current = await ensureProfile(userId);
  const name = checkDisplayName(String(input.name ?? current.display_name));
  if (!name.ok) throw new Error(name.error);
  const bio = checkBio(String(input.bio ?? current.bio));
  if (!bio.ok) throw new Error(bio.error);

  let handle = current.handle;
  const wanted = normalizeHandle(String(input.handle ?? current.handle));
  if (wanted !== current.handle) {
    const checked = checkHandle(wanted);
    if (!checked.ok) throw new Error(checked.error);
    handle = checked.value;
  }

  const sql = await getSql();
  const taken = await sql<{ user_id: string }>`
    select user_id from profiles where handle = ${handle} and user_id <> ${userId}
  `;
  if (taken.length > 0) throw new Error("That handle is taken. Try another.");
  try {
    await sql`
      update profiles
      set handle = ${handle}, display_name = ${name.value}, bio = ${bio.value}
      where user_id = ${userId}
    `;
  } catch (reason: unknown) {
    if (isUniqueViolation(reason)) throw new Error("That handle is taken. Try another.");
    throw reason;
  }
  return myProfile(userId);
}

/**
 * Follow or unfollow a maker. With `want` left out it flips; with it set, the call
 * lands on that state however many times it is sent.
 */
export async function toggleFollow(
  userId: string,
  rawHandle: string,
  want?: boolean,
): Promise<{ following: boolean; followers: number }> {
  const sql = await getSql();
  const handle = normalizeHandle(rawHandle);
  const makers = await sql<{ user_id: string }>`
    select user_id from profiles where handle = ${handle}
  `;
  const maker = makers[0];
  if (!maker) throw new Error("No maker goes by that handle.");
  if (maker.user_id === userId) throw new Error("You cannot follow yourself.");
  // A follow names you in the maker's activity, so you get a maker name of your own first.
  await ensureProfile(userId);

  const already = await sql<{ follower_id: string }>`
    select follower_id from follows where follower_id = ${userId} and maker_id = ${maker.user_id}
  `;
  const following = want ?? already.length === 0;
  if (following) {
    await sql`
      insert into follows (follower_id, maker_id) values (${userId}, ${maker.user_id})
      on conflict do nothing
    `;
  } else {
    await sql`delete from follows where follower_id = ${userId} and maker_id = ${maker.user_id}`;
  }
  const counts = await sql<{ count: number }>`
    select count(*)::int as count from follows where maker_id = ${maker.user_id}
  `;
  return { following, followers: Number(counts[0]?.count ?? 0) };
}
