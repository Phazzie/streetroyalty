/**
 * The pure half of the pattern engine: ids, the spec, the seeded generator,
 * colour maths and the URL form. Nothing here touches a canvas, so it runs in node.
 */

export const PATTERN_IDS = [
  "chain-link",
  "barbed-wire",
  "bandana",
  "flames",
  "checker",
  "warp-checker",
  "tiger",
  "crowns",
  "drip",
  "camo",
  "halftone",
  "razor",
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

/** scale 1 is the default tile size. Colours are #rrggbb, slot 0 is the ground. Rotation is in degrees. */
export type PatternSpec = {
  id: PatternId;
  seed: number;
  colors: string[];
  scale: number;
  rotation?: number;
};

export type PatternInfo = {
  id: PatternId;
  name: string;
  colorSlots: number;
  defaultColors: string[];
};

export const PATTERNS: PatternInfo[] = [
  {
    id: "chain-link",
    name: "Chain link",
    colorSlots: 3,
    defaultColors: ["#12343a", "#c9d3dc", "#ff6a00"],
  },
  {
    id: "barbed-wire",
    name: "Barbed wire",
    colorSlots: 3,
    defaultColors: ["#f5ebdd", "#17101f", "#ff2d95"],
  },
  {
    id: "bandana",
    name: "Bandana",
    colorSlots: 3,
    defaultColors: ["#b3121d", "#fffaf2", "#17101f"],
  },
  {
    id: "flames",
    name: "Flames",
    colorSlots: 4,
    defaultColors: ["#0b0614", "#ff2d1f", "#ff8a00", "#ffe14a"],
  },
  {
    id: "checker",
    name: "Checker",
    colorSlots: 3,
    defaultColors: ["#f5ebdd", "#17101f", "#7c5cff"],
  },
  {
    id: "warp-checker",
    name: "Warped checker",
    colorSlots: 2,
    defaultColors: ["#b9a3ee", "#17101f"],
  },
  {
    id: "tiger",
    name: "Tiger stripe",
    colorSlots: 3,
    defaultColors: ["#ff8a00", "#17101f", "#ffd9a0"],
  },
  {
    id: "crowns",
    name: "Crown repeat",
    colorSlots: 3,
    defaultColors: ["#7c5cff", "#f5ebdd", "#ff6a00"],
  },
  {
    id: "drip",
    name: "Paint drip",
    colorSlots: 3,
    defaultColors: ["#a5dccb", "#ff2d95", "#3d7eff"],
  },
  {
    id: "camo",
    name: "Camo",
    colorSlots: 4,
    defaultColors: ["#5b6b3a", "#2f3b22", "#a89a6a", "#17101f"],
  },
  {
    id: "halftone",
    name: "Halftone",
    colorSlots: 3,
    defaultColors: ["#ffe14a", "#17101f", "#ff2d95"],
  },
  {
    id: "razor",
    name: "Razor zigzag",
    colorSlots: 4,
    defaultColors: ["#17101f", "#f5ebdd", "#3d7eff", "#ff6a00"],
  },
];

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;
/** Pixel size of one tile at scale 1 when the caller does not say otherwise. */
export const DEFAULT_TILE_PX = 256;

export function patternInfo(id: PatternId): PatternInfo {
  return PATTERNS.find((pattern) => pattern.id === id) ?? PATTERNS[0]!;
}

export function isPatternId(value: unknown): value is PatternId {
  return typeof value === "string" && (PATTERN_IDS as readonly string[]).includes(value);
}

/** A small fast seeded generator. Same seed, same numbers, on every machine. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a seed with whole numbers into a new seed, for values that must repeat on a lattice. */
export function hashSeed(seed: number, ...parts: number[]): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (const part of parts) {
    hash = Math.imul(hash ^ (part | 0), 0x85ebca6b) >>> 0;
    hash = (hash ^ (hash >>> 13)) >>> 0;
    hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
    hash = (hash ^ (hash >>> 16)) >>> 0;
  }
  return hash >>> 0;
}

