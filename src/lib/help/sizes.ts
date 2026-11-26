import { createServerFn } from "@tanstack/react-start";
import { HOUSE_BLANKS } from "../pod/house-blanks.ts";
import { parseSizeGuide, type SizeGuide } from "../pod/size-guide.ts";

export type BlankSizes = {
  id: string;
  printfulId: number;
  name: string;
  model: string;
  sizes: string[];
  guide: SizeGuide | null;
};

const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<number, { at: number; guide: SizeGuide }>();

/** Printful's size guide for one product, kept for a day. Null when Printful can't be reached. */
export async function fetchSizeGuide(
  printfulId: number,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<SizeGuide | null> {
  const kept = cache.get(printfulId);
  if (kept && now - kept.at < DAY) return kept.guide;
  try {
    const key = process.env.PRINTFUL_API_KEY?.trim();
    const response = await fetchImpl(
      `https://api.printful.com/products/${printfulId}/sizes?unit=inches`,
      {
        headers: key ? { authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return kept?.guide ?? null;
    const guide = parseSizeGuide(await response.json());
    if (guide) cache.set(printfulId, { at: now, guide });
    return guide ?? kept?.guide ?? null;
  } catch {
    return kept?.guide ?? null;
  }
}

export function clearSizeGuideCache() {
  cache.clear();
}

export const getSizeGuides = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlankSizes[]> =>
    Promise.all(
      HOUSE_BLANKS.map(async (blank) => ({
        id: blank.id,
        printfulId: blank.printfulId,
        name: blank.name,
        model: blank.model,
        sizes: blank.sizes,
        guide: await fetchSizeGuide(blank.printfulId),
      })),
    ),
);
