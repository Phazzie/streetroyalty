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
 * Confirmed with the owner's Printful key on 2026-11-19 (docs/printful-aop-data.md):
 *
 * - catalog variant ids, one per size, all on the undyed white base
 * - placement keys (front, sleeve_left, hood, pocket, ...) and print sizes,
 *   which live with the traced cut pieces in `src/lib/garments/outlines/`
 * - the technique, "cut-sew" ("All-over synthetic")
 * - the fabric of all three: 95-96% recycled polyester with elastane or spandex
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

export type AopPrintfulProduct = {
  catalogProductId: number;
  name: string;
  sourceUrl: string;
  /** Starting price on the public product page, in cents. Not an API variant cost. */
  startingPriceCents: number;
  /** Printful catalog variant id by size label. Every variant is the white base the print goes on. */
  catalogVariants: Readonly<Record<string, number>>;
  /** The same ids as a list, in size order. */
  catalogVariantIds: readonly number[];
  material: AopMaterial;
};

/** Printful's technique key for a cut-and-sew all-over garment. */
export const AOP_TECHNIQUE = "cut-sew";

/** The shared cloth line, with what is particular to each garment in front. */
function fleece(cut: string): string {
  return `${cut} Recycled polyester and elastane with a soft cotton-feel face and brushed fleece inside, printed all over by sublimation, then cut and sewn. The colors are the print, not sewn cotton panels.`;
}

function variants(map: Record<string, number>) {
  return { catalogVariants: map, catalogVariantIds: Object.values(map) };
}

export const PRINTFUL_AOP = {
  hoodie: {
    catalogProductId: 388,
    name: "All-Over Print Recycled Unisex Hoodie",
    sourceUrl:
      "https://www.printful.com/custom/sweatshirts-hoodies/388/all-over-print-recycled-unisex-hoodie",
    startingPriceCents: 4075,
    ...variants({
      "2XS": 18730,
      XS: 10869,
      S: 10870,
      M: 10871,
      L: 10872,
      XL: 10873,
      "2XL": 10874,
      "3XL": 10875,
      "4XL": 18731,
      "5XL": 18732,
      "6XL": 18733,
    }),
    // GET /products/388: 96% recycled polyester and 4% elastane (US/Mexico), 95/5 in Latvia.
    material: {
      line: fleece("Double-lined hood."),
      fabric: "recycled polyester and elastane",
      fabricConfirmed: true,
    },
  },
  joggers: {
    catalogProductId: 400,
    name: "All-Over Print Recycled Men’s Joggers",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-mens-joggers/400/all-over-print-recycled-mens-joggers",
    startingPriceCents: 3948,
    ...variants({ XS: 11033, S: 11034, M: 11035, L: 11036, XL: 11037, "2XL": 11038, "3XL": 11039 }),
    // GET /products/400: 96% recycled polyester and 4% elastane, 95/5 spandex in Latvia.
    // The public catalog's recycled jogger is the men's cut (400), not a unisex.
    material: {
      line: fleece("Slim fit with cuffed legs."),
      fabric: "recycled polyester and elastane",
      fabricConfirmed: true,
    },
  },
  jacket: {
    catalogProductId: 801,
    name: "All-Over Print Recycled Unisex Track Jacket",
    sourceUrl:
      "https://www.printful.com/custom/all-over-print-recycled-unisex-track-jacket/801/all-over-print-recycled-unisex-track-jacket",
    startingPriceCents: 6241,
    ...variants({
      "2XS": 20370,
      XS: 20371,
      S: 20372,
      M: 20373,
      L: 20374,
      XL: 20375,
      "2XL": 20376,
      "3XL": 20377,
      "4XL": 20378,
      "5XL": 20379,
      "6XL": 20380,
    }),
    // GET /products/801: 96% recycled polyester and 4% elastane, 95/5 in Latvia.
    material: {
      line: fleece("Full zip with zippered pockets."),
      fabric: "recycled polyester and elastane",
      fabricConfirmed: true,
    },
  },
} as const satisfies Record<string, AopPrintfulProduct>;

export function printfulAopById(catalogProductId: number): AopPrintfulProduct | null {
  return (
    Object.values(PRINTFUL_AOP).find((item) => item.catalogProductId === catalogProductId) ?? null
  );
}

/** What a buyer is told while an all-over piece cannot be ordered. */
export const AOP_ORDER_CLOSED =
  "This all-over piece can be designed, saved and shared, but it cannot be ordered yet.";

/**
 * The one rule for whether an all-over product can be ordered: its catalog
 * variant ids are known, and the garment's panels cover every piece the
 * printer cuts (`problems` is empty). The caller works out the coverage from
 * the traced outlines, so a piece can never ship blank.
 */
export function aopOrderable(catalogProductId: number, problems: readonly string[]): boolean {
  const product = printfulAopById(catalogProductId);
  if (!product || product.catalogVariantIds.length === 0) return false;
  return problems.length === 0;
}
