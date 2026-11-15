/**
 * Complete-the-look bundles. Outfits, not items: a top, a bottom, and a
 * third category make a look, and a look prices as a look. Integer cents
 * throughout. The register still recomputes per piece at checkout; the
 * bundle rule is stated on the bundle itself, never smuggled.
 */

export type Category = "top" | "bottom" | "outer" | "hat" | "carry" | "other";

export function categorize(productType: string): Category {
  const type = productType.toLowerCase();
  if (type.includes("jogger") || type.includes("pant") || type.includes("short")) return "bottom";
  if (type.includes("hood")) return "outer";
  if (type.includes("hat") || type.includes("cap")) return "hat";
  if (type.includes("tote") || type.includes("bag")) return "carry";
  if (type.includes("shirt") || type.includes("sweatshirt") || type.includes("crew")) return "top";
  return "other";
}

export type BundlePiece = { id: string; title: string; category: Category; retailCents: number };

export type BundlePrice = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** True when the set is a complete look (top + bottom + a third kind). */
  complete: boolean;
  rule: string;
};

export const BUNDLE_DISCOUNT_RATE = 0.1;

export function bundlePrice(pieces: BundlePiece[]): BundlePrice {
  const subtotal = pieces.reduce((sum, piece) => sum + Math.round(piece.retailCents), 0);
  const categories = new Set(pieces.map((piece) => piece.category));
  const complete =
    categories.has("top") && categories.has("bottom") && categories.size >= 3 && pieces.length >= 3;
  const discount = complete ? Math.floor(subtotal * BUNDLE_DISCOUNT_RATE) : 0;
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: subtotal - discount,
    complete,
    rule: complete
      ? "Complete look: top + bottom + a third kind takes 10% off the bundle in test mode."
      : "A complete look needs a top, a bottom, and one more kind. Then 10% comes off.",
  };
}

/** Fill the categories a look is missing, cheapest qualifying piece first. */
export function completeTheLook<T extends { id: string; productType: string; retailCents: number }>(
  rack: T[],
  chosen: T[],
): T[] {
  const have = new Set(chosen.map((piece) => categorize(piece.productType)));
  const missing: Category[] = (["top", "bottom", "hat"] as Category[]).filter((cat) => !have.has(cat));
  const suggestions: T[] = [];
  for (const category of missing) {
    const candidate = rack
      .filter((piece) => categorize(piece.productType) === category && !chosen.some((c) => c.id === piece.id))
      .sort((a, b) => a.retailCents - b.retailCents)[0];
    if (candidate) suggestions.push(candidate);
  }
  return suggestions;
}
