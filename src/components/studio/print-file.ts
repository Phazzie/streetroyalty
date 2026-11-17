import type { DesignLayer, PrintArea } from "@/lib/pod/types";
import { arcLayout, clampFx, isFlatText } from "@/lib/studio/textfx";
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
 * If even the smallest does not fit, the export stops with a message that says
 * what to change.
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

function draw(
  targetWidth: number,
  targetHeight: number,
  layers: DesignLayer[],
  images: (HTMLImageElement | null)[],
): string {
  const width = Math.max(240, targetWidth);
  const height = Math.max(240, targetHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export a print file.");
  ctx.clearRect(0, 0, width, height);
  layers.forEach((layer, index) => {
    ctx.save();
    ctx.translate(layer.x * width, layer.y * height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    if (layer.type === "text") {
      const px = Math.max(18, Math.round(height * 0.14 * layer.scale));
      ctx.font = `${px}px "${layer.font}", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
      if (isFlatText(fx)) {
        ctx.fillStyle = layer.color;
        ctx.fillText(layer.text, 0, 0, width * 0.92);
      } else {
        drawCurvedText(ctx, layer.text, fx, layer.color, px);
      }
    } else {
      const image = images[index];
      if (image) {
        const dw = width * 0.52 * layer.scale;
        const dh = dw * (image.height / Math.max(1, image.width));
        ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
      }
    }
    ctx.restore();
  });
  return canvas.toDataURL("image/png");
}

function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fx: ReturnType<typeof clampFx>,
  color: string,
  px: number,
) {
  const cells = arcLayout(text, fx);
  if (fx.outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, px * 0.08);
  } else {
    ctx.fillStyle = color;
  }
  for (const cell of cells) {
    ctx.save();
    ctx.translate(cell.along * px, cell.lift * px);
    ctx.rotate((cell.rotate * Math.PI) / 180);
    if (fx.outline) ctx.strokeText(cell.char, 0, 0);
    else ctx.fillText(cell.char, 0, 0);
    ctx.restore();
  }
}