/** One number from 0 up to 1 for a lattice point. */
export function hashUnit(seed: number, ...parts: number[]): number {
  return hashSeed(seed, ...parts) / 4294967296;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Remainder that is never negative. */
export function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export type Rgb = [number, number, number];

/** Reads #rgb or #rrggbb, with or without the hash. Anything else is null. */
export function parseHex(text: unknown): Rgb | null {
  if (typeof text !== "string") return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!match) return null;
  const digits = match[1]!;
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Lower-case #rrggbb, or null when the text is not a colour. */
export function normalizeHex(text: unknown): string | null {
  const rgb = parseHex(text);
  return rgb ? toHex(rgb) : null;
}

/** Blend two colours. 0 is all of the first, 1 is all of the second. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = parseHex(from) ?? [0, 0, 0];
  const b = parseHex(to) ?? [0, 0, 0];
  const t = clamp(amount, 0, 1);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** 0 for black, 1 for white, weighted the way the eye sees it. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = mod(hue, 360) / 60;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const base = l - chroma / 2;
  const [r, g, b] =
    h < 1
      ? [chroma, x, 0]
      : h < 2
        ? [x, chroma, 0]
        : h < 3
          ? [0, chroma, x]
          : h < 4
            ? [0, x, chroma]
            : h < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return toHex([(r + base) * 255, (g + base) * 255, (b + base) * 255]);
}

/**
 * Loud colours that fight each other: hues thrown far apart, full saturation,
 * and light against dark so every slot still reads.
 */
export function clashColors(seed: number, count: number): string[] {
  const random = mulberry32(seed);
  const start = random() * 360;
  const jump = 140 + random() * 80;
  const darkFirst = random() < 0.5;
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const hue = start + index * jump + (random() - 0.5) * 30;
    const dark = (index % 2 === 0) === darkFirst;
    const lightness = dark ? 0.3 + random() * 0.14 : 0.58 + random() * 0.14;
    return hslToHex(hue, 0.92 + random() * 0.08, lightness);
  });
}

/** The colours a pattern will really draw with: bad or missing slots fall back to its defaults. */
export function resolveColors(id: PatternId, colors: readonly unknown[] | undefined): string[] {
  const info = patternInfo(id);
  return info.defaultColors.map((fallback, slot) => normalizeHex(colors?.[slot]) ?? fallback);
}

/** Carry colours over to a pattern with a different number of slots, repeating them when it needs more. */
export function fitColors(id: PatternId, colors: readonly string[]): string[] {
  const info = patternInfo(id);
  const clean = colors
    .map((color) => normalizeHex(color))
    .filter((color): color is string => color !== null);
  if (clean.length === 0) return [...info.defaultColors];
  return info.defaultColors.map((_, slot) => clean[slot % clean.length]!);
}

export function defaultSpec(id: PatternId = "chain-link", seed = 1): PatternSpec {
  return {
    id,
    seed: seed >>> 0,
    colors: [...patternInfo(id).defaultColors],
    scale: 1,
    rotation: 0,
  };
}

/** Turn anything into a spec that is safe to draw, or null when it names no pattern. */
export function normalizeSpec(input: unknown): PatternSpec | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!isPatternId(raw.id)) return null;
  const seed = Number(raw.seed);
  const scale = Number(raw.scale);
  const rotation = Number(raw.rotation ?? 0);
  return {
    id: raw.id,
    seed: Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) >>> 0 : 0,
    colors: resolveColors(raw.id, Array.isArray(raw.colors) ? raw.colors : undefined),
    scale: Number.isFinite(scale) && scale > 0 ? clamp(scale, MIN_SCALE, MAX_SCALE) : 1,
    rotation: Number.isFinite(rotation) ? mod(Math.round(rotation), 360) : 0,
  };
}

/**
 * A spec as short text that is safe in a URL: letters, digits, dots and dashes.
 * id.seed.colours.scale.rotation, for example flames.9ix.0b0614-ff2d1f-ff8a00-ffe14a.100.0
 */
export function encodeSpec(spec: PatternSpec): string {
  const clean = normalizeSpec(spec) ?? defaultSpec();
  return [
    clean.id,
    clean.seed.toString(36),
    clean.colors.map((color) => color.slice(1)).join("-"),
    Math.round(clean.scale * 100).toString(),
    Math.round(clean.rotation ?? 0).toString(),
  ].join(".");
}

export function decodeSpec(text: unknown): PatternSpec | null {
  if (typeof text !== "string" || text.length === 0 || text.length > 200) return null;
  const parts = text.trim().split(".");
  if (parts.length < 2 || parts.length > 5) return null;
  const [id, seedText = "", colorText = "", scaleText = "100", rotationText = "0"] = parts;
  if (!isPatternId(id)) return null;
  if (!/^[0-9a-z]{1,7}$/.test(seedText)) return null;
  if (!/^\d{1,4}$/.test(scaleText) || !/^\d{1,3}$/.test(rotationText)) return null;
  const seed = Number.parseInt(seedText, 36);
  if (!Number.isFinite(seed) || seed > 0xffffffff) return null;
  const colors = colorText === "" ? [] : colorText.split("-");
  if (colors.some((color) => !/^[0-9a-f]{6}$/i.test(color))) return null;
  return normalizeSpec({
    id,
    seed,
    colors: colors.map((color) => `#${color}`),
    scale: Number(scaleText) / 100,
    rotation: Number(rotationText),
  });
}
