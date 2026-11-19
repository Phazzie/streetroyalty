import { colorName, normalizeHex } from "./color";

/** The three colours the clash machine rolls. */
export type Colorway = { body: string; panel: string; piping: string };

export const REEL_KEYS = ["body", "panel", "piping"] as const;
export type ReelKey = (typeof REEL_KEYS)[number];

/** The label's first two sweatsuits. */
export const PRESETS: ReadonlyArray<{ id: string; name: string; colors: Colorway }> = [
  { id: "lilac", name: "Lilac", colors: { body: "#b9a3ee", panel: "#f6ecd9", piping: "#ff8a3d" } },
  { id: "mint", name: "Mint", colors: { body: "#a5dccb", panel: "#f9c4a6", piping: "#3d5fd0" } },
];

export const DEFAULT_COLORWAY: Colorway = { body: "#b9a3ee", panel: "#f6ecd9", piping: "#ff8a3d" };

/** Every colour on the reels. Garment colours, so lime is allowed here: it is cloth, not a button. */
export const REEL_COLORS: readonly string[] = [
  "#b9a3ee",
  "#f6ecd9",
  "#ff8a3d",
  "#a5dccb",
  "#f9c4a6",
  "#3d5fd0",
  "#ff2d95",
  "#c8f52e",
  "#0d0d10",
  "#ffffff",
  "#e3202a",
  "#ffe433",
  "#2faa4a",
  "#128a85",
  "#7c3fd0",
  "#7a4a26",
  "#8a8a8f",
  "#3df0ff",
  "#6e1429",
  "#73782a",
  "#141f52",
  "#ff6f5e",
];

/**
 * "b9a3ee-f6ecd9-ff8a3d". One value with dashes, so a link stays short and a colour made only of
 * digits is never mistaken for a number on the way through the address bar.
 */
export function encodeColorway(colors: Colorway): string {
  return REEL_KEYS.map((key) => (normalizeHex(colors[key]) ?? "#000000").slice(1)).join("-");
}

export function decodeColorway(value: unknown): Colorway | null {
  if (typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [body, panel, piping] = parts.map((part) => normalizeHex(part));
  if (!body || !panel || !piping) return null;
  return { body, panel, piping };
}

export function paletteOf(colors: Colorway): string[] {
  return REEL_KEYS.map((key) => colors[key]);
}

/** "lilac, cream and orange". */
export function describeColorway(colors: Colorway): string {
  const [body, panel, piping] = paletteOf(colors).map((hex) => colorName(hex));
  return `${body}, ${panel} and ${piping}`;
}

export const KEPT_KEY = "sr:clash:kept:v1";
export const KEPT_LIMIT = 24;

/** Reads the kept list out of whatever localStorage handed back. Bad entries are dropped. */
export function parseKept(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const entry of value) {
      const colors = decodeColorway(entry);
      if (!colors) continue;
      const code = encodeColorway(colors);
      if (!out.includes(code)) out.push(code);
    }
    return out.slice(0, KEPT_LIMIT);
  } catch {
    return [];
  }
}

/** Newest first, no repeats, capped. */
export function addKept(list: readonly string[], colors: Colorway): string[] {
  const code = encodeColorway(colors);
  return [code, ...list.filter((entry) => entry !== code)].slice(0, KEPT_LIMIT);
}

export function removeKept(list: readonly string[], code: string): string[] {
  return list.filter((entry) => entry !== code);
}
