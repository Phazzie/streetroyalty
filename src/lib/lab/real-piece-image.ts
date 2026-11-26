import { garmentMockupSvg } from "../gfx/garments/index.ts";
import type { RealPiece } from "./real-pieces.ts";

/**
 * A picture of the real blank for the board and for the look. The look model
 * takes raster pictures, so the drawing is turned into a PNG in the browser.
 * Where that can't happen the drawing itself is used.
 */
export async function realPieceImage(piece: RealPiece, size = 768): Promise<string> {
  const svg = garmentMockupSvg({
    shape: piece.shape,
    colorHex: piece.hex,
    placement: piece.shape === "joggers" ? "leg_front_left" : "front",
    layers: [],
  });
  if (typeof document === "undefined") return svg;
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = svg;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return svg;
    ctx.drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } catch {
    return svg;
  }
}
