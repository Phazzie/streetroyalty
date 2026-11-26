/**
 * Template id ↔ printer catalog id. The studio, the cart, sets and the rack
 * speak template ids (`aop-hoodie`). Sandbox product ids stay equal to those
 * template ids so designs, sets and cart lines saved under migrations 0005
 * and 0013 still load. Printful product ids are the catalog numbers (388,
 * 400, 801). The regular pieces bind to the real Printful products listed in
 * `house-blanks.ts`.
 */
import { PRINTFUL_AOP, type AopPrintfulProduct } from "./aop-printful.ts";
import { HOUSE_BLANKS, HOUSE_BLANK_IDS, houseVariantIds } from "./house-blanks.ts";

export type PrinterId = "sandbox" | "printful";

export type GarmentBinding = {
  templateId: string;
  provider: PrinterId;
  /**
   * The printer's catalog product id. Null when that printer has no verified
   * binding yet. Sandbox ids match the template id. Printful ids are catalog
   * numbers, and only when a public page or the catalog has confirmed them.
   */
  productId: string | null;
  /** Known catalog variant ids, or null when the printer has not published them. */
  variantIds: readonly string[] | null;
};

/** Placement blanks the sandbox sells. Not all-over garments. Each is a real Printful product. */
export const SANDBOX_PLACEMENT_PRODUCT_IDS: readonly string[] = HOUSE_BLANK_IDS;

const TEMPLATE_ORDER = ["aop-hoodie", "aop-joggers", "aop-track-jacket"] as const;

const PRINTFUL_KEY = {
  "aop-hoodie": "hoodie",
  "aop-joggers": "joggers",
  "aop-track-jacket": "jacket",
} as const satisfies Record<(typeof TEMPLATE_ORDER)[number], keyof typeof PRINTFUL_AOP>;

/** Turns a printer's variant list into strings. Empty and null both mean unknown. */
export function normalizeVariantIds(
  ids: readonly (string | number)[] | null,
): readonly string[] | null {
  if (ids == null) return null;
  if (ids.length === 0) return null;
  return ids.map((id) => String(id));
}

function printfulBinding(templateId: (typeof TEMPLATE_ORDER)[number]): GarmentBinding {
  const facts = PRINTFUL_AOP[PRINTFUL_KEY[templateId]];
  return {
    templateId,
    provider: "printful",
    productId: String(facts.catalogProductId),
    variantIds: normalizeVariantIds(facts.catalogVariantIds),
  };
}

function placementBindings(): GarmentBinding[] {
  return HOUSE_BLANKS.flatMap((blank) => [
    {
      templateId: blank.id,
      provider: "sandbox" as const,
      productId: blank.id,
      // Sandbox variants are `${productId}-{colorCode}-{sizeCode}`.
      variantIds: null,
    },
    {
      templateId: blank.id,
      provider: "printful" as const,
      productId: String(blank.printfulId),
      variantIds: normalizeVariantIds(houseVariantIds(blank)),
    },
  ]);
}

export const GARMENT_BINDINGS: readonly GarmentBinding[] = [
  ...TEMPLATE_ORDER.map((templateId): GarmentBinding => ({
    templateId,
    provider: "sandbox",
    // Same string as the template id on purpose. Saved product_id columns use it.
    productId: templateId,
    // Sandbox variants are `${productId}-{colorCode}-{sizeCode}`, resolved by prefix.
    variantIds: null,
  })),
  ...TEMPLATE_ORDER.map(printfulBinding),
  ...placementBindings(),
];

export function bindingsFor(
  provider: PrinterId,
  bindings: readonly GarmentBinding[] = GARMENT_BINDINGS,
): GarmentBinding[] {
  return bindings.filter((item) => item.provider === provider);
}

export function templateForProduct(
  provider: PrinterId,
  productId: string,
  bindings: readonly GarmentBinding[] = GARMENT_BINDINGS,
): string | null {
  return (
    bindings.find(
      (item) => item.provider === provider && item.productId != null && item.productId === productId,
    )?.templateId ?? null
  );
}

export function productForTemplate(
  provider: PrinterId,
  templateId: string,
  bindings: readonly GarmentBinding[] = GARMENT_BINDINGS,
): string | null {
  return (
    bindings.find((item) => item.provider === provider && item.templateId === templateId)
      ?.productId ?? null
  );
}

export function variantsForTemplate(
  provider: PrinterId,
  templateId: string,
  bindings: readonly GarmentBinding[] = GARMENT_BINDINGS,
): readonly string[] | null {
  return (
    bindings.find((item) => item.provider === provider && item.templateId === templateId)
      ?.variantIds ?? null
  );
}

export function templateForVariant(
  provider: PrinterId,
  variantId: string,
  bindings: readonly GarmentBinding[] = GARMENT_BINDINGS,
): string | null {
  const listed = bindings.filter(
    (item) => item.provider === provider && item.variantIds?.includes(variantId),
  );
  if (listed.length === 1) return listed[0]?.templateId ?? null;
  if (listed.length > 1) return null;
  if (provider !== "sandbox") return null;
  const matches = bindingsFor("sandbox", bindings)
    .filter((item) => item.productId != null && variantId.startsWith(`${item.productId}-`))
    .sort((a, b) => (b.productId?.length ?? 0) - (a.productId?.length ?? 0));
  return matches[0]?.templateId ?? null;
}

export function printfulFactsForTemplate(templateId: string): AopPrintfulProduct | null {
  const key = PRINTFUL_KEY[templateId as keyof typeof PRINTFUL_KEY];
  return key ? PRINTFUL_AOP[key] : null;
}

export function isSandboxPlacementProduct(productId: string): boolean {
  return SANDBOX_PLACEMENT_PRODUCT_IDS.includes(productId);
}

/** Chest and sleeve prints. Not an all-over technique. */
const PLACEMENT_TECHNIQUES = new Set(["dtg", "embroidery", "dtflex"]);
/** Cloth that is printed as panels. A digit id alone is not enough to know this. */
const ALLOVER_TECHNIQUES = new Set(["sublimation", "cut-sew", "all-over", "allover"]);

function techniqueKey(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", "-");
}

/**
 * A Printful product is a placement blank only when its catalog techniques say
 * so. A mapped all-over id is never one. An id with no technique list is not
 * one either: a bare number used to count as a tee.
 */
export function isPrintfulPlacementProduct(
  productId: string,
  techniques: readonly string[],
): boolean {
  const bound = templateForProduct("printful", productId);
  if (bound) return isSandboxPlacementProduct(bound);
  const keys = techniques.map(techniqueKey).filter(Boolean);
  if (keys.length === 0) return false;
  if (keys.some((key) => ALLOVER_TECHNIQUES.has(key))) return false;
  return keys.every((key) => PLACEMENT_TECHNIQUES.has(key));
}

export type AopCatalogFields =
  | { construction: "placement" }
  | { construction: "aop"; aopTemplateId: string; materialNote: string };

/** What a catalog product should carry so the panel editor can attach. */
export function aopFieldsFor(provider: PrinterId, productId: string): AopCatalogFields {
  const templateId = templateForProduct(provider, productId);
  const facts = templateId ? printfulFactsForTemplate(templateId) : null;
  // A placement blank is in the binding table too. Only an all-over template
  // with Printful facts is cut-and-sew.
  if (!templateId || !facts) return { construction: "placement" };
  return {
    construction: "aop",
    aopTemplateId: templateId,
    materialNote: facts.material.line,
  };
}
