/**
 * Every typeface the studio sets. The first two come from Google Fonts with the rest of
 * the site; the others are served from this site (src/components/studio/studio-fonts.css).
 *
 * `width` is how wide a line sets against Archivo Black, measured in Chromium on
 * 2026-11-26 over a few sample lines. The print check and the drawn mockups use it to
 * guess a line's width without a browser; the print file and the studio canvas measure
 * the real thing.
 */
export type StudioFont = {
  name: string;
  /** Short word for the picker. */
  vibe: string;
  weight: number;
  width: number;
};

export const FONTS: readonly StudioFont[] = [
  { name: "Archivo Black", vibe: "Heavy", weight: 400, width: 1 },
  { name: "Anton", vibe: "Tall", weight: 400, width: 0.67 },
  { name: "Bebas Neue", vibe: "Clean", weight: 400, width: 0.57 },
  { name: "Pirata One", vibe: "Gothic", weight: 400, width: 0.59 },
  { name: "UnifrakturCook", vibe: "Old English", weight: 700, width: 0.77 },
  { name: "Permanent Marker", vibe: "Marker", weight: 400, width: 0.89 },
  { name: "Rock Salt", vibe: "Scrawl", weight: 400, width: 1.15 },
  { name: "Bungee", vibe: "Sign", weight: 400, width: 1.04 },
  { name: "Rubik Mono One", vibe: "Wide", weight: 400, width: 1.39 },
  { name: "Black Ops One", vibe: "Stencil", weight: 400, width: 0.96 },
  { name: "Monoton", vibe: "Neon", weight: 400, width: 1.07 },
  { name: "Shrikhand", vibe: "Script", weight: 400, width: 0.96 },
  { name: "Big Shoulders Display", vibe: "Chicago", weight: 900, width: 0.65 },
  { name: "Outfit", vibe: "Plain", weight: 400, width: 0.8 },
];

export const FONT_NAMES = FONTS.map((font) => font.name);

export function studioFont(name: string): StudioFont {
  return FONTS.find((font) => font.name === name) ?? FONTS[0]!;
}

/** The CSS font shorthand for a size in pixels. */
export function fontShorthand(name: string, px: number): string {
  const font = studioFont(name);
  return `${font.weight} ${px}px "${font.name}", "Archivo Black", sans-serif`;
}
