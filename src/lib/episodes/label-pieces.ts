import type { SheetProduct } from "./sheet.ts";

/**
 * The label's two sets, for the wardrobe sheet only. They are not a shop:
 * nothing here has a price, a size, or a checkout. Buying happens on the rack.
 */

const LILAC = "#b9a3ee";
const MINT = "#a5dccb";
const CREAM = "#f3ead9";
const NIGHT = "#2a2a2e";

function piece(
  slug: string,
  name: string,
  kind: string,
  blurb: string,
  color: string,
  swatch: string,
  image: string,
): SheetProduct {
  return {
    slug,
    name,
    kind,
    blurb,
    colors: [{ name: color, swatch }],
    images: [{ url: `/brand/${image}.webp` }],
  };
}

export const LABEL_PIECES: SheetProduct[] = [
  piece(
    "lilac-set-hoodie",
    "The Lilac Hoodie",
    "Hoodie",
    "Lilac and cream, printed two-tone.",
    "Lilac",
    LILAC,
    "prod-lilac-hoodie",
  ),
  piece(
    "lilac-set-jogger",
    "The Lilac Jogger",
    "Jogger",
    "Lilac and cream, printed two-tone.",
    "Lilac",
    LILAC,
    "prod-lilac-jogger",
  ),
  piece(
    "mint-set-hoodie",
    "The Mint Hoodie",
    "Hoodie",
    "Mint and peach, printed two-tone.",
    "Mint",
    MINT,
    "prod-mint-hoodie",
  ),
  piece(
    "mint-set-jogger",
    "The Mint Jogger",
    "Jogger",
    "Mint and peach, printed two-tone.",
    "Mint",
    MINT,
    "prod-mint-jogger",
  ),
  piece(
    "crown-tee",
    "Crown Tee, Cream",
    "Tee",
    "Boxy cream tee with a lilac crown on the chest.",
    "Cream",
    CREAM,
    "prod-crown-tee",
  ),
  piece(
    "night-crown-tee",
    "Crown Tee, Night",
    "Tee",
    "Washed black tee with a lime crown on the chest.",
    "Night",
    NIGHT,
    "prod-night-tee",
  ),
  piece(
    "crown-cap",
    "Crown Cap",
    "Cap",
    "Washed lilac cap with a cream crown.",
    "Lilac",
    LILAC,
    "prod-crown-cap",
  ),
  piece(
    "royal-cup",
    "Royal Cup",
    "Cup",
    "Mint espresso cup and saucer with a gold crown.",
    "Mint",
    MINT,
    "prod-royal-cup",
  ),
];
