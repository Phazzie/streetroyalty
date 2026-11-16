import { CATEGORIES, type Category, type PieceDraft } from "../types.ts";

/**
 * The stylist turns an occasion into a short list of pieces to build.
 * Pure: the prompt, the parser for the model's answer, and a house fallback.
 */

export const MAX_PLAN_PIECES = 4;

export type OutfitPlan = { note: string; pieces: PieceDraft[] };

export function planPrompt(occasion: string): string {
  const clean = occasion.replaceAll('"', "'").replace(/\s+/g, " ").trim();
  return [
    "You are a streetwear stylist. Plan one outfit for this occasion.",
    `Occasion: "${clean}".`,
    `Reply with JSON only: {"note":"","pieces":[{"category":"","item":""}]}.`,
    `Use 3 or ${MAX_PLAN_PIECES} pieces. category is one of: ${CATEGORIES.join(", ")}.`,
    "item is one specific garment with colour and fabric, under 60 characters, no brand names.",
    "note is one sentence on why the outfit suits the occasion, under 120 characters.",
  ].join(" ");
}

function asCategory(value: unknown): Category | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return CATEGORIES.find((category) => category.toLowerCase() === text) ?? null;
}

/** Reads the model's answer. Anything that is not a usable plan comes back as null. */
export function parsePlan(raw: string): OutfitPlan | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as { note?: unknown; pieces?: unknown };
  const pieces: PieceDraft[] = [];
  for (const entry of Array.isArray(record.pieces) ? record.pieces : []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { category?: unknown; item?: unknown };
    const category = asCategory(row.category);
    const spoken = String(row.item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!category || spoken.length < 3) continue;
    if (pieces.some((piece) => piece.spoken.toLowerCase() === spoken.toLowerCase())) continue;
    pieces.push({ category, spoken });
    if (pieces.length >= MAX_PLAN_PIECES) break;
  }
  if (pieces.length < 2) return null;
  const note = String(record.note ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return { note, pieces };
}

// Each rule matches from the start of a word, so "training" is not rain and "brunch" is not a run.
const HOUSE: { match: RegExp; plan: OutfitPlan }[] = [
  {
    // A court date dresses up. A basketball court is left for the sports rule below.
    match:
      /\b(wedding|formal|gala|interview|church|funeral|courtroom|court (date|hearing|appearance))|\b(in|to|have|got|for) court\b/,
    plan: {
      note: "Sharp, dark, and quiet. The fit does the talking.",
      pieces: [
        { category: "Outer", spoken: "black wool double-breasted blazer" },
        { category: "Tops", spoken: "cream fine-knit mock neck" },
        { category: "Bottoms", spoken: "black pleated wool trousers" },
        { category: "Shoes", spoken: "black leather loafers" },
      ],
    },
  },
  {
    match: /\b(cold|winter|snow|rain|storm|freez)/,
    plan: {
      note: "Built for the weather, still a look.",
      pieces: [
        { category: "Outer", spoken: "long charcoal puffer coat" },
        { category: "Tops", spoken: "heavy cream fleece hoodie" },
        { category: "Bottoms", spoken: "black cargo trousers" },
        { category: "Shoes", spoken: "black leather boots" },
      ],
    },
  },
  {
    match: /\b(gym|run(s|ning)?\b|jog|workout|train|court|game|hoop|basketball)/,
    plan: {
      note: "Light, loose, and ready to move.",
      pieces: [
        { category: "Tops", spoken: "white boxy mesh tee" },
        { category: "Bottoms", spoken: "black nylon track pants" },
        { category: "Shoes", spoken: "white leather sneakers" },
      ],
    },
  },
  {
    match: /\b(date|dinner|club|party|birthday|night out|concert|show(s|case)?\b)/,
    plan: {
      note: "Dark base, one piece that catches the light.",
      pieces: [
        { category: "Outer", spoken: "black leather bomber jacket" },
        { category: "Tops", spoken: "lilac silk camp collar shirt" },
        { category: "Bottoms", spoken: "black straight-leg trousers" },
        { category: "Shoes", spoken: "black leather loafers" },
      ],
    },
  },
  {
    match: /\b(beach|summer|vacation|pool|cookout|bbq|picnic|hot\b)/,
    plan: {
      note: "Easy colours and room to breathe.",
      pieces: [
        { category: "Tops", spoken: "mint open-knit short sleeve shirt" },
        { category: "Bottoms", spoken: "cream linen shorts" },
        { category: "Hats", spoken: "cream bucket hat" },
        { category: "Shoes", spoken: "white leather sneakers" },
      ],
    },
  },
];

const EVERYDAY: OutfitPlan = {
  note: "The everyday uniform. It works anywhere.",
  pieces: [
    { category: "Tops", spoken: "black heavyweight hoodie" },
    { category: "Bottoms", spoken: "cream cargo trousers" },
    { category: "Hats", spoken: "lilac dad cap" },
    { category: "Shoes", spoken: "white leather sneakers" },
  ],
};

/** A plan with no model behind it, picked by the words in the occasion. */
export function localPlan(occasion: string): OutfitPlan {
  const text = occasion.toLowerCase();
  return HOUSE.find((entry) => entry.match.test(text))?.plan ?? EVERYDAY;
}
