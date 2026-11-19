/**
 * Studio-facing garment rules that need both the printer-agnostic domain and
 * the pod mapping. The domain does not import this file.
 */
import { parseGarment } from "../garments/colorways.ts";
import type { GarmentDesign } from "../garments/types.ts";
import { getTemplate } from "../garments/panels.ts";
import { studioProofPixels } from "../garments/render.ts";
import { aopOrderable, panelPrintTarget, type PanelPrintTarget } from "../pod/aop-printful.ts";
import {
  aopFieldsFor,
  isSandboxPlacementProduct,
  printfulFactsForTemplate,
  productForTemplate,
  templateForProduct,
  variantsForTemplate,
  type PrinterId,
} from "../pod/garment-map.ts";

export type { PrinterId };
export { productForTemplate, templateForProduct, variantsForTemplate, aopFieldsFor };

/**
 * Template id for a stored or catalog id. Accepts a template id, a sandbox
 * product id, or a Printful catalog id. Unknown ids return null.
 */
export function canonicalTemplateId(id: string): string | null {
  if (getTemplate(id)) return id;
  return templateForProduct("sandbox", id) ?? templateForProduct("printful", id);
}

export function isAopProduct(productId: string): boolean {
  return canonicalTemplateId(productId) != null;
}

/**
 * A placement blank we sell can be ordered. An all-over piece can be ordered
 * only once `aopOrderable` says its panel files exist. Anything we do not
 * recognize is refused. An unknown id used to fall through as orderable,
 * which let a Printful all-over catalog id skip the gate.
 */
export function canOrderProduct(productId: string): boolean {
  const templateId = canonicalTemplateId(productId);
  if (templateId) {
    const template = getTemplate(templateId);
    const catalogProductId = printfulFactsForTemplate(templateId)?.catalogProductId;
    if (!template || catalogProductId == null) return false;
    return aopOrderable(
      catalogProductId,
      template.panels.map((item) => item.id),
    );
  }
  if (isSandboxPlacementProduct(productId)) return true;
  return false;
}

export function materialLine(templateId: string): string {
  const id = canonicalTemplateId(templateId);
  if (!id) return "";
  return printfulFactsForTemplate(id)?.material.line ?? "";
}

export type PrintfulCard = {
  catalogProductId: number;
  name: string;
  materialLine: string;
};

/** The Printful product a template is cut from. Null when the id is not an all-over template. */
export function printfulCard(templateId: string): PrintfulCard | null {
  const id = canonicalTemplateId(templateId);
  if (!id) return null;
  const facts = printfulFactsForTemplate(id);
  if (!facts) return null;
  return {
    catalogProductId: facts.catalogProductId,
    name: facts.name,
    materialLine: facts.material.line,
  };
}

/**
 * Sandbox variant id, `${productId}-printed-${size}`. Printful variant ids are
 * not invented: this returns null until the catalog variant list is filled in.
 * The first listed Printful variant is only a stand-in for a set partner; a
 * size-aware pick belongs with that list.
 */
export function variantForPrinter(
  provider: PrinterId,
  templateId: string,
  size = "m",
): string | null {
  if (provider === "printful") return variantsForTemplate("printful", templateId)?.[0] ?? null;
  const productId = productForTemplate("sandbox", templateId);
  if (!productId) return null;
  return `${productId}-printed-${size.toLowerCase()}`;
}

export function variantIdFor(templateId: string, size = "m"): string {
  const id = variantForPrinter("sandbox", templateId, size);
  if (!id) throw new Error("That garment is not in the sandbox catalog.");
  return id;
}

export type PanelExportPlan = {
  panelId: string;
  title: string;
  printful: PanelPrintTarget;
  proof: { widthPx: number; heightPx: number; note: string };
};

export function panelExportPlan(templateId: string): PanelExportPlan[] {
  const id = canonicalTemplateId(templateId);
  const template = id ? getTemplate(id) : null;
  const catalogProductId = template
    ? printfulFactsForTemplate(template.id)?.catalogProductId
    : null;
  if (!template || catalogProductId == null) return [];
  return template.panels.map((item) => ({
    panelId: item.id,
    title: item.title,
    printful: panelPrintTarget(catalogProductId, item.id),
    proof: {
      ...studioProofPixels(item.box.w, item.box.h),
      note: "Studio proof at a fixed long edge. Not a Printful print file until the template pixel size is confirmed.",
    },
  }));
}

/**
 * Reads a garment saved in the database. A template id loads as itself. A
 * Printful catalog id written into `templateId` by mistake maps back to the
 * template, so older rows and a live catalog id both open.
 */
export function parseStoredGarment(input: string | null | undefined): GarmentDesign | null {
  if (!input) return null;
  try {
    const raw = JSON.parse(input) as Record<string, unknown>;
    if (raw && typeof raw.templateId === "string") {
      raw.templateId = canonicalTemplateId(raw.templateId) ?? raw.templateId;
    }
    return parseGarment(raw);
  } catch {
    return null;
  }
}
