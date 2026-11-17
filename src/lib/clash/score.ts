import {
  colorName,
  hexToOklch,
  hueGap,
  NEUTRAL_CHROMA,
  normalizeHex,
  oklchToHex,
  temperature,
  type Oklch,
} from "./color";

/**
 * The clash score. It is the opposite of a style checker: it measures how hard a set of colours
 * fights and says so with some pride. A low score is a quiet look, never a bad one.
 */

export type ClashLabel = "Quiet" | "Smooth" | "Loud" | "Clashing" | "Riot";

export type ClashResult = {
  /** 0 (one family, or all neutrals) to 100 (every colour shouting over the others). */
  score: number;
  label: ClashLabel;
  /** Short plain phrases about why, loudest fight first. Never a correction. */
  reasons: string[];
};

export function clashLabel(score: number): ClashLabel {
  if (score >= 80) return "Riot";
  if (score >= 60) return "Clashing";
  if (score >= 35) return "Loud";
  if (score >= 15) return "Smooth";
  return "Quiet";
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How uneasy a hue gap is, before chroma and lightness have their say. Same hue is calm. Close
 * neighbours buzz. A true opposite is loud but settled; the near miss just short of it is the
 * worst of all.
 */
const HUE_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [10, 0.04],
  [32, 0.62],
  [60, 0.5],
  [90, 0.64],
  [120, 0.74],
  [150, 1],
  [166, 0.9],
  [180, 0.66],
];

