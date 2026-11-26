import { MAX_ART_SRC } from "@/lib/studio/garments";

/** Longest side a panel picture is kept at. Big enough for a 40 inch sheet to look clean at arm's length. */
const LONG_EDGE = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That picture did not load. Try a PNG or JPEG."));
    image.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That picture did not load. Try a PNG or JPEG."));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns a picked file into a panel picture: scaled to a sensible size and
 * saved as JPEG so a few of them fit in one saved piece.
 */
export async function pictureForPanel(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Use a PNG, JPEG or WebP picture.");
  }
  const image = await loadImage(await readFile(file));
  const scale = Math.min(1, LONG_EDGE / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot fit that picture.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.75, 0.62, 0.5]) {
    const src = canvas.toDataURL("image/jpeg", quality);
    if (src.length <= MAX_ART_SRC * 0.6) return src;
  }
  throw new Error("That picture is too detailed to fit. Try a smaller one.");
}
