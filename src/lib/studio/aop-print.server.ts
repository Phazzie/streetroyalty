/**
 * Print files for all-over pieces. At checkout each line stores a small
 * recipe (the garment, the chosen colorway and the chest-logo file) in
 * `print_files`. The printer then fetches one PNG per placement, rendered on
 * demand from that recipe at full print size. The recipe is a snapshot, so a
 * maker editing the piece later cannot change an order that was already paid.
 */
import { createHash } from "node:crypto";
import { getSql } from "../db.ts";
import { readCappedBytes } from "../bounded-bytes.ts";
import { parseGarment } from "../garments/colorways.ts";
import { printPlacements, renderPrintSheet } from "../garments/print.ts";
import type { GarmentDesign } from "../garments/types.ts";
import { fileUrl } from "./shared.server.ts";

export const AOP_RECIPE_MIME = "application/vnd.streetroyalty.aop-recipe+json";

/** Biggest remote picture a panel may pull in when the file is rendered. */
const REMOTE_ART_CAP = 12_000_000;

export type AopRecipe = {
  templateId: string;
  garment: GarmentDesign;
  colorwayId: string | null;
  /** The chest-logo print file saved with the design. */
  logoFileId: string | null;
};

/** A uuid-shaped id from the recipe's content. The same recipe always gets the same id. */
function recipeId(json: string): string {
  const hex = createHash("sha256").update(json).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Saves a recipe for one order line and returns its id. */
export async function saveAopRecipe(userId: string, recipe: AopRecipe): Promise<string> {
  const json = JSON.stringify(recipe);
  const id = recipeId(json);
  const sql = await getSql();
  const base64 = Buffer.from(json, "utf8").toString("base64");
  await sql`
    insert into print_files (id, user_id, mime, data_base64)
    values (${id}, ${userId}, ${AOP_RECIPE_MIME}, ${base64})
    on conflict (id) do nothing
  `;
  return id;
}

/** One signed URL per placement the printer cuts. */
export function aopFileUrls(
  recipe: string,
  templateId: string,
): { placement: string; url: string }[] {
  return printPlacements(templateId).map((placement) => ({
    placement,
    url: fileUrl(`${recipe}.${placement}`),
  }));
}

/** Splits a placement file id, `<recipe uuid>.<placement>`. Null for any other id. */
export function parseAopFileId(id: string): { recipe: string; placement: string } | null {
  const match =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z_]{2,32})$/.exec(id);
  return match ? { recipe: match[1]!, placement: match[2]! } : null;
}

async function readRow(id: string) {
  const sql = await getSql();
  const rows = await sql<{ mime: string; data_base64: string }>`
    select mime, data_base64 from print_files where id = ${id}
  `;
  return rows[0] ?? null;
}

/** Inlines a remote picture so the renderer, which does not fetch, can draw it. */
async function inlineRemote(src: string): Promise<string> {
  if (!src.startsWith("https://")) return src;
  try {
    const response = await fetch(src, { redirect: "follow" });
    if (!response.ok) return src;
    const type = response.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpeg|webp)/.test(type)) return src;
    const bytes = await readCappedBytes(response.body, REMOTE_ART_CAP);
    if (!bytes) return src;
    return `data:${type.split(";")[0]};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return src;
  }
}

async function inlineArt(garment: GarmentDesign): Promise<GarmentDesign> {
  const panels = await Promise.all(
    garment.panels.map(async (item) =>
      item.fill.kind === "art"
        ? { ...item, fill: { ...item.fill, src: await inlineRemote(item.fill.src) } }
        : item,
    ),
  );
  return { ...garment, panels };
}

/** Renders one placement of a stored recipe to a PNG at full print size. */
export async function renderAopPrintFile(
  recipe: string,
  placement: string,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const row = await readRow(recipe);
  if (!row || row.mime !== AOP_RECIPE_MIME) return null;
  const parsed = JSON.parse(Buffer.from(row.data_base64, "base64").toString("utf8")) as AopRecipe;
  const garment = await inlineArt(parseGarment(parsed.garment));
  if (!printPlacements(garment.templateId).includes(placement)) return null;
  let logoHref: string | undefined;
  if (parsed.logoFileId) {
    const logo = await readRow(parsed.logoFileId);
    if (logo && /^image\/(png|jpeg|webp)$/.test(logo.mime)) {
      logoHref = `data:${logo.mime};base64,${logo.data_base64}`;
    }
  }
  const sheet = renderPrintSheet(garment, placement, {
    colorwayId: parsed.colorwayId ?? undefined,
    logoHref,
  });
  const { Resvg } = await import("@resvg/resvg-js");
  // White is the undyed base. Anything outside the cut pieces is trimmed away.
  const png = new Resvg(sheet.svg, {
    background: "#ffffff",
    fitTo: { mode: "width", value: sheet.width },
  })
    .render()
    .asPng();
  return { mime: "image/png", bytes: new Uint8Array(png) };
}
