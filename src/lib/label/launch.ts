/**
 * The label's own launch pieces: Street Royalty's first drop, on the six real
 * Printful blanks the studio sells. Each piece is ordinary studio text, so it
 * prints, prices and remixes exactly like a piece anyone makes in the studio.
 *
 * The print files for these layers are rendered by the studio's own exporter
 * (`node scripts/label/render-launch.mjs`) and kept in ./prints. Change a piece
 * here, run that script, and commit both.
 */

export type LaunchLine = {
  text: string;
  color: string;
  x?: number;
  y: number;
  scale: number;
  rotation?: number;
  font?: "Archivo Black" | "Outfit";
  arc?: number;
  outline?: boolean;
  tracking?: number;
};

export type LaunchSpot = { placement: string; lines: LaunchLine[] };

export type LaunchPiece = {
  /** Stable key. A piece is made once per key and never again. */
  key: string;
  title: string;
  /** House blank id from src/lib/pod/house-blanks.ts. */
  blank: string;
  /** Colour code on that blank. */
  color: string;
  /** The first spot is the main one. */
  spots: LaunchSpot[];
};

export const LABEL_MAKER = {
  id: "label-street-royalty",
  handle: "streetroyalty",
  name: "Street Royalty",
  bio: "The label's own pieces. Crown never came off.",
} as const;

const LIME = "#d6ff3c";
const PINK = "#ff2d95";
const CREAM = "#f5ebdd";
const PLUM = "#2a1745";
const PEACH = "#ff9e7a";
const NIGHT = "#17101f";

export const LAUNCH_PIECES: readonly LaunchPiece[] = [
  {
    key: "crown-never-came-off",
    title: "Crown Never Came Off Hoodie",
    blank: "hoodie-pullover",
    color: "lavender",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "CROWN NEVER", color: PLUM, y: 0.36, scale: 1.05, arc: 28 },
          { text: "CAME OFF", color: PLUM, y: 0.58, scale: 1.25 },
        ],
      },
      {
        placement: "back",
        lines: [
          { text: "STREET", color: PLUM, y: 0.3, scale: 1.6, outline: true, tracking: 0.06 },
          { text: "ROYALTY", color: PLUM, y: 0.5, scale: 1.6 },
          { text: "just dressing it", color: PLUM, y: 0.68, scale: 0.6, font: "Outfit" },
        ],
      },
    ],
  },
  {
    key: "do-better-look-fly",
    title: "Do Better Look Fly Tee",
    blank: "tee-heavy",
    color: "black",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "DO BETTER", color: LIME, y: 0.3, scale: 1.35, rotation: -6 },
          { text: "look fly doing it", color: PINK, y: 0.47, scale: 0.75, rotation: -6, font: "Outfit" },
        ],
      },
    ],
  },
  {
    key: "soft-life-hard-lessons",
    title: "Soft Life Hard Lessons Hoodie",
    blank: "hoodie-pullover",
    color: "bone",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "SOFT LIFE", color: "#7c5cff", y: 0.38, scale: 1.3, tracking: 0.04 },
          { text: "HARD LESSONS", color: "#7c5cff", y: 0.58, scale: 1.25, outline: true },
        ],
      },
      {
        placement: "sleeve_left",
        lines: [{ text: "SR", color: "#7c5cff", y: 0.12, scale: 1.4 }],
      },
    ],
  },
  {
    key: "second-chances",
    title: "Second Chances Crew",
    blank: "crew-sweat",
    color: "agave",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "SECOND", color: PEACH, y: 0.28, scale: 1.5, outline: true },
          { text: "CHANCES", color: PEACH, y: 0.46, scale: 1.5 },
          { text: "FIRST CLASS", color: NIGHT, y: 0.64, scale: 0.7, tracking: 0.3 },
        ],
      },
    ],
  },
  {
    key: "clash-on-purpose",
    title: "Clash On Purpose Tee",
    blank: "tee-heavy",
    color: "chalky-mint",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "CLASH", color: PINK, y: 0.3, scale: 1.9, rotation: -10 },
          { text: "ON PURPOSE", color: "#3d3aff", y: 0.5, scale: 0.95, rotation: 8 },
        ],
      },
    ],
  },
  {
    key: "own-rules",
    title: "Own Rules Long Sleeve",
    blank: "longsleeve-block",
    color: "violet",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "NOT THEIR RULES", color: CREAM, y: 0.26, scale: 0.75, tracking: 0.18 },
          { text: "OWN", color: CREAM, y: 0.42, scale: 2.1 },
          { text: "RULES", color: CREAM, y: 0.62, scale: 2.1, outline: true },
        ],
      },
      {
        placement: "sleeve_right",
        lines: [{ text: "ROYALTY", color: CREAM, y: 0.5, scale: 0.8, rotation: 90 }],
      },
    ],
  },
  {
    key: "royal-leg",
    title: "Royal Leg Joggers",
    blank: "jogger-court",
    color: "black",
    spots: [
      {
        placement: "leg_front_left",
        // A leg is tall and thin, so the word runs down it one letter at a time.
        lines: [..."ROYAL"].map((letter, index) => ({
          text: letter,
          color: LIME,
          y: 0.18 + index * 0.16,
          scale: 0.95,
        })),
      },
    ],
  },
  {
    key: "paid-in-full",
    title: "Paid In Full Tote",
    blank: "tote-corner",
    color: "oyster",
    spots: [
      {
        placement: "front",
        lines: [
          { text: "PAID", color: NIGHT, y: 0.32, scale: 1.8 },
          { text: "IN FULL", color: NIGHT, y: 0.54, scale: 1.4, outline: true },
          { text: "street royalty", color: "#d2463c", y: 0.74, scale: 0.6, font: "Outfit" },
        ],
      },
    ],
  },
];

/** Studio layers for one spot. */
export function launchLayers(spot: LaunchSpot) {
  return spot.lines.map((line, index) => ({
    id: `${spot.placement}-${index}`,
    type: "text" as const,
    text: line.text,
    font: line.font ?? "Archivo Black",
    color: line.color,
    x: line.x ?? 0.5,
    y: line.y,
    scale: line.scale,
    rotation: line.rotation ?? 0,
    ...(line.arc ? { arc: line.arc } : {}),
    ...(line.outline ? { outline: true } : {}),
    ...(line.tracking ? { tracking: line.tracking } : {}),
  }));
}

/** File name of one spot's print file in ./prints. */
export function printName(piece: Pick<LaunchPiece, "key">, placement: string): string {
  return `${piece.key}.${placement}.png`;
}
