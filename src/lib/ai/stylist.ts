import { matchRealPiece } from "../lab/real-pieces.ts";
import { HOUSE_BLANKS } from "../pod/house-blanks.ts";
import { CATEGORIES, type Category, type PieceDraft } from "../types.ts";

/** The real blanks and their real colours, for the model to choose from. */
const MENU = HOUSE_BLANKS.map(
  (blank) => `${blank.type} (${blank.colors.map((color) => color.name).join(", ")})`,
).join("; ");

/**
 * The stylist turns an occasion into a short list of pieces, all of them real
 * blanks the shop prints on. A piece the shop doesn't make is dropped.
 * Pure: the prompt, the parser for the model's answer, and a house fallback.
 */

export const MAX_PLAN_PIECES = 4;

export type OutfitPlan = { note: string; pieces: PieceDraft[] };

export function planPrompt(occasion: string): string {
  const clean = occasion.replaceAll('"', "'").replace(/\s+/g, " ").trim();
  return [
    "You are a streetwear stylist for a shop that prints on a few real blanks. Plan one outfit for this occasion.",
    `Occasion: "${clean}".`,
    `Reply with JSON only: {"note":"","pieces":[{"category":"","item":""}]}.`,
    `Use 2 or 3 pieces, only from this list, each in one of its colours: ${MENU}.`,
    `category is one of: ${CATEGORIES.join(", ")}. item is the colour then the piece, like "Black hoodie".`,
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
    if (!matchRealPiece(spoken)) continue;
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
// Every piece here is a real blank in a colour Printful stocks.
const HOUSE: { match: RegExp; plan: OutfitPlan }[] = [
  {
    // A court date dresses up. A basketball court is left for the sports rule below.
    match:
      /\b(wedding|formal|gala|interview|church|funeral|courtroom|court (date|hearing|appearance))|\b(in|to|have|got|for) court\b/,
    plan: {
      note: "Dark and quiet. The fit does the talking.",
      pieces: [
        { category: "Tops", spoken: "Black crewneck" },
        { category: "Bottoms", spoken: "Navy Blazer sweatpants" },
      ],
    },
  },
  {
    match: /\b(cold|winter|snow|rain|storm|freez)/,
    plan: {
      note: "Built for the weather, fleece top to bottom.",
      pieces: [
        { category: "Tops", spoken: "Bone hoodie" },
        { category: "Bottoms", spoken: "Black sweatpants" },
        { category: "Accessories", spoken: "Black tote" },
      ],
    },
  },
  {
    match: /\b(gym|run(s|ning)?\b|jog|workout|train|court|game|hoop|basketball)/,
    plan: {
      note: "Light, loose, and ready to move.",
      pieces: [
        { category: "Tops", spoken: "White tee" },
        { category: "Bottoms", spoken: "Black sweatpants" },
      ],
    },
  },
  {
    match: /\b(date|dinner|club|party|birthday|night out|concert|show(s|case)?\b)/,
    plan: {
      note: "Dark base, one colour that catches the light.",
      pieces: [
        { category: "Tops", spoken: "Lavender hoodie" },
        { category: "Bottoms", spoken: "Black sweatpants" },
      ],
    },
  },
  {
    match: /\b(beach|summer|vacation|pool|cookout|bbq|picnic|hot\b)/,
    plan: {
      note: "Easy colours and room to breathe.",
      pieces: [
        { category: "Tops", spoken: "Chalky Mint tee" },
        { category: "Accessories", spoken: "Oyster tote" },
      ],
    },
  },
];

const EVERYDAY: OutfitPlan = {
  note: "The everyday uniform. It works anywhere.",
  pieces: [
    { category: "Tops", spoken: "Black hoodie" },
    { category: "Bottoms", spoken: "Carbon Grey sweatpants" },
  ],
};

/** A plan with no model behind it, picked by the words in the occasion. */
export function localPlan(occasion: string): OutfitPlan {
  const text = occasion.toLowerCase();
  return HOUSE.find((entry) => entry.match.test(text))?.plan ?? EVERYDAY;
}
