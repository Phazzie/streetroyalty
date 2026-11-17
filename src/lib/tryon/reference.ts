import { MAX_IMAGE_CHARS, REFERENCE_SIZE, containBox } from "./words.ts";

/**
 * Browser only. Turns a piece's mockup into the clothing reference the picture
 * maker reads: one flat JPEG, whatever the mockup started as.
 *
 * A sandbox mockup is an SVG data URL and a live one is an https picture from
 * the printer. The printer's pictures may not allow other sites to read their
 * pixels. When that happens the canvas is "tainted" and the browser refuses to
 * hand the picture back, so this returns null and the try-on goes ahead on
 * words alone and says so.
 */

function open(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Asking for the picture this way means a server that does not allow reading fails here, cleanly, instead of tainting later.
    if (!src.startsWith("data:")) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export async function mockupReference(mockupUrl: string | null): Promise<string | null> {
  if (!mockupUrl) return null;
  if (!mockupUrl.startsWith("data:image/") && !mockupUrl.startsWith("https://")) return null;
  const image = await open(mockupUrl);
  if (!image) return null;
  const canvas = document.createElement("canvas");
  canvas.width = REFERENCE_SIZE.width;
  canvas.height = REFERENCE_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // A pale ground, so a dark garment and a cut-out mockup both read.
  ctx.fillStyle = "#ece8f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const box = containBox({ width: image.naturalWidth, height: image.naturalHeight });
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    for (const quality of [0.86, 0.7, 0.5]) {
      const jpeg = canvas.toDataURL("image/jpeg", quality);
      if (jpeg.startsWith("data:image/jpeg") && jpeg.length <= MAX_IMAGE_CHARS) return jpeg;
    }
    return null;
  } catch {
    // SecurityError: the canvas was tainted by a picture this page may not read.
    return null;
  }
}
