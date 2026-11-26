/**
 * The Outfit Lab only puts on pieces the shop can really make. This turns what a
 * person says ("black hoodie") into one of the studio's real blanks in a colour
 * Printful really stocks, or null when the shop does not make it. Pure.
 */
import { HOUSE_BLANKS, blankDrawShape, type HouseBlank, type HouseColor } from "../pod/house-blanks.ts";
import { findColors, nearestColor } from "../say/colors.ts";
import type { Category } from "../types.ts";

export type RealPiece = {
  blankId: string;
  colorCode: string;
  colorName: string;
  hex: string;
  shape: HouseBlank["shape"];
  /** What to draw: the long-sleeve draws with long sleeves. */
  drawShape: string;
  category: Category;
  /** How the lab names it on the board and in the look prompt. */
  label: string;
};

/** Checked in order: a long-sleeve is a tee word too, and a sweatshirt is not sweatpants. */
const WORDS: { id: string; match: RegExp; category: Category }[] = [
  { id: "longsleeve-block", match: /long[ -]?sleeve/i, category: "Tops" },
  {
    id: "jogger-court",
    match: /sweat ?pants|jogger|trousers|\bpants\b|track ?pants/i,
    category: "Bottoms",
  },
  { id: "hoodie-pullover", match: /hood/i, category: "Tops" },
  { id: "crew-sweat", match: /crew|sweatshirt|sweater|jumper/i, category: "Tops" },
  { id: "tee-heavy", match: /t-?shirt|\btee\b|\bshirt\b/i, category: "Tops" },
  { id: "tote-corner", match: /\btote\b|\bbag\b/i, category: "Accessories" },
];

/** What the shop makes, for a line that tells someone what they can ask for. */
export const REAL_PIECE_WORDS = "a tee, hoodie, crewneck, long-sleeve, sweatpants or tote";

function pickColor(blank: HouseBlank, spoken: string): HouseColor {
  const text = spoken.toLowerCase();
  const named = [...blank.colors]
    .sort((a, b) => b.name.length - a.name.length)
    .find((color) => text.includes(color.name.toLowerCase()));
  if (named) return named;
  const asked = findColors(spoken)[0];
  if (asked) {
    const near = nearestColor(asked.hex, blank.colors);
    if (near) return near.option;
  }
  return blank.colors[0]!;
}

export function matchRealPiece(spoken: string): RealPiece | null {
  const word = WORDS.find((item) => item.match.test(spoken));
  if (!word) return null;
  const blank = HOUSE_BLANKS.find((item) => item.id === word.id);
  if (!blank || blank.colors.length === 0) return null;
  const color = pickColor(blank, spoken);
  return {
    blankId: blank.id,
    colorCode: color.code,
    colorName: color.name,
    hex: color.hex,
    shape: blank.shape,
    drawShape: blankDrawShape(blank),
    category: word.category,
    label: `${color.name} ${blank.name}`,
  };
}
