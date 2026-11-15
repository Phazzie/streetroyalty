/**
 * The drop card: a 4:5 poster of a look, made in the browser, for saving or sharing.
 * The text layout is pure so it can be tested; the drawing needs a canvas.
 */

export type DropCard = {
  image: string;
  name: string;
  pieces: string;
  verdict?: string;
};

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** Breaks a title into at most `maxLines` lines of at most `maxChars`, on word edges, ending in an ellipsis if cut. */
export function wrapTitle(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let used = 0;
  for (const word of words) {
    const piece = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    const next = line ? `${line} ${piece}` : piece;
    if (next.length <= maxChars) {
      line = next;
      used += 1;
      continue;
    }
    lines.push(line);
    line = piece;
    used += 1;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (used < words.length || lines.length > maxLines) {
    const last = lines[Math.min(lines.length, maxLines) - 1] ?? "";
    lines.length = Math.min(lines.length, maxLines);
    lines[lines.length - 1] =
      last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines;
}

/** A short name for a look that has not been named: its first few words. */
export function fallbackName(spoken: string): string {
  const words = spoken
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.slice(0, 3).join(" ") || "Untitled look";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The look could not be drawn."));
    image.src = src;
  });
}

const NIGHT = "#0b0614";
const LIME = "#d6ff3c";
const CREAM = "#f6f1ff";

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  const scale = width / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(2, 18.5);
  ctx.lineTo(5.4, 5.2);
  ctx.lineTo(10.6, 11.5);
  ctx.lineTo(16, 1);
  ctx.lineTo(21.4, 11.5);
  ctx.lineTo(26.6, 5.2);
  ctx.lineTo(30, 18.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(2, 19.6, 28, 2.4);
  ctx.restore();
}

export async function renderDropCard(card: DropCard): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot make the card.");
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load('italic 900 extra-condensed 120px "Archivo"').catch(() => undefined),
      document.fonts.load('40px "Archivo Black"').catch(() => undefined),
      document.fonts.load('500 34px "Outfit"').catch(() => undefined),
    ]);
  }
  const look = await loadImage(card.image);

  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // The look fills the card, cropped from the top so the face stays in.
  const scale = Math.max(CARD_WIDTH / look.naturalWidth, CARD_HEIGHT / look.naturalHeight);
  const width = look.naturalWidth * scale;
  const height = look.naturalHeight * scale;
  ctx.drawImage(
    look,
    (CARD_WIDTH - width) / 2,
    Math.min(0, (CARD_HEIGHT - height) * 0.2),
    width,
    height,
  );

  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, "rgba(11,6,20,0.82)");
  top.addColorStop(1, "rgba(11,6,20,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, CARD_WIDTH, 260);
  const bottom = ctx.createLinearGradient(0, CARD_HEIGHT - 640, 0, CARD_HEIGHT);
  bottom.addColorStop(0, "rgba(11,6,20,0)");
  bottom.addColorStop(0.55, "rgba(11,6,20,0.86)");
  bottom.addColorStop(1, "rgba(11,6,20,0.97)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, CARD_HEIGHT - 640, CARD_WIDTH, 640);

  const margin = 64;
  ctx.textBaseline = "alphabetic";

  // Wordmark.
  ctx.fillStyle = LIME;
  crown(ctx, margin, 62, 62);
  ctx.fillStyle = CREAM;
  ctx.font = 'italic 900 58px "Archivo", "Archivo Black", sans-serif';
  if ("fontStretch" in ctx)
    (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "extra-condensed";
  ctx.fillText("STREET ROYALTY", margin + 80, 106);

  // Name, from the bottom up.
  const lines = wrapTitle(card.name.toUpperCase(), 16, 2);
  const size = 168;
  ctx.font = `italic 900 ${size}px "Archivo", "Archivo Black", sans-serif`;
  let y = CARD_HEIGHT - 190 - (lines.length - 1) * size * 0.9;
  const nameTop = y - size * 0.8;
  for (const line of lines) {
    ctx.fillText(line, margin, y, CARD_WIDTH - margin * 2);
    y += size * 0.9;
  }

  if ("fontStretch" in ctx)
    (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "normal";

  if (card.verdict) {
    const verdict = card.verdict.toUpperCase().slice(0, 40);
    ctx.font = '30px "Archivo Black", sans-serif';
    const pad = 18;
    const boxWidth = Math.min(CARD_WIDTH - margin * 2, ctx.measureText(verdict).width + pad * 2);
    ctx.fillStyle = LIME;
    ctx.fillRect(margin, nameTop - 78, boxWidth, 56);
    ctx.fillStyle = NIGHT;
    ctx.fillText(verdict, margin + pad, nameTop - 39, boxWidth - pad * 2);
  }

  ctx.fillStyle = "rgba(246,241,255,0.82)";
  ctx.font = '500 34px "Outfit", sans-serif';
  const pieces = wrapTitle(card.pieces, 52, 2);
  let py = CARD_HEIGHT - 118;
  for (const line of pieces) {
    ctx.fillText(line, margin, py, CARD_WIDTH - margin * 2);
    py += 44;
  }

  ctx.strokeStyle = LIME;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, CARD_WIDTH - 6, CARD_HEIGHT - 6);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The card could not be saved."))),
      "image/jpeg",
      0.92,
    );
  });
}

/** Shares the card where the phone can, and saves it as a file everywhere else. */
export async function shareDropCard(blob: Blob, name: string): Promise<"shared" | "saved"> {
  const filename = `street-royalty-${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "look"
  }.jpg`;
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return "shared";
    } catch (error) {
      // Closing the share sheet is not a failure, and there is nothing to save in its place.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "saved";
}
