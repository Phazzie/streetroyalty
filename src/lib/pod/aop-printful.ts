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

/**
 * What makers and buyers are told about the cloth. Each line says only what a
 * Printful page confirms. Where the fabric is not confirmed, the line does not
 * name one, and a test holds it to that.
 */
export type AopMaterial = {
  line: string;
  /** The fabric the line names, or null when Printful's page does not say. */
  fabric: string | null;
  fabricConfirmed: boolean;
};

/**
 * Printful's all-over print page, checked 18 Nov 2026: "Sublimation or
 * direct-to-fabric inks apply your design depending on the fabric, then the
 * garment is cut and sewn to shape", and dye sublimation is "for synthetics".
 * https://www.printful.com/all-over-print
 */
const CUT_AND_SEWN = "Printed all over, then cut and sewn.";

export type AopPrintfulProduct = {
  catalogProductId: number;
  name: string;
  sourceUrl: string;
  /** Starting price on the public product page, in cents. Not an API variant cost. */
  startingPriceCents: number;
  /** TODO: null until the catalog variants endpoint is read with a Printful key. */
  catalogVariantIds: null;
  material: AopMaterial;
};

export const PRINTFUL_AOP = {
  hoodie: {
    catalogProductId: 388,
    name: "All-Over Print Recycled Unisex Hoodie",
    sourceUrl:
      "https://www.printful.com/custom/sweatshirts-hoodies/388/all-over-print-recycled-unisex-hoodie",
    startingPriceCents: 4075,
    catalogVariantIds: null,
    // Checked 18 Nov 2026 on the sourceUrl above. The product description says it "is made
    // from a recycled polyester and spandex blend". A synthetic, so sublimation, per the
    // all-over print page quoted at CUT_AND_SEWN.
    material: {
      line: "Recycled polyester and spandex blend, printed all over by sublimation, then cut and sewn. The colors are the print, not sewn cotton panels.",
      fabric: "recycled polyester and spandex blend",
      fabricConfirmed: true,
    },
  },
  joggers: {
    catalogProductId: 400,
    name: "All-Over Print Recycled Men’s Joggers",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-mens-joggers/400/all-over-print-recycled-mens-joggers",
    startingPriceCents: 3948,
    catalogVariantIds: null,
    // Checked 18 Nov 2026 on the sourceUrl above. The page names no fabric or print method
    // ("soft, comfy, have pockets"), and buyer reviews mention a cotton lining. Say less.
    // The public catalog's recycled jogger is the men's cut (400), not a unisex.
    material: {
      line: `${CUT_AND_SEWN} The fabric is not confirmed yet.`,
      fabric: null,
      fabricConfirmed: false,
    },
  },
  jacket: {
    catalogProductId: 801,
    name: "All-Over Print Recycled Unisex Track Jacket",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-unisex-track-jacket/801/all-over-print-recycled-unisex-track-jacket",
    startingPriceCents: 6241,
    catalogVariantIds: null,
    // Checked 18 Nov 2026 on the sourceUrl above. The page names no fabric or print method
    // ("Order a custom track jacket"). Say less.
    material: {
      line: `${CUT_AND_SEWN} The fabric is not confirmed yet.`,
      fabric: null,
      fabricConfirmed: false,
    },
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
