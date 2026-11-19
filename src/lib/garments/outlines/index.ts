/**
 * The printer's real cut pieces, by our template id. Read this to build the
 * studio's panels from real pieces, to draw the preview, and to make print files.
 */
import { OUTLINES } from "./data.ts";
import {
  OUTLINE_DPI,
  type GarmentOutline,
  type OutlinePiece,
  type OutlinePlacement,
} from "./types.ts";

export type { GarmentOutline, OutlineLabel, OutlinePiece, OutlinePlacement } from "./types.ts";
export { OUTLINE_DPI, TEMPLATE_UNITS } from "./types.ts";

export type OutlineTemplateId = keyof typeof OUTLINES;

/** All traced garments. */
export const OUTLINE_TEMPLATE_IDS = Object.keys(OUTLINES) as OutlineTemplateId[];

/** The outline for one of our template ids, or null when none has been traced. */
export function outlineFor(templateId: string): GarmentOutline | null {
  return Object.hasOwn(OUTLINES, templateId)
    ? (OUTLINES[templateId as OutlineTemplateId] as GarmentOutline)
    : null;
}

/** One placement of a garment, or null. */
export function placementOf(templateId: string, placement: string): OutlinePlacement | null {
  return outlineFor(templateId)?.placements.find((item) => item.placement === placement) ?? null;
}

/** Every piece the printer cuts for a garment, with the placement it is printed on. */
export function piecesOf(templateId: string): { placement: string; piece: OutlinePiece }[] {
  const outline = outlineFor(templateId);
  if (!outline) return [];
  return outline.placements.flatMap((item) =>
    item.pieces.map((piece) => ({ placement: item.placement, piece })),
  );
}

/** Pixel size of a placement's print file at the outline DPI. */
export function printPixels(placement: OutlinePlacement): { width: number; height: number } {
  return {
    width: Math.round(placement.printInches[0] * OUTLINE_DPI),
    height: Math.round(placement.printInches[1] * OUTLINE_DPI),
  };
}

/** Maps a point in template units to a pixel in that placement's print file. */
export function templateToPrintPx(
  placement: OutlinePlacement,
  point: { x: number; y: number },
): { x: number; y: number } {
  const { width, height } = printPixels(placement);
  const area = placement.printArea;
  return {
    x: ((point.x - area.left) / area.width) * width,
    y: ((point.y - area.top) / area.height) * height,
  };
}

/** The points of a piece's path, in template units. */
export function pathPoints(path: string): { x: number; y: number }[] {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index]!, y: numbers[index + 1]! });
  }
  return points;
}

/** Area of a piece in square template units (shoelace formula). */
export function pieceArea(piece: OutlinePiece): number {
  const points = pathPoints(piece.path);
  let twice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}
