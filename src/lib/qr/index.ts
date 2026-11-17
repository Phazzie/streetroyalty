import { encodeQr, type QrMatrix } from "./encode.ts";
import { qrSvg, svgDataUrl, type QrSvgOptions } from "./svg.ts";

export { encodeQr, KIND, type QrMatrix } from "./encode.ts";
export { markZone, isCovered, CROWN_PATH, MAX_MARK_SHARE, type MarkZone } from "./mark.ts";
export { qrSvg, svgDataUrl, QUIET_ZONE, type QrSvgOptions } from "./svg.ts";

/** Where a tag sends whoever scans it: the piece's page on the rack, marked as coming from a tag. */
export function tagUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/rack/${encodeURIComponent(slug)}?via=tag`;
}

/** The crown tag for a link, as an svg string. */
export function tagSvg(url: string, options: QrSvgOptions = {}): string {
  return qrSvg(encodeQr(url), options);
}

/**
 * The code as a PNG data URL. Browser only: it draws the svg onto a canvas.
 * `pixels` is the width and height of the picture.
 */
export async function qrPngDataUrl(
  matrix: QrMatrix,
  pixels: number,
  options: QrSvgOptions = {},
): Promise<string> {
  const image = await loadImage(svgDataUrl(qrSvg(matrix, { ...options, pixels })));
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the tag.");
  context.drawImage(image, 0, 0, pixels, pixels);
  return canvas.toDataURL("image/png");
}

/** Load a picture, or fail with words a person can read. Browser only. */
export function loadImage(source: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A picture did not load."));
    image.src = source;
  });
}