function hueTension(gap: number): number {
  for (let i = 1; i < HUE_CURVE.length; i += 1) {
    const [x1, y1] = HUE_CURVE[i] as readonly [number, number];
    const [x0, y0] = HUE_CURVE[i - 1] as readonly [number, number];
    if (gap <= x1) return y0 + ((gap - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0.66;
}

type Kind = "miss" | "buzz" | "split" | "opposite" | "pull";

type Fight = { a: number; b: number; tension: number; kind: Kind; warmCold: boolean };

/** How far one press of Louder or Quieter tries to move the score. A nudge, not a makeover. */
const NUDGE_STEP = 12;

function fight(first: Oklch, second: Oklch): { tension: number; kind: Kind; warmCold: boolean } {
  const loud = clamp01((Math.sqrt(first.c * second.c) - NEUTRAL_CHROMA) / 0.15);
  if (first.c < NEUTRAL_CHROMA || second.c < NEUTRAL_CHROMA)
    return { tension: 0, kind: "pull", warmCold: false };
  const gap = hueGap(first.h, second.h);
  // Colours of the same lightness have no edge between them, so the eye cannot settle.
  const level = 1 - clamp01(Math.abs(first.l - second.l) / 0.32);
  const base = hueTension(gap);
  // Neighbours only vibrate when they are level. Far-apart hues fight at any lightness.
  const shaped = gap < 60 ? base * (0.35 + 0.65 * level) : base * (0.82 + 0.18 * level);
  const temps = [temperature(first), temperature(second)];
  const warmCold = temps.includes("warm") && temps.includes("cold");
  const tension = clamp01(loud * (shaped + (warmCold ? 0.14 : 0)));
  const kind: Kind = gap < 60 ? "buzz" : gap < 110 ? "pull" : gap < 170 ? "miss" : "opposite";
  return { tension, kind: kind === "pull" && warmCold ? "split" : kind, warmCold };
}

/** Above this a pair is properly at it. Below, the same pair is only starting something. */
const HARD_FIGHT = 0.55;

type Entry = { hex: string; color: Oklch };

function phrase(first: Entry, other: Entry, entry: Fight): string {
  const hard = entry.tension >= HARD_FIGHT;
  if (entry.kind !== "split")
    return plain(colorName(first.hex), colorName(other.hex), entry.kind, hard);
  const warmFirst = temperature(first.color) !== "cold";
  const warm = colorName(warmFirst ? first.hex : other.hex);
  const cold = colorName(warmFirst ? other.hex : first.hex);
  if (warm === cold) return plain(warm, cold, "buzz", hard);
  return hard
    ? `${warm} runs hot, ${cold} runs cold, both turned all the way up`
    : `${warm} runs hot, ${cold} runs cold`;
}

function plain(nameA: string, nameB: string, kind: Kind, hard: boolean): string {
  if (nameA === nameB) {
    return hard
      ? `two kinds of ${nameA} are buzzing against each other`
      : `two kinds of ${nameA} are humming together`;
  }
  switch (kind) {
    case "miss":
      return hard
        ? `${nameA} and ${nameB} are fighting`
        : `${nameA} and ${nameB} are starting something`;
    case "buzz":
      return hard
        ? `${nameA} and ${nameB} are buzzing side by side`
        : `${nameA} and ${nameB} are humming side by side`;
    case "opposite":
      return hard
        ? `${nameA} and ${nameB} are squaring up`
        : `${nameA} and ${nameB} are eyeing each other up`;
    case "split":
    case "pull":
      return hard
        ? `${nameA} and ${nameB} are pulling in different directions`
        : `${nameA} and ${nameB} lean different ways`;
  }
}

/** The distinct, valid colours in a palette, in the order they first appear. */
function distinct(palette: readonly unknown[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const entry of palette) {
    const hex = normalizeHex(entry);
    if (!hex || seen.has(hex)) continue;
    const color = hexToOklch(hex);
    if (!color) continue;
    seen.add(hex);
    out.push({ hex, color });
  }
  return out;
}

export function clashScore(palette: readonly unknown[]): ClashResult {
  const colors = Array.isArray(palette) ? distinct(palette) : [];
  if (colors.length === 0) return { score: 0, label: "Quiet", reasons: ["no colours yet"] };

  const fights: Fight[] = [];
  for (let a = 0; a < colors.length; a += 1) {
    for (let b = a + 1; b < colors.length; b += 1) {
      const first = colors[a];
      const second = colors[b];
      if (!first || !second) continue;
      fights.push({ a, b, ...fight(first.color, second.color) });
    }
  }
  fights.sort((x, y) => y.tension - x.tension || x.a - y.a || x.b - y.b);

  const loudest = Math.max(
    ...colors.map((entry) => clamp01((entry.color.c - NEUTRAL_CHROMA) / 0.2)),
  );
  const top = fights[0]?.tension ?? 0;
  const second = fights[1]?.tension ?? 0;
  const mean =
    fights.length > 0 ? fights.reduce((sum, entry) => sum + entry.tension, 0) / fights.length : 0;
  // The worst fight sets the level, a second fight pushes it, and one loud colour alone still counts a little.
  const raw = top * 0.6 + second * 0.2 + mean * 0.08 + loudest * 0.14;
  const score = Math.round(clamp01(raw) * 100);

  const reasons: string[] = [];
  for (const entry of fights) {
    if (reasons.length >= 3 || entry.tension < 0.2) break;
    // Quiet neighbours are a family, not a fight. They only get a mention once they start to buzz.
    if (entry.kind === "buzz" && entry.tension < 0.3) continue;
    const first = colors[entry.a];
    const other = colors[entry.b];
    if (!first || !other) continue;
    const text = phrase(first, other, entry);
    if (!reasons.includes(text)) reasons.push(text);
  }

  if (reasons.length === 0) {
    const chromatic = colors.filter((entry) => entry.color.c >= NEUTRAL_CHROMA);
    if (colors.length === 1)
      reasons.push(`one colour, ${colorName(colors[0]?.hex)}, with nothing to fight`);
    else if (chromatic.length === 0) reasons.push("all neutrals, nobody raising their voice");
    else if (chromatic.length === 1)
      reasons.push(`${colorName(chromatic[0]?.hex)} has the floor to itself`);
    else if (fights.every((entry) => entry.kind === "buzz"))
      reasons.push("all one family, sitting easy");
    else if (score >= 15) {
      // Nobody is fighting, but somebody is loud. Name them.
      const lead = chromatic.reduce((a, b) => (b.color.c > a.color.c ? b : a));
      reasons.push(`${colorName(lead.hex)} is doing most of the talking`);
    } else reasons.push("soft colours, keeping it down");
  }

  return { score, label: clashLabel(score), reasons };
}

/** Hues given to greys when they are asked to get loud, spread so they land in uneasy places. */
const GREY_HUES = [350, 128, 62, 285, 200, 30];

type Move = (color: Oklch, index: number, anchor: Oklch) => Oklch;

const LOUDER_MOVES: Move[] = [
  (color) => ({ ...color, c: color.c + 0.03 }),
  (color) => ({ ...color, c: color.c + 0.06 }),
  (color) => ({ ...color, h: color.h + 12 }),
  (color) => ({ ...color, h: color.h - 12 }),
  (color) => ({ ...color, c: color.c + 0.12, l: color.l + (0.72 - color.l) * 0.4 }),
  (color) => ({ ...color, h: color.h + 24, c: Math.max(color.c, 0.12) }),
  (color) => ({ ...color, h: color.h - 24, c: Math.max(color.c, 0.12) }),
  (color, _index, anchor) => ({
    ...color,
    l: color.l + (anchor.l - color.l) * 0.5,
    c: color.c + 0.04,
  }),
  (color, _index, anchor) => ({ ...color, h: anchor.h + 150, c: Math.max(color.c, 0.16) }),
];

const QUIETER_MOVES: Move[] = [
  (color) => ({ ...color, c: color.c * 0.88 }),
  (color) => ({ ...color, c: color.c * 0.7 }),
  (color, _index, anchor) => ({ ...color, h: color.h + shortTurn(color.h, anchor.h) * 0.2 }),
  (color) => ({ ...color, c: color.c * 0.45 }),
  (color, _index, anchor) => ({ ...color, h: color.h + shortTurn(color.h, anchor.h) * 0.4 }),
  (color, _index, anchor) => ({ ...color, h: anchor.h, c: color.c * 0.85 }),
  (color, _index, anchor) => ({
    ...color,
    l: color.l + (color.l >= anchor.l ? 0.1 : -0.1),
    c: color.c * 0.9,
  }),
];

/** Signed degrees to turn from one hue to another the short way. */
function shortTurn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function nudge(
  palette: readonly unknown[],
  direction: 1 | -1,
  locked: readonly boolean[],
): string[] {
  const source = Array.isArray(palette) ? palette : [];
  const hexes = source.map((entry) => normalizeHex(entry));
  const current = hexes.map((hex, index) => hex ?? String(source[index] ?? ""));
  const start = clashScore(current).score;
  const anchorIndex = hexes.findIndex((hex, index) => hex !== null && locked[index] === true);
  const firstValid = hexes.findIndex((hex) => hex !== null);
  const moves = direction === 1 ? LOUDER_MOVES : QUIETER_MOVES;

  // Aim for one step, not the biggest jump on offer, so a few presses walk the palette there.
  const target = start + direction * NUDGE_STEP;
  let best = current;
  let bestScore = start;
  hexes.forEach((hex, index) => {
    if (!hex || locked[index]) return;
    const parsed = hexToOklch(hex);
    if (!parsed) return;
    // A grey has no hue of its own, so it is handed one before it is turned up.
    const color: Oklch =
      direction === 1 && parsed.c < NEUTRAL_CHROMA
        ? {
            l: parsed.l + (0.7 - parsed.l) * 0.5,
            c: 0.05,
            h: GREY_HUES[index % GREY_HUES.length] ?? 0,
          }
        : parsed;
    const anchorAt =
      anchorIndex >= 0 && anchorIndex !== index
        ? anchorIndex
        : firstValid === index
          ? hexes.findIndex((h, i) => h !== null && i !== index)
          : firstValid;
    const anchor = hexToOklch(hexes[anchorAt] ?? hex) ?? color;
    for (const move of moves) {
      const next = [...current];
      next[index] = oklchToHex(move(color, index, anchor));
      const score = clashScore(next).score;
      const moved = direction === 1 ? score > start : score < start;
      if (
        moved &&
        (bestScore === start || Math.abs(score - target) < Math.abs(bestScore - target))
      ) {
        best = next;
        bestScore = score;
      }
    }
  });
  return best;
}

/**
 * One step toward a higher score: the single change to one colour that makes the palette fight
 * hardest. Same length back, invalid entries left alone. Pass `locked` to hold colours still.
 */
export function louder(palette: readonly unknown[], locked: readonly boolean[] = []): string[] {
  return nudge(palette, 1, locked);
}

/** One step toward a lower score. Quieter is not better, only quieter. */
export function quieter(palette: readonly unknown[], locked: readonly boolean[] = []): string[] {
  return nudge(palette, -1, locked);
}
