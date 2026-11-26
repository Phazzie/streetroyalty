/**
 * Real photo mockups from Printful's mockup generator, in sandbox or live.
 *
 * A mockup costs nothing and orders nothing, so the studio asks Printful for one
 * whenever the shop has a Printful key, even while orders still run in sandbox. Every
 * printed spot goes in one task, so the photos show the whole piece.
 */
import { getSql } from "../db.ts";
import { houseBlank, houseBlankByPrintfulId, printfulVariantFor } from "../pod/house-blanks.ts";
import { createPrintfulProvider, type PhotoSet, type PrintfulProvider } from "../pod/printful.ts";
import type { PrintArea } from "../pod/types.ts";
import { fileUrl } from "./shared.server.ts";
import { isPublicHttpUrl } from "./validate.ts";

export type PhotoResult = {
  taskId: string;
  status: PhotoSet["status"];
  photos: { placement: string; url: string }[];
};

type Deps = { provider?: PrintfulProvider };

/** True when the server can ask Printful for photos: it has a key, and a public address Printful can fetch files from. */
export function photoMockupsReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PRINTFUL_API_KEY?.trim()) && isPublicHttpUrl(env.APP_PUBLIC_URL?.trim() ?? "");
}

function providerFor(deps: Deps): PrintfulProvider {
  if (deps.provider) return deps.provider;
  const apiKey = process.env.PRINTFUL_API_KEY?.trim();
  if (!apiKey) throw new Error("Real photos switch on once the shop's Printful key is set.");
  return createPrintfulProvider({
    apiKey,
    storeId: process.env.PRINTFUL_STORE_ID?.trim() || undefined,
    // The visitor is waiting. Anything slower comes back as pending and the studio asks again.
    mockupPoll: { attempts: 6, delayMs: 1500 },
  });
}

/** Reads the spots a maker sent: each a spot this piece prints, once, with a print file this maker owns. */
async function readSpots(
  userId: string,
  input: unknown,
  allowed: readonly string[],
): Promise<{ placement: string; fileId: string }[]> {
  if (!Array.isArray(input) || input.length === 0) throw new Error("Put art on a spot first.");
  const seen = new Set<string>();
  const spots: { placement: string; fileId: string }[] = [];
  for (const entry of input.slice(0, 8)) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const placement = String(record.placement ?? "");
    const fileId = String(record.printFileId ?? "");
    if (!allowed.includes(placement)) throw new Error("That spot is not on this piece.");
    if (!fileId) throw new Error("A spot is missing its print file.");
    if (seen.has(placement)) continue;
    seen.add(placement);
    spots.push({ placement, fileId });
  }
  const sql = await getSql();
  for (const spot of spots) {
    const owned = await sql<{ id: string }>`
      select id from print_files where id = ${spot.fileId} and user_id = ${userId} limit 1
    `;
    if (!owned[0]) throw new Error("That print file is not yours.");
  }
  return spots;
}

export async function makePhotoMockup(
  userId: string,
  input: { productId: string; variantId: string; spots: unknown },
  deps: Deps = {},
): Promise<PhotoResult> {
  if (!deps.provider && !photoMockupsReady()) {
    throw new Error("Real photos switch on once the shop's Printful key and public address are set.");
  }
  const blank = houseBlank(input.productId) ?? houseBlankByPrintfulId(input.productId);
  if (!blank) throw new Error("Real photos are for the shop's own pieces.");
  const variantId = /^\d+$/.test(input.variantId)
    ? input.variantId
    : printfulVariantFor(input.variantId);
  if (!variantId) throw new Error("Pick a colour and size first.");
  const spots = await readSpots(
    userId,
    input.spots,
    blank.placements.map((spot) => spot.placement),
  );
  const urls = spots.map((spot) => ({ ...spot, url: fileUrl(spot.fileId) }));
  if (urls.some((spot) => !isPublicHttpUrl(spot.url))) {
    throw new Error("Printful has to download the print file. Set APP_PUBLIC_URL to the public https origin.");
  }
  const provider = providerFor(deps);
  // Printful's own print areas, so the art lands where the print file puts it.
  let areas: PrintArea[] = [];
  try {
    const product = await provider.getProduct(String(blank.printfulId));
    areas = product.variants.find((item) => item.id === variantId)?.printAreas ?? [];
  } catch {
    areas = [];
  }
  const set = await provider.createPhotoSet({
    productId: String(blank.printfulId),
    variantId,
    technique: blank.technique,
    spots: urls.map((spot) => ({
      placement: spot.placement,
      url: spot.url,
      area: areas.find((area) => area.placement === spot.placement),
    })),
  });
  if (set.status === "failed") throw new Error(set.error || "Printful could not make the photos.");
  return { taskId: set.taskId, status: set.status, photos: set.photos };
}

/** Asks Printful again about a task that was still rendering. */
export async function checkPhotoMockup(taskId: string, deps: Deps = {}): Promise<PhotoResult> {
  const id = String(taskId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("That photo job is not one of ours.");
  const set = await providerFor(deps).getPhotoSet(id);
  if (set.status === "failed") throw new Error(set.error || "Printful could not make the photos.");
  return { taskId: set.taskId, status: set.status, photos: set.photos };
}
