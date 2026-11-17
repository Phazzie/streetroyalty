/**
 * How sharp a picture prints. The numbers are the studio's own: the house tee prints
 * 12 inches wide at 150 dots an inch (src/lib/pod/sandbox.ts).
 */

export const STUDIO_DPI = 150;
export const HOUSE_TEE_WIDTH_IN = 12;

/** Whole dots per inch when a picture this wide is stretched across a print this wide. */
export function dotsPerInch(pictureWidthPx: number, printWidthIn: number): number {
  if (!Number.isFinite(pictureWidthPx) || !Number.isFinite(printWidthIn)) return 0;
  if (pictureWidthPx <= 0 || printWidthIn <= 0) return 0;
  return Math.floor(pictureWidthPx / printWidthIn);
}

/** How wide a picture has to be, in pixels, to fill a print at the wanted dots per inch. */
export function pixelsWanted(printWidthIn: number, wanted: number = STUDIO_DPI): number {
  if (!Number.isFinite(printWidthIn) || printWidthIn <= 0) return 0;
  return Math.ceil(printWidthIn * wanted);
}

export type Sharpness = "sharp" | "soft" | "blurry";

/** A rule of thumb: enough dots is sharp, half of enough is soft, less than that shows. */
export function sharpness(dpi: number, wanted: number = STUDIO_DPI): Sharpness {
  if (!Number.isFinite(dpi) || dpi <= 0) return "blurry";
  if (dpi >= wanted) return "sharp";
  if (dpi >= wanted / 2) return "soft";
  return "blurry";
}
