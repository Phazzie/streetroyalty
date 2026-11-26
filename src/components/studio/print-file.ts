import type { DesignLayer, PrintArea } from "@/lib/pod/types";
import { fontShorthand } from "@/lib/studio/fonts";
import {
  arcLayout,
  clampFx,
  fitFontSize,
  isFlatText,
  LINE_FIT,
  lineRiseEm,
  lineSpanEm,
  OUTLINE_EM,
  TEXT_EM,
  type TextFx,
} from "@/lib/studio/textfx";
import { MAX_PRINT } from "@/lib/studio/validate";

/** Sticker outline thickness, as a share of the font size. Half of it shows outside the letters. */
export const STROKE_EM = 0.18;
/** Picture width as a share of the print area's width, at scale 1. */
export const IMAGE_SHARE = 0.52;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw that artwork."));
    image.src = src;
  });
}

/** Waits for every face the layers use, so the print file never falls back to a system font. */
export async function loadLayerFonts(layers: DesignLayer[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const faces = new Set(layers.flatMap((layer) => (layer.type === "text" ? [layer.font] : [])));
  faces.add("Archivo Black");
  await Promise.all(
    [...faces].map((face) => document.fonts.load(fontShorthand(face, 40)).catch(() => undefined)),
  );
}

/**
 * Sizes to try, as a share of the printer's full resolution. The first is the
 * real thing. The rest are for artwork so heavy that the full file would be
 * over the upload limit: 0.75 is the lowest the server accepts without a
 * sharpness warning, and below that the buyer is told the print may be soft.
 * If even the smallest does not fit, the export stops with a message that says
 * what to change.
 */
const SIZE_STEPS = [1, 0.875, 0.75, 0.6, 0.45];

/** Flatten layers into a transparent PNG at the print area's full resolution. */
export async function renderPrintFile(area: PrintArea, layers: DesignLayer[]): Promise<string> {
  const dpi = area.dpi || 150;
  const fullWidth = area.widthIn * dpi;
  const fullHeight = area.heightIn * dpi;
  await loadLayerFonts(layers);
  // Kept by position, not by id: two layers can carry the same id and must not share a picture.
  const images: (HTMLImageElement | null)[] = [];
  for (const layer of layers) {
    images.push(layer.type === "image" ? await loadImage(layer.src) : null);
  }
  let file = "";
  for (const step of SIZE_STEPS) {
    file = draw(Math.round(fullWidth * step), Math.round(fullHeight * step), layers, images);
    if (file.length <= MAX_PRINT) return file;
  }
  // Smaller than this would print soft, and the server would refuse the file anyway.
  throw new Error(
    "That artwork is too heavy to print at a usable size. Use a smaller or simpler picture, or scale it down on the piece.",
  );
}

/** A small PNG of the print area for drawn mockups: the same paint, at screen size. */
export async function renderPreview(area: PrintArea, layers: DesignLayer[], maxEdge = 520): Promise<string> {
  await loadLayerFonts(layers);
  const images: (HTMLImageElement | null)[] = [];
  for (const layer of layers) {
    images.push(layer.type === "image" ? await loadImage(layer.src) : null);
  }
  const ratio = area.widthIn / Math.max(0.1, area.heightIn);
  const width = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
  const height = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;
  return draw(width, height, layers, images, 1);
}

function draw(
  targetWidth: number,
  targetHeight: number,
  layers: DesignLayer[],
  images: (HTMLImageElement | null)[],
  floor = 240,
): string {
  const width = Math.max(floor, targetWidth);
  const height = Math.max(floor, targetHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export a print file.");
  paintLayers(ctx, width, height, layers, images);
  return canvas.toDataURL("image/png");
}

/**
 * Paints the layers onto a print area of the given size in pixels. The print file and
 * the studio's live canvas both call this, so what is on screen is what prints.
 */
export function paintLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layers: DesignLayer[],
  images: (HTMLImageElement | null | undefined)[],
): void {
  ctx.clearRect(0, 0, width, height);
  layers.forEach((layer, index) => {
    ctx.save();
    ctx.translate(layer.x * width, layer.y * height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    if (layer.type === "text") {
      const px = Math.max(4, height * TEXT_EM * layer.scale);
      const maxWidth = width * LINE_FIT;
      const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
      const stroke = fx.outline ? undefined : layer.stroke;
      if (isFlatText(fx)) {
        ctx.font = fontShorthand(layer.font, px);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = px * STROKE_EM;
          ctx.lineJoin = "round";
          ctx.strokeText(layer.text, 0, 0, maxWidth);
        }
        ctx.fillStyle = layer.color;
        ctx.fillText(layer.text, 0, 0, maxWidth);
      } else if (Math.abs(fx.arc) < 0.001) {
        drawStraightText(ctx, layer.text, fx, layer.color, layer.font, px, maxWidth, stroke);
      } else {
        drawCurvedText(ctx, layer.text, fx, layer.color, layer.font, px, maxWidth, stroke);
      }
    } else {
      const image = images[index];
      if (image) {
        const dw = width * IMAGE_SHARE * layer.scale;
        const dh = dw * (image.height / Math.max(1, image.width));
        ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
      }
    }
    ctx.restore();
  });
}

/**
 * How big a layer draws before it is turned, in pixels of a print area of the given
 * size. Measured with the same canvas maths `paintLayers` draws with, so a selection box
 * hugs the ink.
 */
export function measureLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layer: DesignLayer,
  image?: { width: number; height: number } | null,
): { w: number; h: number } {
  if (layer.type === "image") {
    const w = width * IMAGE_SHARE * layer.scale;
    const ratio = image && image.width > 0 ? image.height / image.width : 1;
    return { w, h: w * ratio };
  }
  const px = Math.max(4, height * TEXT_EM * layer.scale);
  const maxWidth = width * LINE_FIT;
  const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
  const pad = !fx.outline && layer.stroke ? px * STROKE_EM : 0;
  if (isFlatText(fx) || Math.abs(fx.arc) < 0.001) {
    ctx.font = fontShorthand(layer.font, px);
    const chars = [...layer.text];
    let w = isFlatText(fx)
      ? ctx.measureText(layer.text).width
      : chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
        fx.tracking * px * Math.max(0, chars.length - 1);
    let size = px;
    if (w > maxWidth) {
      size = isFlatText(fx) ? px : (px * maxWidth) / w;
      w = maxWidth;
    }
    return { w: w + pad, h: size * 0.95 + pad };
  }
  const cells = arcLayout(layer.text, fx);
  const size = fitFontSize(px, lineSpanEm(cells), maxWidth);
  return { w: lineSpanEm(cells) * size + pad, h: (lineRiseEm(cells) - 0.25) * size + pad };
}

