import { getSql } from "../db.ts";
import type { ActivityItem, ActivityPart, ShelfPiece } from "./activity-api.ts";

/**
 * A maker's feed: crowns, followers, remixes, battles and street scans on their own
 * published pieces. Every query starts from the verified user id and nothing else,
 * so one maker never reads another's.
 *
 * Battles and scans are a day's total per piece. A battle row never says who voted.
 */

/** How many rows the feed returns. */
export const ACTIVITY_LIMIT = 40;
/** How many crowned pieces the shelf returns. */
export const SHELF_LIMIT = 60;

type Stamp = Date | string;

type ActorColumns = {
  actor_handle: string | null;
  actor_profile_name: string | null;
  actor_user_name: string | null;
};

function iso(value: Stamp): string {
  return new Date(value).toISOString();
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The name from the maker's profile, or the one they signed up with. A link only if they have a page. */
function actor(row: ActorColumns): ActivityPart {
  const text = (row.actor_profile_name || row.actor_user_name || "").trim() || "Someone";
  return row.actor_handle ? { text, to: "maker", handle: row.actor_handle } : { text };
}

function piece(title: string, slug: string): ActivityPart {
  return { text: title, to: "piece", slug };
}

/** "won 3 battles and lost 1", "won 1 battle", "lost 2 battles". */
export function battleWords(won: number, lost: number): string {
  if (won > 0 && lost > 0) return ` won ${plural(won, "battle", "battles")} and lost ${lost}.`;
  if (won > 0) return ` won ${plural(won, "battle", "battles")}.`;
  return ` lost ${plural(lost, "battle", "battles")}.`;
}

/** "was scanned 4 times out in the street." */
export function scanWords(scans: number): string {
  return ` was scanned ${scans === 1 ? "once" : `${scans} times`} out in the street.`;
}

/**
 * A scan row has a day and no clock time. Noon UTC lands on the same calendar day
 * almost everywhere, and it is held back to now so today's row is never in the future.
 */
function scanMoment(day: string, now: Date): string {
  const noon = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(noon.getTime())) return now.toISOString();
  return (noon.getTime() > now.getTime() ? now : noon).toISOString();
}

