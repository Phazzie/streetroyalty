import type { DesignLayer, PrintArea } from "@/lib/pod/types";
import { MAX_PRINT } from "@/lib/studio/validate";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw that artwork."));
    image.src = src;
  });
}

/**
 * Sizes to try, as a share of the printer's full resolution. The first is the
 * real thing. The rest are for artwork so heavy that the full file would be
 * over the upload limit: 0.75 is the lowest the server accepts without a
 * sharpness warning, and below that the buyer is told the print may be soft.
 */
const SIZE_STEPS = [1, 0.875, 0.75, 0.6, 0.45];

/** Flatten layers into a transparent PNG at the print area's full resolution. */
export async function renderPrintFile(area: PrintArea, layers: DesignLayer[]): Promise<string> {
  const dpi = area.dpi || 150;
  const fullWidth = area.widthIn * dpi;
  const fullHeight = area.heightIn * dpi;
  if (document.fonts?.load) {
    await document.fonts.load(`40px "Archivo Black"`).catch(() => undefined);
    await document.fonts.load(`40px "Outfit"`).catch(() => undefined);
  }
  const images = new Map<string, HTMLImageElement>();
  for (const layer of layers) {
    if (layer.type === "image") images.set(layer.id, await loadImage(layer.src));
  }
  let file = "";
  for (const step of SIZE_STEPS) {
    file = draw(Math.round(fullWidth * step), Math.round(fullHeight * step), layers, images);
    if (file.length <= MAX_PRINT) break;
  }
  return file;
}

function draw(
  targetWidth: number,
  targetHeight: number,
  layers: DesignLayer[],
  images: Map<string, HTMLImageElement>,
): string {
  const width = Math.max(240, targetWidth);
  const height = Math.max(240, targetHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export a print file.");
  ctx.clearRect(0, 0, width, height);
  for (const layer of layers) {
    ctx.save();
    ctx.translate(layer.x * width, layer.y * height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    if (layer.type === "text") {
      const px = Math.max(18, Math.round(height * 0.14 * layer.scale));
      ctx.font = `${px}px "${layer.font}", sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text, 0, 0, width * 0.92);
    } else {
      const image = images.get(layer.id);
      if (image) {
        const dw = width * 0.52 * layer.scale;
        const dh = dw * (image.height / Math.max(1, image.width));
        ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
      }
    }
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}
