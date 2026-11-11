import type { DesignLayer, PrintArea } from "@/lib/pod/types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw that artwork."));
    image.src = src;
  });
}

/** Flatten layers into a transparent PNG sized to the print area. */
export async function renderPrintFile(area: PrintArea, layers: DesignLayer[]): Promise<string> {
  const dpi = area.dpi || 150;
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(area.widthIn * dpi, area.heightIn * dpi));
  const width = Math.max(240, Math.round(area.widthIn * dpi * scale));
  const height = Math.max(240, Math.round(area.heightIn * dpi * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export a print file.");
  if (document.fonts?.load) {
    await document.fonts.load(`40px "Archivo Black"`).catch(() => undefined);
    await document.fonts.load(`40px "Outfit"`).catch(() => undefined);
  }
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
      const image = await loadImage(layer.src);
      const dw = width * 0.52 * layer.scale;
      const dh = dw * (image.height / Math.max(1, image.width));
      ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    }
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}
