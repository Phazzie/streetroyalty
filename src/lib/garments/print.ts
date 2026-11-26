/**
 * Print sheets for an all-over garment, drawn from the printer's real cut
 * pieces. One SVG per placement, at the placement's print size. The same
 * drawing is the studio's "print sheets" preview and, rasterized on the
 * server, the file the printer receives. What the maker sees is what prints.
 */
import { activeColorway } from "./colorways.ts";
import { resolvePaint } from "./fill.ts";
import { getTemplate } from "./panels.ts";
import {
  OUTLINE_DPI,
  outlineFor,
  printPixels,
  type OutlinePiece,
  type OutlinePlacement,
} from "./outlines/index.ts";
import type { AopPanel, AopTemplate, GarmentDesign, Paint, TrimBand } from "./types.ts";

/** Paint runs this far past every cut line, so a shifted cut still lands in colour. */
export const BLEED_IN = 0.4;
/** Stripe and checker repeat, in inches on the cloth. */
const PATTERN_IN = 1.5;

export type PrintSheet = {
  placement: string;
  /** Pixel size of the file the printer receives. */
  width: number;
  height: number;
  svg: string;
};

/** Template units per inch on a placement's sheet. */
export function unitsPerInch(placement: OutlinePlacement): number {
  return placement.printArea.width / placement.printInches[0];
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** The piece panel that colours a cut piece. Null when no panel covers it. */
export function pieceOwner(
  template: AopTemplate,
  placement: string,
  piece: string,
): AopPanel | null {
  return (
    template.panels.find(
      (item) =>
        item.kind === "piece" &&
        item.targets.some((target) => target.placement === placement && target.piece === piece),
    ) ?? null
  );
}

/**
 * Checks a template against the printer's pieces, from the printer's side:
 * every piece the printer cuts is coloured by exactly one piece panel, and
 * every panel target names a real piece. Returns the problems, empty when sound.
 */
export function coverageProblems(templateId: string): string[] {
  const template = getTemplate(templateId);
  const outline = outlineFor(templateId);
  if (!template || !outline) return [`${templateId} has no template or no traced outline.`];
  const problems: string[] = [];
  for (const placement of outline.placements) {
    for (const piece of placement.pieces) {
      const owners = template.panels.filter(
        (item) =>
          item.kind === "piece" &&
          item.targets.some(
            (target) => target.placement === placement.placement && target.piece === piece.id,
          ),
      );
      if (owners.length === 0) problems.push(`${placement.placement}/${piece.id} has no panel.`);
      if (owners.length > 1)
        problems.push(`${placement.placement}/${piece.id} is coloured by ${owners.length} panels.`);
    }
  }
  for (const item of template.panels) {
    if (item.targets.length === 0) problems.push(`Panel ${item.id} prints nowhere.`);
    for (const target of item.targets) {
      const placement = outline.placements.find((entry) => entry.placement === target.placement);
      if (!placement?.pieces.some((piece) => piece.id === target.piece)) {
        problems.push(
          `Panel ${item.id} names ${target.placement}/${target.piece}, which is not cut.`,
        );
      }
    }
  }
  return problems;
}

function patternDef(id: string, paint: Paint, unit: number): string {
  if (paint.type !== "pattern") return "";
  const size = Math.round(PATTERN_IN * unit);
  const half = Math.round(size / 2);
  if (paint.pattern === "checker") {
    return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${paint.hex}"/><rect width="${half}" height="${half}" fill="${paint.accent}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${paint.accent}"/></pattern>`;
  }
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${paint.hex}"/><rect width="${Math.round(size * 0.4)}" height="${size}" fill="${paint.accent}"/></pattern>`;
}

/** Fills an area (already masked by the caller) with a paint. */
function paintArea(
  paint: Paint,
  patternId: string,
  area: { x: number; y: number; w: number; h: number },
  shape?: string,
): string {
  const geometry =
    shape ?? `<rect x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}"`;
  if (paint.type === "solid") return `${geometry} fill="${paint.hex}"/>`;
  if (paint.type === "pattern") return `${geometry} fill="url(#${patternId})"/>`;
  return `<image href="${escapeAttr(paint.src)}" x="${area.x}" y="${area.y}" width="${area.w}" height="${area.h}" preserveAspectRatio="xMidYMid slice"/>`;
}

/** Polygon for a band, in template units. */
function bandShape(piece: OutlinePiece, band: TrimBand, unit: number, bleed: number): string {
  const [x, y, w, h] = piece.bbox;
  const top = y - bleed;
  const bottom = y + h + bleed;
  if ("edge" in band) {
    const inner = band.offsetIn * unit;
    const width = band.widthIn * unit;
    // A band that starts at the edge also covers the bleed past the cut line.
    const outerReach = band.offsetIn === 0 ? bleed : 0;
    if (band.edge === "left") {
      const x0 = x + inner - outerReach;
      const x1 = x + inner + width;
      return `<path d="M${x0} ${top} L${x1} ${top} L${x1} ${bottom} L${x0} ${bottom} Z"`;
    }
    const x1 = x + w - inner + outerReach;
    const x0 = x + w - inner - width;
    return `<path d="M${x0} ${top} L${x1} ${top} L${x1} ${bottom} L${x0} ${bottom} Z"`;
  }
  const [x1, y1, x2, y2] = band.line;
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / length) * ((band.widthIn * unit) / 2);
  const ny = ((x2 - x1) / length) * ((band.widthIn * unit) / 2);
  const points = [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ]
    .map(([px, py]) => `${Math.round(px! * 10) / 10} ${Math.round(py! * 10) / 10}`)
    .join(" L");
  return `<path d="M${points} Z"`;
}

