import type { Pixels } from "./effects.ts";

/** Browser glue between image sources and the pixel effects. Client only. */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That picture could not be opened."));
    image.src = src;
  });
}

function surface(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot edit pictures.");
  return { canvas, ctx };
}

export async function loadPixels(src: string, maxEdge = 900): Promise<Pixels> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const { canvas, ctx } = surface(image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: frame.data, width: canvas.width, height: canvas.height };
}

function draw(pixels: Pixels): HTMLCanvasElement {
  const { canvas, ctx } = surface(pixels.width, pixels.height);
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
    0,
    0,
  );
  return canvas;
}

/** A transparent PNG that fits the studio's layer size limit, shrinking the picture if it has to. */
export function fitPng(pixels: Pixels, maxChars = 1_250_000): string {
  let canvas = draw(pixels);
  let png = canvas.toDataURL("image/png");
  while (png.length > maxChars && Math.max(canvas.width, canvas.height) > 240) {
    const next = surface(canvas.width * 0.8, canvas.height * 0.8);
    next.ctx.imageSmoothingQuality = "high";
    next.ctx.drawImage(canvas, 0, 0, next.canvas.width, next.canvas.height);
    canvas = next.canvas;
    png = canvas.toDataURL("image/png");
  }
  return png;
}

/** The print laid on a flat field of the garment colour, small enough to send as a clothing reference. */
export async function garmentPreview(printFile: string, colorHex: string): Promise<string> {
  const print = await loadImage(printFile);
  const { canvas, ctx } = surface(768, 960);
  ctx.fillStyle = /^#[0-9a-f]{3,8}$/i.test(colorHex) ? colorHex : "#141414";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const width = canvas.width * 0.6;
  const height = width * (print.naturalHeight / Math.max(1, print.naturalWidth));
  ctx.drawImage(
    print,
    (canvas.width - width) / 2,
    canvas.height * 0.46 - height / 2,
    width,
    height,
  );
  return canvas.toDataURL("image/jpeg", 0.86);
}

export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("That picture could not be loaded.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
