import { getSql } from "../db.ts";
import { slugify } from "../studio/validate.ts";

/**
 * Remix with credit. A remix is a draft copy of a published piece, owned by whoever
 * made the copy, with one row in design_lineage that points back at the piece it came
 * from and at the original that started the line. That row is never rewritten, so the
 * credit stays put even when the original leaves the rack.
 */

/** One piece in a family tree, as anyone may see it. */
export type FamilyNode = {
  /** Null once the piece is off the rack or deleted: there is nothing to link to. */
  slug: string | null;
  /** Null only when the piece was deleted outright. */
  title: string | null;
  /** Only pieces on the rack show their picture, and only while the tree's pictures stay light. */
  mockupUrl: string | null;
  /** Null only when the piece was deleted outright, because the maker went with the row. */
  maker: { name: string; handle: string | null } | null;
  onRack: boolean;
};

/** A direct remix, plus how many more published pieces hang below it. */
export type FamilyRemix = FamilyNode & { below: number };

export type PieceFamily = {
  /** The original first, then each generation down to this piece, which is last. */
  chain: FamilyNode[];
  /**
   * True when a piece in the middle was deleted and the line above it is lost. The chain
   * then jumps from the original straight to the deleted piece's place.
   */
  broken: boolean;
  /** Published pieces remixed straight from this one, oldest first. */
  remixes: FamilyRemix[];
  /** Direct remixes on the rack. Can be more than the list, which stops at 24. */
  remixCount: number;
  /** Every published piece below this one, at any depth. */
  descendants: number;
  /**
   * True when the family below is too big to count in one go. remixCount and descendants
   * are then a floor, and the page says "at least".
   */
  atLeast: boolean;
};

/** How much one open request for a family is allowed to read and send back. */
export type FamilyLimits = {
  /** Pieces below this one that are walked before the count stops. */
  walk: number;
  /** Longest single picture, in characters. A sandbox mockup is a data URL and can be megabytes. */
  picture: number;
  /** All pictures in one answer, in characters. */
  pictures: number;
};

export const FAMILY_LIMITS: FamilyLimits = { walk: 5000, picture: 300_000, pictures: 1_500_000 };

const SUFFIX = " remix";
const MAX_TITLE = 80;
const MAX_DEPTH = 40;
const MAX_REMIXES_SHOWN = 24;
/** Each copy can carry megabytes of artwork, so one person gets this many an hour. */
export const REMIX_HOURLY_LIMIT = 30;

/** "<title> remix", kept to 80 characters without losing the word, and never "remix remix". */
export function remixTitle(title: string): string {
  const clean = title.trim();
  if (/\bremix$/i.test(clean)) return clean.slice(0, MAX_TITLE);
  return `${clean.slice(0, MAX_TITLE - SUFFIX.length).trimEnd()}${SUFFIX}`;
}

/** Copy a published piece into a draft the caller owns, and record where it came from. */
export async function remixDesign(userId: string, slug: string): Promise<{ designId: string }> {
  if (!userId) throw new Error("Sign in to remix a piece.");
  const sql = await getSql();
  const found = await sql<{ id: string; title: string }>`
    select id, title from designs where slug = ${slug} and status = 'published'
  `;
  const source = found[0];
  if (!source) throw new Error("That piece is not on the rack, so it cannot be remixed.");

  const recent = await sql<{ count: number }>`
    select count(*)::int as count
    from design_lineage l
    join designs d on d.id = l.design_id
    where d.user_id = ${userId} and l.created_at > now() - interval '1 hour'
  `;
  if (Number(recent[0]?.count ?? 0) >= REMIX_HOURLY_LIMIT) {
    throw new Error("That is a lot of remixes in one hour. Finish one, then come back.");
  }

  const id = crypto.randomUUID();
  const title = remixTitle(source.title);
  const newSlug = slugify(title, id);
  // One statement, so a copy can never exist without its credit. It reads the source
  // again with the same guard, in case the piece left the rack a moment ago.
  let made: { design_id: string }[];
  try {
    made = await sql<{ design_id: string }>`
    with src as (
      select * from designs where id = ${source.id} and status = 'published'
    ),
    copy as (
      insert into designs (
        id, user_id, collection_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, print_file_id, mockup_url, retail_cents, currency, provider_product_id
      )
      select
        ${id}, ${userId}, null, ${title}, ${newSlug}, 'draft', product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, null, null, retail_cents, currency, null
      from src
      returning id
    )
    insert into design_lineage (design_id, parent_id, root_id)
    select
      copy.id,
      src.id,
      coalesce((select l.root_id from design_lineage l where l.design_id = src.id), src.id)
    from copy, src
    returning design_id
  `;
  } catch {
    // Whatever the database said, it is not for the person who tapped the button.
    throw new Error("The remix did not save. Try again.");
  }
  if (!made[0]) throw new Error("That piece is not on the rack, so it cannot be remixed.");
  return { designId: id };
}

type NodeRow = {
  id: string | null;
  slug: string | null;
  title: string | null;
  mockup_url: string | null;
  status: string | null;
  handle: string | null;
  display_name: string | null;
  user_name: string | null;
};

function node(row: NodeRow | undefined): FamilyNode {
  if (!row?.id) return { slug: null, title: null, mockupUrl: null, maker: null, onRack: false };
  const onRack = row.status === "published";
  return {
    slug: onRack ? row.slug : null,
    title: row.title,
    mockupUrl: onRack ? row.mockup_url : null,
    maker: {
      name: row.display_name?.trim() || row.user_name?.trim() || "A maker",
      handle: row.handle ?? null,
    },
    onRack,
  };
}

