/**
 * The clothing reference for an all-over piece: the whole garment, front above back, in its
 * active colourway, with the chest print where it sits. Pure, so it can be tested; the
 * browser turns it into the JPEG the picture maker reads (see mockupReference).
 */
import { getTemplate, renderGarmentSvg, type GarmentDesign } from "../studio/garments.ts";

const GAP = 24;
const PAD = 24;
/** Where renderGarmentSvg draws the chest label when a template has no logo panel. */
const LABEL_BOX = { x: 184, y: 156, w: 32, h: 26 };

function printable(src: string | null | undefined): src is string {
  return Boolean(src && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(src));
}

export function allOverSheet(garment: GarmentDesign, chestPrint?: string | null): string {
  const template = getTemplate(garment.templateId);
  if (!template) throw new Error("That garment template is not in the studio.");
  const { viewWidth: w, viewHeight: h } = template;
  const front = renderGarmentSvg({ templateId: template.id, garment, face: "front" });
  const back = renderGarmentSvg({ templateId: template.id, garment, face: "back" });
  const box = template.panels.find((item) => item.role === "mark")?.box ?? LABEL_BOX;
  const print = printable(chestPrint)
    ? `<image data-part="chest-print" href="${chestPrint}" x="${PAD + box.x}" y="${PAD + box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const width = w + PAD * 2;
  const height = h * 2 + GAP + PAD * 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#120a1c"/>
  <image data-part="front" href="${front}" x="${PAD}" y="${PAD}" width="${w}" height="${h}"/>
  <image data-part="back" href="${back}" x="${PAD}" y="${PAD + h + GAP}" width="${w}" height="${h}"/>
  ${print}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
