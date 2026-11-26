import { getSql } from "../db.ts";
import { garmentMockupSvg } from "../gfx/garments/index.ts";
import { blankDrawShape, houseAreas, houseBlank } from "../pod/house-blanks.ts";
import type { CatalogProduct, CatalogVariant } from "../pod/types.ts";
import {
  generateMockup,
  openCatalog,
  publishDesign,
  saveDesign,
  storePrintFile,
} from "../studio/designs.server.ts";
import {
  LABEL_MAKER,
  LAUNCH_PIECES,
  launchLayers,
  printName,
  type LaunchPiece,
} from "./launch.ts";

/** The print files, as data URLs, loaded only when a piece is being made. */
const PRINTS = import.meta.glob<string>("./prints/*.png", { query: "?inline", import: "default" });

export async function launchPrint(piece: LaunchPiece, placement: string): Promise<string> {
  const load = PRINTS[`./prints/${printName(piece, placement)}`];
  if (!load) throw new Error(`No print file for ${piece.key} ${placement}.`);
  return load();
}

function pickVariant(product: CatalogProduct, piece: LaunchPiece): CatalogVariant {
  const blank = houseBlank(piece.blank);
  const colorName = blank?.colors.find((color) => color.code === piece.color)?.name ?? "";
  const ofColor = product.variants.filter(
    (variant) =>
      variant.retailCents != null &&
      (variant.colorCode === piece.color || variant.color.toLowerCase() === colorName.toLowerCase()),
  );
  const variant =
    ofColor.find((item) => item.size === "M") ??
    ofColor.find((item) => item.size === "One size") ??
    ofColor[0];
  if (!variant) throw new Error(`${product.name} has no ${colorName || piece.color}.`);
  return variant;
}

async function ensureMaker() {
  const sql = await getSql();
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified")
    values (${LABEL_MAKER.id}, ${LABEL_MAKER.name}, 'label@streetroyalty.invalid', true)
    on conflict do nothing
  `;
  await sql`
    insert into profiles (user_id, handle, display_name, bio)
    values (${LABEL_MAKER.id}, ${LABEL_MAKER.handle}, ${LABEL_MAKER.name}, ${LABEL_MAKER.bio})
    on conflict do nothing
  `;
}

/** Makes and publishes one launch piece, through the same save and publish a maker uses. */
export async function makeLaunchPiece(piece: LaunchPiece): Promise<string> {
  const blank = houseBlank(piece.blank);
  if (!blank) throw new Error(`No house blank ${piece.blank}.`);
  const [main, ...rest] = piece.spots;
  if (!main) throw new Error(`${piece.key} has no spots.`);
  const { product } = await openCatalog(blank.id);
  const variant = pickVariant(product, piece);
  const layers = launchLayers(main);
  const printFile = await launchPrint(piece, main.placement);
  const spots = [];
  for (const spot of rest) {
    spots.push({
      placement: spot.placement,
      layers: launchLayers(spot),
      printFileId: await storePrintFile(LABEL_MAKER.id, await launchPrint(piece, spot.placement)),
    });
  }
  const area = houseAreas(blank).find((item) => item.placement === main.placement);
  let mockupUrl: string;
  try {
    ({ mockupUrl } = await generateMockup({
      productId: blank.id,
      variantId: variant.id,
      placement: main.placement,
      layers,
      printFile,
      userId: LABEL_MAKER.id,
    }));
  } catch {
    // Printful's photo is still rendering or can't be fetched. The flat drawing is honest too.
    mockupUrl = garmentMockupSvg({
      shape: blankDrawShape(blank),
      colorHex: variant.colorHex,
      placement: main.placement,
      layers,
      printArea: area,
    });
  }
  const saved = await saveDesign(LABEL_MAKER.id, {
    title: piece.title,
    productId: blank.id,
    variantId: variant.id,
    placement: main.placement,
    layers,
    printFile,
    mockupUrl,
    spots,
  });
  try {
    await publishDesign(LABEL_MAKER.id, saved.id);
  } catch (error) {
    const sql = await getSql();
    await sql`delete from designs where id = ${saved.id} and user_id = ${LABEL_MAKER.id}`;
    throw error;
  }
  return saved.id;
}

/**
 * Puts every launch piece on the rack that isn't there yet. Each piece is claimed
 * first, so two servers never make it twice. A piece that fails gives its claim
 * back and is tried again the next time a server starts.
 */
export async function stockLabel(
  pieces: readonly LaunchPiece[] = LAUNCH_PIECES,
): Promise<{ made: string[]; failed: string[] }> {
  const sql = await getSql();
  const done = await sql<{ piece_key: string }>`select piece_key from label_stock`;
  const have = new Set(done.map((row) => row.piece_key));
  const todo = pieces.filter((piece) => !have.has(piece.key));
  const made: string[] = [];
  const failed: string[] = [];
  if (todo.length === 0) return { made, failed };
  await ensureMaker();
  for (const piece of todo) {
    const claimed = await sql<{ piece_key: string }>`
      insert into label_stock (piece_key) values (${piece.key})
      on conflict do nothing
      returning piece_key
    `;
    if (!claimed[0]) continue;
    try {
      const id = await makeLaunchPiece(piece);
      await sql`update label_stock set design_id = ${id} where piece_key = ${piece.key}`;
      made.push(piece.key);
    } catch (error) {
      await sql`delete from label_stock where piece_key = ${piece.key}`;
      failed.push(piece.key);
      console.warn(`[label] ${piece.key} did not go on the rack:`, error);
    }
  }
  return { made, failed };
}

let stocking: Promise<unknown> | null = null;

/** Once per server: stock the rack, and never let a failure here break the page asking. */
export function ensureLabelStock(): Promise<unknown> {
  // Tests empty the tables before each one and count what they put there themselves.
  if (process.env.VITEST && process.env.SR_LABEL_STOCK !== "1") return Promise.resolve();
  stocking ??= stockLabel().catch((error) => {
    console.warn("[label] stocking the rack failed:", error);
  });
  return stocking;
}

export function resetLabelStockForTests() {
  stocking = null;
}
