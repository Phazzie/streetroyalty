/**
 * Printful all-over-print facts, checked against public product pages on
 * 2026-11-17. This is the only place those ids live.
 *
 * Confirmed from the schema.org Offer URL on each product page:
 *
 * - 388 All-Over Print Recycled Unisex Hoodie
 *   https://www.printful.com/custom/sweatshirts-hoodies/388/all-over-print-recycled-unisex-hoodie
 *   Page copy: "recycled polyester and spandex blend". Listed from-price USD 40.75.
 * - 400 All-Over Print Recycled Men’s Joggers
 *   https://www.printful.com/custom/all-over-print-recycled-mens-joggers/400/all-over-print-recycled-mens-joggers
 *   Listed from-price USD 39.48.
 *   Printful does not list a recycled unisex jogger. Product 784 is the unisex
 *   wide-leg jogger, and it is not the recycled one, so the tracksuit uses 400.
 * - 801 All-Over Print Recycled Unisex Track Jacket
 *   https://www.printful.com/custom/all-over-print-recycled-unisex-track-jacket/801/all-over-print-recycled-unisex-track-jacket
 *   Listed from-price USD 62.41.
 *
 * DPI: Printful's graphics guide says files for anything that is not a paper
 * print should be 150 DPI, and their all-over guide says PNG or JPEG at at
 * least 150 DPI.
 * https://www.printful.com/graphics-and-embroidery-guide
 *
 * NOT confirmed. The catalog API requires a key, and the public pages do not
 * publish these. Leave them null. Do not invent pixel sizes or variant ids.
 * Fill them from GET /v2/catalog-products/{id} and that product's print files.
 *
 * - catalog variant ids
 * - placement keys (front, sleeve_left, hood, pocket, ...)
 * - template width and height in pixels, per placement
 */

export const AOP_DPI = 150;

/** Honest construction line. Sublimation on recycled polyester, not sewn cotton. */
export const AOP_MATERIAL =
  "Printed polyester fleece (sublimation). Recycled polyester and spandex, not sewn cotton panels.";

export type AopPrintfulProduct = {
  catalogProductId: number;
  name: string;
  sourceUrl: string;
  /** Starting price on the public product page, in cents. Not an API variant cost. */
  startingPriceCents: number;
  /** TODO: null until the catalog variants endpoint is read with a Printful key. */
  catalogVariantIds: null;
  fabricNote: string;
};

export const PRINTFUL_AOP = {
  hoodie: {
    catalogProductId: 388,
    name: "All-Over Print Recycled Unisex Hoodie",
    sourceUrl:
      "https://www.printful.com/custom/sweatshirts-hoodies/388/all-over-print-recycled-unisex-hoodie",
    startingPriceCents: 4075,
    catalogVariantIds: null,
    fabricNote: "Recycled polyester and spandex blend, from the product page.",
  },
  joggers: {
    catalogProductId: 400,
    name: "All-Over Print Recycled Men’s Joggers",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-mens-joggers/400/all-over-print-recycled-mens-joggers",
    startingPriceCents: 3948,
    catalogVariantIds: null,
    fabricNote:
      "Recycled all-over joggers. The public catalog's recycled jogger is the men's cut (400), not a unisex.",
  },
  jacket: {
    catalogProductId: 801,
    name: "All-Over Print Recycled Unisex Track Jacket",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-unisex-track-jacket/801/all-over-print-recycled-unisex-track-jacket",
    startingPriceCents: 6241,
    catalogVariantIds: null,
    fabricNote: "Recycled all-over track jacket.",
  },
} as const satisfies Record<string, AopPrintfulProduct>;

export type PanelPrintTarget = {
  confirmed: false;
  dpi: typeof AOP_DPI;
  /** TODO: null until Printful's template pixel size is read. Do not guess. */
  widthPx: null;
  heightPx: null;
  /** TODO: null until the catalog placement key is read. */
  placementKey: null;
  todo: string;
};

export function panelPrintTarget(catalogProductId: number, panelId: string): PanelPrintTarget {
  return {
    confirmed: false,
    dpi: AOP_DPI,
    widthPx: null,
    heightPx: null,
    placementKey: null,
    todo: `TODO: Printful template size for catalog product ${catalogProductId}, panel "${panelId}", is not in the public docs. Read the catalog product and its print files before using any pixel size as a Printful file.`,
  };
}

export function printfulAopById(catalogProductId: number): AopPrintfulProduct | null {
  return (
    Object.values(PRINTFUL_AOP).find((item) => item.catalogProductId === catalogProductId) ?? null
  );
}

/** What a buyer is told while an all-over piece cannot be ordered. */
export const AOP_ORDER_CLOSED =
  "All-over pieces can be designed, saved and shared now. Ordering opens once the printer's panel templates are set up.";

/**
 * The one rule for whether an all-over product can be ordered. True only when
 * its catalog variant ids are known and every panel has a confirmed Printful
 * template (pixel size and placement key), so a real print file can be made
 * for each panel. Until then only the chest logo would reach the printer.
 * The wiring job flips this by filling in those facts above, not by editing
 * the callers.
 */
export function aopOrderable(catalogProductId: number, panelIds: readonly string[]): boolean {
  const product = printfulAopById(catalogProductId);
  if (!product?.catalogVariantIds || panelIds.length === 0) return false;
  return panelIds.every((panelId) => panelPrintTarget(catalogProductId, panelId).confirmed);
}
