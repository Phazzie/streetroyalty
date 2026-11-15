/**
 * Colorway engine. Pure functions over RGB pixel data — the editor samples
 * the uploaded artwork on a canvas and hands the pixels here, so this file
 * never touches the DOM and every rule is testable.
 *
 * A colorway pairs a garment color with an ink color that survives on it
 * (contrast floor), so one click restyles garment + print together.
 */
import { contrastRatio } from "../contrast.ts";

export type Rgb = { r: number; g: number; b: number };

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return null;
  const value = Number.parseInt(raw, 16);
  if (Number.isNaN(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Dominant palette from raw RGBA pixels. Buckets colors into a coarse
 * 4-bit-per-channel grid, drops near-transparent pixels, and returns the
 * heaviest buckets averaged back to real colors, most dominant first.
 */
export function extractPalette(pixels: Uint8ClampedArray, count = 5): string[] {
  const buckets = new Map<string, { total: Rgb; hits: number }>();
  for (let index = 0; index + 3 < pixels.length; index += 16) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha < 128) continue;
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { total: { r: 0, g: 0, b: 0 }, hits: 0 };
    bucket.total.r += r;
    bucket.total.g += g;
    bucket.total.b += b;
    bucket.hits += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, Math.max(1, count))
    .map((bucket) =>
      rgbToHex({
        r: bucket.total.r / bucket.hits,
        g: bucket.total.g / bucket.hits,
        b: bucket.total.b / bucket.hits,
      }),
    );
}

export type Colorway = {
  name: string;
  garmentHex: string;
  inkHex: string;
  /** WCAG contrast of ink on garment. */
  contrast: number;
};

/** Minimum ink-on-garment contrast for a colorway to be offered at all. */
export const MIN_COLORWAY_CONTRAST = 3;

function pair(name: string, garmentHex: string, inkHex: string): Colorway | null {
  const contrast = contrastRatio(inkHex, garmentHex);
  if (contrast < MIN_COLORWAY_CONTRAST) return null;
  return { name, garmentHex, inkHex, contrast };
}

/**
 * Colorways built from the artwork's own palette: each dominant color takes
 * a turn as the garment, and the strongest contrasting palette color (or a
 * house neutral) becomes the ink.
 */
export function colorwaysFromPalette(palette: string[], namePrefix = "From your art"): Colorway[] {
  const neutrals = ["#141414", "#f6f1ff", "#efe6d6"];
  const candidates = [...new Set([...palette, ...neutrals])];
  const ways: Colorway[] = [];
  for (const garment of palette) {
    let best: Colorway | null = null;
    for (const ink of candidates) {
      if (ink.toLowerCase() === garment.toLowerCase()) continue;
      const candidate = pair(`${namePrefix} ${ways.length + 1}`, garment, ink);
      if (candidate && (!best || candidate.contrast > best.contrast)) best = candidate;
    }
    if (best) ways.push(best);
  }
  return ways;
}

/** Curated street palettes — garment/ink pairs that already slap. */
export const CURATED_COLORWAYS: Colorway[] = [
  { name: "Boardroom raid", garmentHex: "#141414", inkHex: "#d6ff3c", contrast: contrastRatio("#d6ff3c", "#141414") },
  { name: "Corner store", garmentHex: "#141414", inkHex: "#ff2d95", contrast: contrastRatio("#ff2d95", "#141414") },
  { name: "Clean money", garmentHex: "#efe6d6", inkHex: "#141414", contrast: contrastRatio("#141414", "#efe6d6") },
  { name: "Night court", garmentHex: "#2f5bff", inkHex: "#f6f1ff", contrast: contrastRatio("#f6f1ff", "#2f5bff") },
  { name: "Safety first, never", garmentHex: "#141414", inkHex: "#ff6a00", contrast: contrastRatio("#ff6a00", "#141414") },
  { name: "Ultraviolet block", garmentHex: "#3b1470", inkHex: "#3df0ff", contrast: contrastRatio("#3df0ff", "#3b1470") },
].filter((way) => way.contrast >= MIN_COLORWAY_CONTRAST);

/** Nearest catalog color (by RGB distance) to a hex — maps a colorway onto a real blank. */
export function nearestColor<T extends { hex: string }>(hex: string, options: T[]): T | null {
  const target = hexToRgb(hex);
  if (!target || options.length === 0) return null;
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const rgb = hexToRgb(option.hex);
    if (!rgb) continue;
    const distance = (rgb.r - target.r) ** 2 + (rgb.g - target.g) ** 2 + (rgb.b - target.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option;
    }
  }
  return best;
}