export async function listActivity(
  userId: string,
  now: Date = new Date(),
): Promise<ActivityItem[]> {
  if (!userId) return [];
  const sql = await getSql();

  const crowns = await sql<ActorColumns & { at: Stamp; slug: string; title: string }>`
    select c.created_at as at, d.slug, d.title,
      p.handle as actor_handle, p.display_name as actor_profile_name, u."name" as actor_user_name
    from crowns c
    join designs d on d.id = c.design_id
    left join profiles p on p.user_id = c.user_id
    left join "user" u on u."id" = c.user_id
    where d.user_id = ${userId} and d.status = 'published' and c.user_id <> ${userId}
    order by c.created_at desc
    limit ${ACTIVITY_LIMIT}
  `;

  const follows = await sql<ActorColumns & { at: Stamp }>`
    select f.created_at as at,
      p.handle as actor_handle, p.display_name as actor_profile_name, u."name" as actor_user_name
    from follows f
    left join profiles p on p.user_id = f.follower_id
    left join "user" u on u."id" = f.follower_id
    where f.maker_id = ${userId} and f.follower_id <> ${userId}
    order by f.created_at desc
    limit ${ACTIVITY_LIMIT}
  `;

  // There is no published-at column. Publishing stamps updated_at, so that is the moment used.
  const remixes = await sql<
    ActorColumns & {
      at: Stamp;
      slug: string;
      title: string;
      remix_slug: string;
      remix_title: string;
    }
  >`
    select kid.updated_at as at, mine.slug, mine.title,
      kid.slug as remix_slug, kid.title as remix_title,
      p.handle as actor_handle, p.display_name as actor_profile_name, u."name" as actor_user_name
    from design_lineage l
    join designs mine on mine.id = l.parent_id
    join designs kid on kid.id = l.design_id
    left join profiles p on p.user_id = kid.user_id
    left join "user" u on u."id" = kid.user_id
    where mine.user_id = ${userId} and mine.status = 'published'
      and kid.status = 'published' and kid.user_id <> ${userId}
    order by kid.updated_at desc
    limit ${ACTIVITY_LIMIT}
  `;

  const battles = await sql<{
    at: Stamp;
    day: string;
    slug: string;
    title: string;
    won: number;
    lost: number;
  }>`
    select max(v.at) as at, v.day, d.slug, d.title,
      sum(v.won)::int as won, sum(v.lost)::int as lost
    from (
      select winner_id as design_id, created_at as at, 1 as won, 0 as lost,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day
      from battle_votes
      union all
      select loser_id as design_id, created_at as at, 0 as won, 1 as lost,
        to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day
      from battle_votes
    ) v
    join designs d on d.id = v.design_id
    where d.user_id = ${userId} and d.status = 'published'
    group by d.id, d.slug, d.title, v.day
    order by max(v.at) desc
    limit ${ACTIVITY_LIMIT}
  `;

  const scans = await sql<{ day: string; slug: string; title: string; scans: number }>`
    select s.day, d.slug, d.title, s.scans
    from tag_scans s
    join designs d on d.id = s.design_id
    where d.user_id = ${userId} and d.status = 'published' and s.scans > 0
    order by s.day desc, s.scans desc
    limit ${ACTIVITY_LIMIT}
  `;

  const items: ActivityItem[] = [];

  for (const row of crowns) {
    const who = actor(row);
    items.push({
      id: `crown:${row.slug}:${"handle" in who ? who.handle : who.text}`,
      kind: "crown",
      when: iso(row.at),
      rollup: false,
      parts: [who, { text: " crowned " }, piece(row.title, row.slug), { text: "." }],
    });
  }

  for (const row of follows) {
    const who = actor(row);
    items.push({
      id: `follow:${"handle" in who ? who.handle : who.text}`,
      kind: "follow",
      when: iso(row.at),
      rollup: false,
      parts: [who, { text: " started following you." }],
    });
  }

  for (const row of remixes) {
    items.push({
      id: `remix:${row.remix_slug}`,
      kind: "remix",
      when: iso(row.at),
      rollup: false,
      parts: [
        actor(row),
        { text: " remixed " },
        piece(row.title, row.slug),
        { text: " into " },
        piece(row.remix_title, row.remix_slug),
        { text: "." },
      ],
    });
  }

  for (const row of battles) {
    const won = Number(row.won);
    const lost = Number(row.lost);
    items.push({
      id: `battle:${row.slug}:${row.day}`,
      kind: "battle",
      when: iso(row.at),
      rollup: true,
      won,
      lost,
      parts: [piece(row.title, row.slug), { text: battleWords(won, lost) }],
    });
  }

  for (const row of scans) {
    const count = Number(row.scans);
    items.push({
      id: `scan:${row.slug}:${row.day}`,
      kind: "scan",
      when: scanMoment(row.day, now),
      rollup: true,
      scans: count,
      parts: [piece(row.title, row.slug), { text: scanWords(count) }],
    });
  }

  items.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : a.id.localeCompare(b.id)));

  // Two people with no page and the same name would share a key. Number the repeats.
  const seen = new Map<string, number>();
  return items.slice(0, ACTIVITY_LIMIT).map((item) => {
    const count = seen.get(item.id) ?? 0;
    seen.set(item.id, count + 1);
    return count === 0 ? item : { ...item, id: `${item.id}#${count}` };
  });
}

export async function listShelf(userId: string): Promise<ShelfPiece[]> {
  if (!userId) return [];
  const sql = await getSql();
  const rows = await sql<{
    at: Stamp;
    slug: string;
    title: string;
    mockup_url: string | null;
    maker_handle: string | null;
    maker_profile_name: string | null;
    maker_user_name: string | null;
  }>`
    select c.created_at as at, d.slug, d.title, d.mockup_url,
      p.handle as maker_handle, p.display_name as maker_profile_name, u."name" as maker_user_name
    from crowns c
    join designs d on d.id = c.design_id
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    where c.user_id = ${userId} and d.status = 'published'
    order by c.created_at desc, d.slug asc
    limit ${SHELF_LIMIT}
  `;
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    mockupUrl: row.mockup_url,
    maker: {
      name: (row.maker_profile_name || row.maker_user_name || "").trim() || "A maker",
      handle: row.maker_handle,
    },
    crownedAt: iso(row.at),
  }));
}