/** The line a published piece came from, and what has been made from it since. */
export async function readFamily(
  slug: string,
  limits: FamilyLimits = FAMILY_LIMITS,
): Promise<PieceFamily> {
  const sql = await getSql();
  // A picture over the limit is left in the database: the tree draws a blank tile for it.
  const selfRows = await sql<NodeRow>`
    select d.id, d.slug, d.title,
      case when length(d.mockup_url) <= ${limits.picture} then d.mockup_url end as mockup_url,
      d.status, p.handle, p.display_name,
      u."name" as user_name
    from designs d
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    where d.slug = ${slug} and d.status = 'published'
  `;
  const self = selfRows[0];
  if (!self?.id) throw new Error("That piece is not on the rack.");

  // Walk up. Each row is one ancestor, nearest first; a deleted one comes back with no design.
  const up = await sql<NodeRow & { ancestor_id: string; root_id: string; depth: number }>`
    with recursive up as (
      select l.parent_id, l.root_id, 1 as depth
      from design_lineage l where l.design_id = ${self.id}
      union all
      select l.parent_id, l.root_id, up.depth + 1
      from design_lineage l
      join up on l.design_id = up.parent_id
      where up.depth < ${MAX_DEPTH}
    )
    select up.parent_id as ancestor_id, up.root_id, up.depth, d.id, d.slug, d.title,
      case when d.status = 'published' and length(d.mockup_url) <= ${limits.picture}
        then d.mockup_url end as mockup_url,
      d.status, p.handle, p.display_name, u."name" as user_name
    from up
    left join designs d on d.id = up.parent_id
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    order by up.depth asc
  `;
  const ancestors = up.map(node);
  let broken = false;
  const top = up[up.length - 1];
  if (top && top.ancestor_id !== top.root_id) {
    // The walk stopped short of the original: a piece on the way was deleted and took its
    // own lineage row with it. The original is still named on every row below, so credit it.
    const rootRows = await sql<NodeRow>`
      select d.id, d.slug, d.title,
        case when d.status = 'published' and length(d.mockup_url) <= ${limits.picture}
          then d.mockup_url end as mockup_url,
        d.status, p.handle, p.display_name, u."name" as user_name
      from (select ${top.root_id}::text as root_id) r
      left join designs d on d.id = r.root_id
      left join profiles p on p.user_id = d.user_id
      left join "user" u on u."id" = d.user_id
    `;
    ancestors.push(node(rootRows[0]));
    broken = true;
  }

  // Walk down once. "top" is the direct remix each descendant hangs under.
  // The walk stops after limits.walk pieces, so one huge family cannot tie the database up.
  const down = await sql<{ top: string; walked: number; on_rack: number; top_on_rack: number }>`
    with recursive down as (
      select l.design_id as top, l.design_id, 1 as depth
      from design_lineage l where l.parent_id = ${self.id}
      union all
      select down.top, l.design_id, down.depth + 1
      from design_lineage l
      join down on l.parent_id = down.design_id
      where down.depth < ${MAX_DEPTH}
    )
    select seen.top,
      count(*)::int as walked,
      count(*) filter (where d.status = 'published')::int as on_rack,
      count(*) filter (where d.status = 'published' and d.id = seen.top)::int as top_on_rack
    from (select * from down limit ${limits.walk}) seen
    join designs d on d.id = seen.design_id
    group by seen.top
  `;
  const atLeast = down.reduce((sum, row) => sum + Number(row.walked), 0) >= limits.walk;
  const below = new Map(
    down.map((row) => [row.top, Number(row.on_rack) - Number(row.top_on_rack)]),
  );
  const descendants = down.reduce((sum, row) => sum + Number(row.on_rack), 0);
  const remixCount = down.reduce((sum, row) => sum + Number(row.top_on_rack), 0);

  const remixRows = await sql<NodeRow>`
    select d.id, d.slug, d.title,
      case when length(d.mockup_url) <= ${limits.picture} then d.mockup_url end as mockup_url,
      d.status, p.handle, p.display_name, u."name" as user_name
    from design_lineage l
    join designs d on d.id = l.design_id
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    where l.parent_id = ${self.id} and d.status = 'published'
    order by l.created_at asc, d.id asc
    limit ${MAX_REMIXES_SHOWN}
  `;

  const here = node(self);
  const remixes = remixRows.map((row) => ({ ...node(row), below: below.get(row.id ?? "") ?? 0 }));
  // This piece first, then its line from the nearest parent up, then the remixes.
  keepPicturesLight([here, ...ancestors, ...remixes], limits.pictures);

  return {
    chain: [...ancestors.reverse(), here],
    broken,
    remixes,
    remixCount,
    descendants,
    atLeast,
  };
}

/**
 * Drop pictures, in place, once the ones already kept add up to the budget. Earlier
 * nodes win. The tree draws a blank tile where a picture was dropped.
 */
export function keepPicturesLight(nodes: FamilyNode[], budget: number): void {
  let spent = 0;
  for (const item of nodes) {
    const size = item.mockupUrl?.length ?? 0;
    if (spent + size > budget) item.mockupUrl = null;
    else spent += size;
  }
}
