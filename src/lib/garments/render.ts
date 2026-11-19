import { activeColorway, defaultGarment } from "./colorways.ts";
import { resolvePaint } from "./fill.ts";
import { getTemplate, visiblePanels } from "./panels.ts";
import { LABEL_MAX, type GarmentDesign, type Paint } from "./types.ts";

export function resolveGarment(garment: GarmentDesign, face: "front" | "back" = "front") {
  const template = getTemplate(garment.templateId);
  if (!template) throw new Error("That garment template is not in the studio.");
  const colorway = activeColorway(garment);
  const fills = new Map(garment.panels.map((item) => [item.id, item.fill]));
  return {
    template,
    colorway,
    panels: visiblePanels(template, face).map((item) => ({
      panel: item,
      paint: resolvePaint(item, fills.get(item.id), colorway),
    })),
  };
}

/** Drops the characters XML 1.0 does not allow anywhere in a document. */
function xmlChars(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code === 0x9 || code === 0xa || code === 0xd) return true;
      return code >= 0x20 && code !== 0xfffe && code !== 0xffff;
    })
    .join("");
}

function escapeXml(value: string): string {
  return xmlChars(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function paintAttrs(panelId: string, paint: Paint): { fill: string; extra: string } {
  if (paint.type === "solid") return { fill: paint.hex, extra: "" };
  if (paint.type === "art") {
    return { fill: "#f4f0e6", extra: "" };
  }
  return { fill: `url(#pat-${panelId})`, extra: "" };
}

function patternDef(panelId: string, paint: Paint): string {
  if (paint.type !== "pattern") return "";
  if (paint.pattern === "checker") {
    return `<pattern id="pat-${panelId}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${paint.hex}"/><rect width="6" height="6" fill="${paint.accent}"/><rect x="6" y="6" width="6" height="6" fill="${paint.accent}"/></pattern>`;
  }
  return `<pattern id="pat-${panelId}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${paint.hex}"/><rect width="4" height="10" fill="${paint.accent}"/></pattern>`;
}

/** Flat technical drawing of the whole garment, as a mockup the sandbox can store. */
export function renderGarmentSvg(input: {
  templateId: string;
  garment?: GarmentDesign;
  face?: "front" | "back";
  label?: string;
}): string {
  const garment = input.garment ?? defaultGarment(input.templateId);
  const face = input.face ?? "front";
  const resolved = resolveGarment({ ...garment, templateId: input.templateId }, face);
  const defs = resolved.panels.map(({ panel: item, paint }) => patternDef(item.id, paint)).join("");
  const art = resolved.panels
    .filter(({ paint }) => paint.type === "art")
    .map(({ panel: item, paint }) => {
      if (paint.type !== "art") return "";
      const href = paint.src.startsWith("data:")
        ? paint.src.replaceAll('"', "")
        : escapeXml(paint.src);
      return `<clipPath id="clip-${item.id}"><path d="${item.d}"/></clipPath><image href="${href}" x="${item.box.x}" y="${item.box.y}" width="${item.box.w}" height="${item.box.h}" clip-path="url(#clip-${item.id})" preserveAspectRatio="xMidYMid slice"/>`;
    })
    .join("");
  const shapes = resolved.panels
    .map(({ panel: item, paint }) => {
      const attrs = paintAttrs(item.id, paint);
      return `<path data-panel="${item.id}" d="${item.d}" fill="${attrs.fill}" stroke="#141018" stroke-width="1.5"/>`;
    })
    .join("");
  // Cut the raw text, by whole characters, before escaping. Cutting after would split an entity.
  const labelText = input.label ? Array.from(input.label).slice(0, LABEL_MAX).join("") : "";
  const label = labelText
    ? `<text x="200" y="172" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="14" fill="${escapeXml(resolved.colorway.colors.mark)}" stroke="${escapeXml(resolved.colorway.colors.body)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${escapeXml(labelText)}</text>`
    : "";
  const { template } = resolved;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${template.viewBox}">
  <rect width="${template.viewWidth}" height="${template.viewHeight}" fill="#120a1c"/>
  <defs>${defs}</defs>
  ${shapes}
  ${art}
  ${label}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Longest side of a studio proof. This is not a printer template size. */
export const STUDIO_PROOF_LONG_EDGE = 900;

export function studioProofPixels(
  layoutW: number,
  layoutH: number,
): { widthPx: number; heightPx: number } {
  const long = Math.max(layoutW, layoutH, 1);
  const scale = STUDIO_PROOF_LONG_EDGE / long;
  return {
    widthPx: Math.max(1, Math.round(layoutW * scale)),
    heightPx: Math.max(1, Math.round(layoutH * scale)),
  };
}