/** Bounding box of a band shape, for art fills. */
function bandArea(piece: OutlinePiece, bleed: number) {
  const [x, y, w, h] = piece.bbox;
  return { x: x - bleed, y: y - bleed, w: w + bleed * 2, h: h + bleed * 2 };
}

export type SheetOptions = {
  /** Colorway to print. Defaults to the garment's active colorway. */
  colorwayId?: string;
  /** The maker's chest-logo artwork, an image the renderer can load (data URL). */
  logoHref?: string;
  /** Width in pixels of the returned SVG. Defaults to the print size. */
  widthPx?: number;
  /** Draws a dashed box where the logo prints. For on-screen previews only. */
  showLogoBox?: boolean;
  /** Paints the sheet white, the undyed cloth, so dark pieces read on a dark page. Previews only. */
  paper?: boolean;
};

/** One placement's print sheet as SVG. */
export function renderPrintSheet(
  garment: GarmentDesign,
  placementKey: string,
  options: SheetOptions = {},
): PrintSheet {
  const template = getTemplate(garment.templateId);
  const outline = outlineFor(garment.templateId);
  const placement = outline?.placements.find((item) => item.placement === placementKey);
  if (!template || !outline || !placement) {
    throw new Error(`There is no ${placementKey} sheet for that garment.`);
  }
  const chosen =
    options.colorwayId && garment.colorways.some((item) => item.id === options.colorwayId)
      ? { ...garment, activeColorwayId: options.colorwayId }
      : garment;
  const colorway = activeColorway(chosen);
  const fills = new Map(garment.panels.map((item) => [item.id, item.fill]));
  const paintOf = (item: AopPanel) => resolvePaint(item, fills.get(item.id), colorway);
  const unit = unitsPerInch(placement);
  const bleed = Math.round(BLEED_IN * unit);
  const full = printPixels(placement);
  const width = options.widthPx ?? full.width;
  const height = Math.round((width / full.width) * full.height);
  const area = placement.printArea;

  const defs: string[] = [];
  const body: string[] = [];
  for (const piece of placement.pieces) {
    const pid = safeId(piece.id);
    // The cut line plus bleed: the piece filled and stroked twice the bleed wide.
    defs.push(
      `<mask id="m-${pid}" maskUnits="userSpaceOnUse" x="${area.left - bleed}" y="${area.top - bleed}" width="${area.width + bleed * 2}" height="${area.height + bleed * 2}"><path d="${piece.path}" fill="#fff" stroke="#fff" stroke-width="${bleed * 2}" stroke-linejoin="round"/></mask>`,
    );
    const owner = pieceOwner(template, placement.placement, piece.id);
    const layers: string[] = [];
    if (owner) {
      const paint = paintOf(owner);
      const patternId = `p-${safeId(owner.id)}`;
      if (paint.type === "pattern" && !defs.some((def) => def.includes(`id="${patternId}"`))) {
        defs.push(patternDef(patternId, paint, unit));
      }
      layers.push(paintArea(paint, patternId, bandArea(piece, bleed)));
    }
    for (const trim of template.panels.filter((item) => item.kind === "trim")) {
      for (const target of trim.targets) {
        if (target.placement !== placement.placement || target.piece !== piece.id || !target.band)
          continue;
        const paint = paintOf(trim);
        const patternId = `p-${safeId(trim.id)}`;
        if (paint.type === "pattern" && !defs.some((def) => def.includes(`id="${patternId}"`))) {
          defs.push(patternDef(patternId, paint, unit));
        }
        const shape = bandShape(piece, target.band, unit, bleed);
        if (paint.type === "art") {
          const clip = `c-${safeId(trim.id)}-${pid}`;
          defs.push(`<clipPath id="${clip}">${shape}/></clipPath>`);
          layers.push(
            `<g clip-path="url(#${clip})">${paintArea(paint, patternId, bandArea(piece, bleed))}</g>`,
          );
        } else {
          layers.push(paintArea(paint, patternId, bandArea(piece, bleed), shape));
        }
      }
    }
    for (const mark of template.panels.filter((item) => item.kind === "mark")) {
      for (const target of mark.targets) {
        if (target.placement !== placement.placement || target.piece !== piece.id || !target.box)
          continue;
        const fill = fills.get(mark.id);
        // A logo with its own fill gets a printed patch behind it.
        if (fill && fill.kind !== "role") {
          const paint = paintOf(mark);
          const patternId = `p-${safeId(mark.id)}`;
          if (paint.type === "pattern" && !defs.some((def) => def.includes(`id="${patternId}"`))) {
            defs.push(patternDef(patternId, paint, unit));
          }
          layers.push(paintArea(paint, patternId, target.box));
        }
        if (options.showLogoBox) {
          const box = target.box;
          const dash = Math.round(unit / 4);
          layers.push(
            `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="${colorway.colors.mark}" stroke-width="${Math.max(2, Math.round(unit / 12))}" stroke-dasharray="${dash} ${dash}"/>`,
          );
        }
        if (options.logoHref) {
          const box = target.box;
          layers.push(
            `<image href="${escapeAttr(options.logoHref)}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"/>`,
          );
        }
      }
    }
    body.push(`<g data-piece="${pid}" mask="url(#m-${pid})">${layers.join("")}</g>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${area.left} ${area.top} ${area.width} ${area.height}"><defs>${defs.join("")}</defs>${options.paper ? `<rect x="${area.left}" y="${area.top}" width="${area.width}" height="${area.height}" fill="#ffffff"/>` : ""}${body.join("")}</svg>`;
  return { placement: placement.placement, width, height, svg };
}

/** Every placement the printer needs for a garment, in the outline's order. */
export function printPlacements(templateId: string): string[] {
  return outlineFor(templateId)?.placements.map((item) => item.placement) ?? [];
}

/** Every print sheet of a garment. */
export function renderPrintSheets(
  garment: GarmentDesign,
  options: SheetOptions = {},
): PrintSheet[] {
  return printPlacements(garment.templateId).map((placement) =>
    renderPrintSheet(garment, placement, options),
  );
}

/** Print DPI the sheets are made at. */
export const PRINT_DPI = OUTLINE_DPI;
