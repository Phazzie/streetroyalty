/** Draw the said lines as a see-through picture, for the road into the studio without an account. */
import type { SayIntent, SayLine, SaySize } from "./parse.ts";

export const ART_WIDTH = 1200;
export const ART_HEIGHT = 900;
/** The studio's hand-off slot takes a data URL up to this long. */
export const MAX_ART_CHARS = 1_300_000;

export type ArtRow = {
  text: string;
  color: string;
  fontPx: number;
  x: number;
  y: number;
  rotation: number;
};

const HEIGHT_SHARE: Record<SaySize, number> = { small: 0.09, medium: 0.14, big: 0.2, huge: 0.28 };

/** Where each line goes on the picture. `measure` returns a line's width in pixels at a font size. */
export function layoutArt(
  lines: readonly SayLine[],
  width: number,
  height: number,
  measure: (text: string, fontPx: number) => number,
): ArtRow[] {
  const rows = lines.slice(0, 8).map((line) => {
    let fontPx = height * HEIGHT_SHARE[line.size];
    // A tilted line swings wider than it is long, so it gets less room.
    const room = width * (line.tilt === 0 ? 0.94 : 0.78);
    const wide = measure(line.text, fontPx);
    if (wide > room && wide > 0) fontPx *= room / wide;
    return { line, fontPx: Math.max(12, fontPx) };
  });
  const tall = rows.reduce((sum, row) => sum + row.fontPx * 1.16, 0);
  const squeeze = tall > height * 0.92 ? (height * 0.92) / tall : 1;
  let cursor = (height - tall * squeeze) / 2;
  return rows.map(({ line, fontPx }) => {
    const size = fontPx * squeeze;
    const y = cursor + (size * 1.16) / 2;
    cursor += size * 1.16;
    return {
      text: line.text,
      color: line.color,
      fontPx: Math.round(size * 100) / 100,
      x: width / 2,
      y: Math.round(y * 100) / 100,
      rotation: line.tilt,
    };
  });
}

function fontFor(font: string, px: number): string {
  return font === "Outfit"
    ? `700 ${px}px "Outfit", "Avenir Next", "Segoe UI", sans-serif`
    : `${px}px "Archivo Black", "Arial Black", sans-serif`;
}

/** Browser only. A PNG data URL with a clear background, always under the hand-off limit. */
export async function renderArt(intent: SayIntent): Promise<string> {
  try {
    await Promise.all([document.fonts.load(fontFor(intent.font, 100)), document.fonts.ready]);
  } catch {
    /* The fallback font still prints the words. */
  }
  for (const shrink of [1, 0.7, 0.5, 0.35]) {
    const width = Math.round(ART_WIDTH * shrink);
    const height = Math.round(ART_HEIGHT * shrink);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not draw the words.");
    context.textAlign = "center";
    context.textBaseline = "middle";
    const rows = layoutArt(intent.lines, width, height, (text, px) => {
      context.font = fontFor(intent.font, px);
      return context.measureText(text).width;
    });
    for (const row of rows) {
      context.save();
      context.translate(row.x, row.y);
      context.rotate((row.rotation * Math.PI) / 180);
      context.font = fontFor(intent.font, row.fontPx);
      context.fillStyle = row.color;
      context.fillText(row.text, 0, 0);
      context.restore();
    }
    const url = canvas.toDataURL("image/png");
    if (url.length < MAX_ART_CHARS) return url;
  }
  throw new Error("Those words made a picture too heavy to carry over. Try fewer lines.");
}
