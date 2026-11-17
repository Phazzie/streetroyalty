import { getSql } from "../db.ts";
import { getShopDesign } from "../studio/designs.server.ts";
import { summary, type DesignRow } from "../studio/shared.server.ts";
import type { ShopPiece } from "../studio/models.ts";
import type { RackPiece, RackSort } from "./types.ts";

type PieceRow = DesignRow & {
  maker_handle: string | null;
  maker_name: string | null;
  crown_count: number;
  crowned_by_me: boolean;
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function fullHex(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!HEX.test(text)) return null;
  const hex = text.slice(1).toLowerCase();
  if (hex.length === 6) return `#${hex}`;
  return `#${[...hex].map((digit) => digit + digit).join("")}`;
}

/** Garment colour first, then each distinct text colour in layer order, as #rrggbb. */
export function paletteOf(colorHex: string, layersJson: string): string[] {
  const palette: string[] = [];
  const add = (value: unknown) => {
    const hex = fullHex(value);
    if (hex && !palette.includes(hex)) palette.push(hex);
  };
  add(colorHex);
  try {
    const layers: unknown = JSON.parse(layersJson);
    if (Array.isArray(layers)) {
      for (const layer of layers) {
        if (typeof layer !== "object" || layer === null) continue;
        if ("type" in layer && layer.type === "text" && "color" in layer) add(layer.color);
      }
    }
  } catch {
    // A piece whose layers do not parse still has its garment colour.
  }
  return palette;
}

function toPiece(row: PieceRow): RackPiece {
  return {
    ...summary(row),
    maker: { handle: row.maker_handle ?? "", name: row.maker_name ?? "A maker" },
    crowns: Number(row.crown_count),
    crownedByMe: Boolean(row.crowned_by_me),
    palette: paletteOf(row.color_hex, row.layers_json),
  };
}

/**
 * Published pieces with their maker and crowns, in one query. Drafts never match.
 * Makers who have no profile yet get one made afterwards, so every card can link
 * to a maker page.
 */
export async function piecesFor(options: {
  viewerId: string | null;
  sort: RackSort;
  makerId?: string;
  slug?: string;
}): Promise<RackPiece[]> {
  const { viewerId, sort } = options;
  // Nobody to follow from: signed out, the following rack is empty and the page says why.
  if (sort === "following" && !viewerId) return [];
  const viewer = viewerId ?? "";
  const makerId = options.makerId ?? "";
  const slug = options.slug ?? "";
  const sql = await getSql();
  const rows = await sql<PieceRow>`
    select d.id, d.user_id, d.collection_id, d.title, d.slug, d.status, d.product_id,
      d.product_name, d.product_type, d.variant_id, d.variant_label, d.color_name, d.color_hex,
      d.size_label, d.placement, d.technique, d.print_file_id, d.mockup_url, d.retail_cents,
      d.currency, d.provider_product_id, d.updated_at,
      coalesce((
        select json_agg(json_build_object('type', 'text', 'color', layer ->> 'color'))::text
        from json_array_elements(
          case when json_typeof(d.layers_json::json) = 'array' then d.layers_json::json else '[]'::json end
        ) layer
        where layer ->> 'type' = 'text'
      ), '[]') as layers_json,
      p.handle as maker_handle,
      coalesce(p.display_name, 'A maker') as maker_name,
      coalesce(k.crown_count, 0)::int as crown_count,
      exists(
        select 1 from crowns mine where mine.design_id = d.id and mine.user_id = ${viewer}
      ) as crowned_by_me
    from designs d
    left join profiles p on p.user_id = d.user_id
    left join "user" u on u."id" = d.user_id
    left join (
      select design_id, count(*) as crown_count from crowns group by design_id
    ) k on k.design_id = d.id
    where d.status = 'published'
      and (${makerId}::text = '' or d.user_id = ${makerId})
      and (${slug}::text = '' or d.slug = ${slug})
      and (
        ${sort}::text <> 'following'
        or d.user_id in (select maker_id from follows where follower_id = ${viewer})
      )
    order by
      case when ${sort}::text = 'crowned' then coalesce(k.crown_count, 0) else 0 end desc,
      d.updated_at desc,
      d.id desc
    limit 60
  `;

  const missing = [...new Set(rows.filter((row) => !row.maker_handle).map((row) => row.user_id))];
  if (missing.length > 0) {
    const { ensureProfile } = await import("./makers.server.ts");
    for (const userId of missing) {
      try {
        const profile = await ensureProfile(userId);
        for (const row of rows) {
          if (row.user_id !== userId) continue;
          row.maker_handle = profile.handle;
          row.maker_name = profile.display_name;
        }
      } catch {
        // The account is gone. The piece still shows, credited to "A maker" with no page.
      }
    }
  }
  return rows.map(toPiece);
}

/** The rack. Fresh is newest first, crowned is most crowns first, following is your makers only. */
export function rackList(viewerId: string | null, sort: RackSort): Promise<RackPiece[]> {
  return piecesFor({ viewerId, sort });
}

/** One piece: everything the shop page needs to sell it, plus who made it and its crowns. */
export async function rackPiece(
  viewerId: string | null,
  slug: string,
): Promise<ShopPiece & Pick<RackPiece, "maker" | "crowns" | "crownedByMe" | "palette">> {
  const shop = await getShopDesign(slug);
  const [social] = await piecesFor({ viewerId, sort: "fresh", slug });
  if (!social) throw new Error("That piece is not on the rack.");
  return {
    ...shop,
    maker: social.maker,
    crowns: social.crowns,
    crownedByMe: social.crownedByMe,
    palette: social.palette,
  };
}

/**
 * Crown a published piece, or take the crown back. With `want` left out it flips;
 * with it set, the call lands on that state however many times it is sent.
 */
export async function toggleCrown(
  userId: string,
  designId: string,
  want?: boolean,
): Promise<{ crowned: boolean; crowns: number }> {
  const sql = await getSql();
  const pieces = await sql<{ id: string }>`
    select id from designs where id = ${designId} and status = 'published'
  `;
  if (!pieces[0]) throw new Error("That piece is not on the rack.");
  // A crown names you in the maker's activity, so you get a maker name of your own first.
  const { ensureProfile } = await import("./makers.server.ts");
  await ensureProfile(userId);

  const already = await sql<{ user_id: string }>`
    select user_id from crowns where user_id = ${userId} and design_id = ${designId}
  `;
  const crowned = want ?? already.length === 0;
  if (crowned) {
    await sql`
      insert into crowns (user_id, design_id) values (${userId}, ${designId})
      on conflict do nothing
    `;
  } else {
    await sql`delete from crowns where user_id = ${userId} and design_id = ${designId}`;
  }
  const counts = await sql<{ count: number }>`
    select count(*)::int as count from crowns where design_id = ${designId}
  `;
  return { crowned, crowns: Number(counts[0]?.count ?? 0) };
}