/** Ink, outline, or sticker outline, at a stroke that matches the studio preview. */
function setPaint(ctx: CanvasRenderingContext2D, fx: TextFx, color: string, size: number) {
  if (fx.outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * OUTLINE_EM);
    ctx.lineJoin = "round";
  } else {
    ctx.fillStyle = color;
  }
}

function paintChar(
  ctx: CanvasRenderingContext2D,
  fx: TextFx,
  char: string,
  x: number,
  y: number,
  stroke: string | undefined,
  size: number,
) {
  if (fx.outline) {
    ctx.strokeText(char, x, y);
    return;
  }
  if (stroke) {
    const fill = ctx.fillStyle;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = size * STROKE_EM;
    ctx.lineJoin = "round";
    ctx.strokeText(char, x, y);
    ctx.fillStyle = fill;
  }
  ctx.fillText(char, x, y);
}

/**
 * A straight line with letter spacing or an outline. Letters keep the font's own widths,
 * the way the studio preview spaces them, and the whole line shrinks to fit the width.
 */
function drawStraightText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fx: TextFx,
  color: string,
  font: string,
  px: number,
  maxWidth: number,
  stroke: string | undefined,
) {
  const chars = [...text];
  const measure = (size: number) => {
    ctx.font = fontShorthand(font, size);
    const widths = chars.map((char) => ctx.measureText(char).width);
    const gaps = fx.tracking * size * Math.max(0, chars.length - 1);
    return { widths, total: widths.reduce((sum, value) => sum + value, 0) + gaps };
  };
  let size = px;
  let line = measure(size);
  if (line.total > maxWidth && line.total > 0) {
    size = (size * maxWidth) / line.total;
    line = measure(size);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  setPaint(ctx, fx, color, size);
  // Every outline goes down before any fill, so a fat outline never bites the next letter.
  const place = (draw: (char: string, x: number) => void) => {
    let x = -line.total / 2;
    chars.forEach((char, index) => {
      draw(char, x);
      x += (line.widths[index] ?? 0) + fx.tracking * size;
    });
  };
  if (stroke && !fx.outline) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = size * STROKE_EM;
    ctx.lineJoin = "round";
    place((char, x) => ctx.strokeText(char, x, 0));
    place((char, x) => ctx.fillText(char, x, 0));
    return;
  }
  place((char, x) => paintChar(ctx, fx, char, x, 0, undefined, size));
}

/**
 * A curved line, laid out by the same geometry as the studio preview. It shrinks until
 * its first and last letters fit the width, and sits centred on the layer the way the
 * preview centres it.
 */
function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fx: TextFx,
  color: string,
  font: string,
  px: number,
  maxWidth: number,
  stroke: string | undefined,
) {
  const cells = arcLayout(text, fx);
  const size = fitFontSize(px, lineSpanEm(cells), maxWidth);
  const lifts = cells.map((cell) => cell.lift);
  const middle = (Math.max(0, ...lifts) + Math.min(0, ...lifts)) / 2;
  ctx.font = fontShorthand(font, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setPaint(ctx, fx, color, size);
  const passes: ("stroke" | "fill")[] = stroke && !fx.outline ? ["stroke", "fill"] : ["fill"];
  for (const pass of passes) {
    for (const cell of cells) {
      ctx.save();
      ctx.translate(cell.along * size, (cell.lift - middle) * size);
      ctx.rotate((cell.rotate * Math.PI) / 180);
      if (pass === "stroke" && stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = size * STROKE_EM;
        ctx.lineJoin = "round";
        ctx.strokeText(cell.char, 0, 0);
      } else {
        paintChar(ctx, fx, cell.char, 0, 0, undefined, size);
      }
      ctx.restore();
    }
  }
}
