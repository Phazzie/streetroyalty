/**
 * Shapes for the printer's real cut pieces. Pure data: nothing here imports the
 * pod layer or the studio, so both can read it.
 */

/** Every template sheet is a square of this many units. */
export const TEMPLATE_UNITS = 3000;

/** Print files are made at this resolution. Printful's all-over guide asks for 150 DPI. */
export const OUTLINE_DPI = 150;

/** One piece the printer cuts out of a placement's sheet. */
export type OutlinePiece = {
  /** Unique within a garment, e.g. "body_front", "cuff_left", "hood_3". */
  id: string;
  title: string;
  /** Bounding box in template units: x, y, width, height. */
  bbox: readonly [number, number, number, number];
  /** Closed SVG path in template units. Straight segments only ("M x y L x y ... Z"). */
  path: string;
};

/** One printer placement: a sheet, the pieces cut from it, and its print size. */
export type OutlinePlacement = {
  /** The printer's placement key, e.g. "front", "sleeve_left", "leg_left". */
  placement: string;
  /** Size of the print file in inches, the same for every garment size. */
  printInches: readonly [number, number];
  /** Where the print file sits on the template sheet, in template units. */
  printArea: { left: number; top: number; width: number; height: number };
  /** The printer's template image the outlines were traced from. */
  templateImage: string;
  pieces: readonly OutlinePiece[];
};

/** A printed label: a print area with no cut piece of its own. */
export type OutlineLabel = {
  placement: string;
  printInches: readonly [number, number];
};

export type GarmentOutline = {
  /** Our template id, e.g. "aop-hoodie". */
  templateId: string;
  printer: "printful";
  /** Every placement the printer cuts pieces from. A print order covers all of them. */
  placements: readonly OutlinePlacement[];
  /** Optional printed labels. They are not required for a complete print order. */
  labels: readonly OutlineLabel[];
};
