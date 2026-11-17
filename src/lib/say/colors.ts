/** Colour words people really say, and how far apart two colours look. Pure. */

/** Longest phrases are matched first, so "hot pink" never reads as "pink". */
export const COLOR_WORDS: Record<string, string> = {
  // The house colours (DESIGN.md).
  "acid lime": "#d6ff3c",
  lime: "#d6ff3c",
  "hot pink": "#ff2d95",
  "soft lilac": "#b9a3ee",
  lilac: "#7c5cff",
  "deep mint": "#12343a",
  "soft mint": "#a5dccb",
  mint: "#a5dccb",
  night: "#0b0614",
  paper: "#f5ebdd",
  // Everyday names.
  black: "#141414",
  white: "#ffffff",
  "off white": "#f5ebdd",
  cream: "#f5ebdd",
  bone: "#efe6d6",
  "blood red": "#8a0303",
  "dark red": "#8a0303",
  "fire red": "#ff2b1c",
  red: "#e11d2e",
  "royal blue": "#2f5bff",
  royal: "#2f5bff",
  "navy blue": "#14213d",
  navy: "#14213d",
  "sky blue": "#7cc4ff",
  "baby blue": "#a9d6ff",
  "light blue": "#7cc4ff",
  "dark blue": "#14213d",
  blue: "#2563eb",
  "money green": "#1f6f3d",
  "forest green": "#14532d",
  "dark green": "#14532d",
  "neon green": "#39ff14",
  "lime green": "#d6ff3c",
  olive: "#6b7a2a",
  green: "#1faa4b",
  "baby pink": "#ffc1dc",
  "light pink": "#ffc1dc",
  pink: "#ff5fa2",
  gold: "#d4af37",
  yellow: "#ffd60a",
  orange: "#ff6a00",
  peach: "#ffb38a",
  lavender: "#b9a3ee",
  violet: "#c084fc",
  purple: "#7e22ce",
  burgundy: "#6d1027",
  maroon: "#6d1027",
  wine: "#6d1027",
  brown: "#6b4423",
  tan: "#c9a27a",
  charcoal: "#36363b",
  silver: "#c0c0c0",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  turquoise: "#2dd4bf",
  teal: "#0f9d9a",
  cyan: "#3df0ff",
};

/** The names used when a colour is read back. One plain word per look. */
const READ_BACK: [string, string][] = [
  ["black", "#141414"],
  ["white", "#ffffff"],
  ["bone", "#efe6d6"],
  ["cream", "#f5ebdd"],
  ["lime", "#d6ff3c"],
  ["hot pink", "#ff2d95"],
  ["pink", "#ff5fa2"],
  ["baby pink", "#ffc1dc"],
  ["lilac", "#7c5cff"],
  ["lavender", "#b9a3ee"],
  ["mint", "#a5dccb"],
  ["deep mint", "#12343a"],
  ["red", "#e11d2e"],
  ["blood red", "#8a0303"],
  ["royal blue", "#2f5bff"],
  ["blue", "#2563eb"],
  ["navy", "#14213d"],
  ["sky blue", "#7cc4ff"],
  ["money green", "#1f6f3d"],
  ["forest green", "#14532d"],
  ["neon green", "#39ff14"],
  ["green", "#1faa4b"],
  ["olive", "#6b7a2a"],
  ["gold", "#d4af37"],
  ["yellow", "#ffd60a"],
  ["orange", "#ff6a00"],
  ["peach", "#ffb38a"],
  ["violet", "#c084fc"],
  ["purple", "#7e22ce"],
  ["burgundy", "#6d1027"],
  ["brown", "#6b4423"],
  ["tan", "#c9a27a"],
  ["charcoal", "#36363b"],
  ["silver", "#c0c0c0"],
  ["grey", "#8a8a8a"],
  ["teal", "#0f9d9a"],
  ["turquoise", "#2dd4bf"],
  ["cyan", "#3df0ff"],
  ["night", "#0b0614"],
];

const HEX = /^#[0-9a-f]{6}$/i;

const WORDS_LONGEST_FIRST = Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length);

/** Source for a regex that matches any colour phrase. */
export const COLOR_PATTERN = WORDS_LONGEST_FIRST.map((word) => word.replace(/ /g, "[ -]?")).join(
  "|",
);

export type ColorHit = { index: number; length: number; word: string; hex: string };

export function findColors(text: string): ColorHit[] {
  const hits: ColorHit[] = [];
  const pattern = new RegExp(`\\b(?:${COLOR_PATTERN})\\b`, "gi");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const word = match[0].toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
    const hex = COLOR_WORDS[word] ?? COLOR_WORDS[word.replace(/ /g, "")] ?? spaced(word);
    if (hex) hits.push({ index: match.index, length: match[0].length, word, hex });
  }
  return hits;
}

/** "hotpink" said as one word still finds "hot pink". */
function spaced(word: string): string | undefined {
  const squashed = word.replace(/ /g, "");
  const key = WORDS_LONGEST_FIRST.find((item) => item.replace(/ /g, "") === squashed);
  return key ? COLOR_WORDS[key] : undefined;
}

function channels(hex: string): [number, number, number] {
  const safe = HEX.test(hex) ? hex : "#000000";
  return [
    parseInt(safe.slice(1, 3), 16),
    parseInt(safe.slice(3, 5), 16),
    parseInt(safe.slice(5, 7), 16),
  ];
}

function linear(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** How different two colours look to a person (CIE76 in Lab space). 0 is the same; about 2 is just visible. */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The option that looks most like the wanted colour. */
export function nearestColor<T extends { hex: string }>(
  wanted: string,
  options: readonly T[],
): { option: T; distance: number } | null {
  let best: { option: T; distance: number } | null = null;
  for (const option of options) {
    const distance = colorDistance(wanted, option.hex);
    if (!best || distance < best.distance) best = { option, distance };
  }
  return best;
}

/** A plain name for any hex, for reading a colour back. */
export function colorName(hex: string): string {
  const lower = hex.toLowerCase();
  const exact = READ_BACK.find(([, value]) => value === lower);
  if (exact) return exact[0];
  const near = nearestColor(
    lower,
    READ_BACK.map(([name, value]) => ({ name, hex: value })),
  );
  return near ? near.option.name : "black";
}

/** A colour that shows on the given ground. */
export function contrastInk(ground: string): string {
  return luminance(ground) > 0.45 ? INK_DARK : INK_LIGHT;
}

export const INK_DARK = "#141414";
export const INK_LIGHT = "#f6f1ff";

/** Mix two colours. 0 gives the first, 1 the second. */
export function mix(a: string, b: string, amount: number): string {
  const from = channels(a);
  const to = channels(b);
  const t = Math.min(1, Math.max(0, amount));
  return `#${from
    .map((value, index) =>
      Math.round(value + ((to[index] ?? 0) - value) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
