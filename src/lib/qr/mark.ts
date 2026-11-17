import { alignmentPatterns, KIND, type QrMatrix } from "./encode.ts";

/**
 * Where the crown sits in the middle of a code.
 *
 * The mark only ever hides data modules, which level H can rebuild. It never hides a
 * finder, a timing line or an alignment eye. Versions 7 to 13 have an alignment eye
 * dead centre, so there the crown sits on top of the eye and the eye stays drawn.
 */

/** The crown from the site header (src/components/site/shell.tsx), as one path in a 32 by 22 box. */
export const CROWN_PATH =
  "M2 18.5 5.4 5.2l5.2 6.3L16 1l5.4 10.5 5.2-6.3L30 18.5ZM2.5 19.6h27a.5.5 0 0 1 .5.5v1.4a.5.5 0 0 1-.5.5h-27a.5.5 0 0 1-.5-.5v-1.4a.5.5 0 0 1 .5-.5Z";

/** The part of that box the crown actually fills. */
export const CROWN_BOX = { x: 2, y: 1, width: 28, height: 21 } as const;

export type Rect = { x: number; y: number; width: number; height: number };

export type MarkZone = {
  /** The block of modules cleared for the mark, in whole modules, without the quiet zone. */
  zone: Rect;
  /** Where the crown is drawn inside that block, in modules. */
  crown: Rect;
  /** The centre alignment eye the crown sits on, when this version has one. */
  eye: { x: number; y: number } | null;
  /** How many data modules the mark hides. */
  covered: number;
  /** That count as a share of the whole code, 0 to 1. */
  share: number;
};

/** The mark is never allowed to hide more of the code than this. */
export const MAX_MARK_SHARE = 0.15;

function inEye(eye: { x: number; y: number } | null, x: number, y: number): boolean {
  return eye !== null && Math.abs(x - eye.x) <= 2 && Math.abs(y - eye.y) <= 2;
}

/** True when the mark hides this module. Function modules are never hidden. */
export function isCovered(matrix: QrMatrix, mark: MarkZone | null, x: number, y: number): boolean {
  if (!mark) return false;
  const { zone } = mark;
  if (x < zone.x || y < zone.y || x >= zone.x + zone.width || y >= zone.y + zone.height) {
    return false;
  }
  return matrix.kinds[y * matrix.size + x] === KIND.data;
}

function clean(matrix: QrMatrix, zone: Rect, eye: { x: number; y: number } | null): boolean {
  for (let y = zone.y; y < zone.y + zone.height; y += 1) {
    for (let x = zone.x; x < zone.x + zone.width; x += 1) {
      if (x < 0 || y < 0 || x >= matrix.size || y >= matrix.size) return false;
      if (matrix.kinds[y * matrix.size + x] !== KIND.data && !inEye(eye, x, y)) return false;
    }
  }
  return true;
}

function fitCrown(box: Rect, anchor: "middle" | "bottom"): Rect {
  const ratio = CROWN_BOX.width / CROWN_BOX.height;
  const width = Math.min(box.width, box.height * ratio);
  const height = width / ratio;
  return {
    x: box.x + (box.width - width) / 2,
    y: anchor === "bottom" ? box.y + box.height - height : box.y + (box.height - height) / 2,
    width,
    height,
  };
}

function largestOdd(value: number): number {
  const whole = Math.floor(value);
  return whole % 2 === 1 ? whole : whole - 1;
}

/** Work out the mark for a code, or null when the code is too small to carry one. */
export function markZone(matrix: QrMatrix): MarkZone | null {
  const { size, version } = matrix;
  const centre = (size - 1) / 2;
  const eye = alignmentPatterns(version).find((p) => p.x === centre && p.y === centre) ?? null;

  for (let width = largestOdd(size * (eye ? 0.27 : 0.31)); width >= 3; width -= 2) {
    const half = (width - 1) / 2;
    let zone: Rect;
    let crown: Rect;
    if (eye) {
      // A crown, a breath of light, then the eye with a light row under it.
      const crownWidth = width - 1.6;
      const crownHeight = (crownWidth * CROWN_BOX.height) / CROWN_BOX.width;
      const rows = Math.ceil(crownHeight + 1.3);
      zone = { x: centre - half, y: centre - 2 - rows, width, height: rows + 6 };
      crown = fitCrown(
        { x: zone.x + 0.8, y: zone.y + 0.7, width: crownWidth, height: rows - 1.3 },
        "bottom",
      );
    } else {
      zone = { x: centre - half, y: centre - half, width, height: width };
      const pad = width > 3 ? 0.8 : 0.3;
      crown = fitCrown(
        { x: zone.x + pad, y: zone.y + pad, width: width - pad * 2, height: width - pad * 2 },
        "middle",
      );
    }
    if (!clean(matrix, zone, eye)) continue;
    const covered = zone.width * zone.height - (eye ? 25 : 0);
    const share = covered / (size * size);
    if (share > MAX_MARK_SHARE) continue;
    return { zone, crown, eye, covered, share };
  }
  return null;
}
