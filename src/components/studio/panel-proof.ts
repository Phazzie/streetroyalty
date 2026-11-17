import type { Paint } from "@/lib/studio/garments";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw that panel."));
    image.src = src;
  });
}

/**
 * A studio proof of one panel. The pixel size is the studio proof size, not
 * a confirmed Printful template, unless the caller passes a confirmed size.
 */
export async function renderPanelProof(
  width: number,
  height: number,
  paint: Paint,
  title: string,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export a panel file.");
  if (paint.type === "solid") {
    ctx.fillStyle = paint.hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (paint.type === "pattern") {
    const step = Math.max(8, Math.round(canvas.width / 12));
    ctx.fillStyle = paint.hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = paint.accent;
    if (paint.pattern === "checker") {
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          if ((x / step + y / step) % 2 === 0) ctx.fillRect(x, y, step, step);
        }
      }
    } else {
      for (let x = 0; x < canvas.width; x += step * 2) ctx.fillRect(x, 0, step, canvas.height);
    }
  } else {
    const image = await loadImage(paint.src);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, canvas.height - 28, canvas.width, 28);
  ctx.fillStyle = "#f6f1ff";
  ctx.font = "14px sans-serif";
  ctx.fillText(title.slice(0, 40), 8, canvas.height - 9);
  return canvas.toDataURL("image/png");
}
