/**
 * Colour maths for the clash score. sRGB hex in, OKLCH out, and back again. No dependencies.
 * OKLCH is used because equal steps in it look like equal steps to an eye, which hex does not.
 */

export type Oklch = {
  /** Lightness, 0 (black) to 1 (white). */
  l: number;
  /** Chroma, 0 (grey) to about 0.32 (the loudest a screen can show). */
  c: number;
  /** Hue in degrees, 0 to 360. Meaningless when chroma is near zero. */
  h: number;
};

/** Below this chroma a colour reads as a grey, whatever its hue says. */
export const NEUTRAL_CHROMA = 0.035;

/** "#abc", "abc", "#AABBCC" and "aabbcc" all become "#aabbcc". Anything else is null. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

function toLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function toGamma(linear: number): number {
  const v = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

export function hexToOklch(input: unknown): Oklch | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: lightness, c, h };
}

function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005);
}

/** Back to hex. A colour no screen can show keeps its hue and lightness and gives up chroma. */
export function oklchToHex(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  const h = ((color.h % 360) + 360) % 360;
  let c = Math.max(0, color.c);
  let rgb = oklchToLinear(l, c, h);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = c;
    for (let i = 0; i < 18; i += 1) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinear(l, mid, h))) low = mid;
      else high = mid;
    }
    c = low;
    rgb = oklchToLinear(l, c, h);
  }
  return `#${rgb.map((v) => toGamma(v).toString(16).padStart(2, "0")).join("")}`;
}

/** The shortest way round the wheel between two hues, 0 to 180. */
export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Plain names, the kind a person says out loud in a shop. */
const NAMES: ReadonlyArray<readonly [string, string]> = [
  ["black", "#0d0d10"],
  ["charcoal", "#3a3a40"],
  ["grey", "#8a8a8f"],
  ["silver", "#c4c4c8"],
  ["white", "#ffffff"],
  ["cream", "#f6ecd9"],
  ["bone", "#e3d8c3"],
  ["sand", "#d4b98c"],
  ["tan", "#b98d5c"],
  ["brown", "#7a4a26"],
  ["chocolate", "#42230f"],
  ["red", "#e3202a"],
  ["brick", "#a8402c"],
  ["burgundy", "#6e1429"],
  ["pink", "#ff8fc0"],
  ["hot pink", "#ff2d95"],
  ["blush", "#f6c9d0"],
  ["peach", "#f9c4a6"],
  ["coral", "#ff6f5e"],
  ["orange", "#ff6a00"],
  ["rust", "#b4521c"],
  ["amber", "#ffb020"],
  ["gold", "#d4a520"],
  ["yellow", "#ffe433"],
  ["butter", "#fbeea0"],
  ["lime", "#c8f52e"],
  ["olive", "#73782a"],
  ["green", "#2faa4a"],
  ["forest", "#1d4d2f"],
  ["mint", "#a5dccb"],
  ["sage", "#a3b59a"],
  ["teal", "#128a85"],
  ["aqua", "#3df0ff"],
  ["sky", "#8fc8ff"],
  ["blue", "#3d7eff"],
  ["royal blue", "#2440c8"],
  ["navy", "#141f52"],
  ["lilac", "#b9a3ee"],
  ["lavender", "#d9cdf7"],
  ["purple", "#7c3fd0"],
  ["violet", "#7c5cff"],
  ["plum", "#56204f"],
  ["magenta", "#d61fc4"],
];

type Lab = { l: number; a: number; b: number };

function toLab(color: Oklch): Lab {
  const rad = (color.h * Math.PI) / 180;
  return { l: color.l, a: color.c * Math.cos(rad), b: color.c * Math.sin(rad) };
}

const NAMED: ReadonlyArray<{ name: string; lab: Lab }> = NAMES.map(([name, hex]) => {
  const color = hexToOklch(hex);
  return { name, lab: toLab(color ?? { l: 0, c: 0, h: 0 }) };
});

/** The nearest plain name for a hex. Something that is not a colour is called "no colour". */
export function colorName(input: unknown): string {
  const color = hexToOklch(input);
  if (!color) return "no colour";
  const lab = toLab(color);
  let best = "grey";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of NAMED) {
    // Hue and chroma count for more than lightness: a dark orange is still an orange to most people.
    const distance =
      0.7 * (entry.lab.l - lab.l) ** 2 + (entry.lab.a - lab.a) ** 2 + (entry.lab.b - lab.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.name;
    }
  }
  return best;
}

/** A hue is warm from magenta-pink round through red and orange to yellow, and cold from green to violet. */
export function temperature(color: Oklch): "warm" | "cold" | "neutral" {
  if (color.c < NEUTRAL_CHROMA) return "neutral";
  if (color.h >= 345 || color.h < 112) return "warm";
  if (color.h >= 140 && color.h < 305) return "cold";
  return "neutral";
}
