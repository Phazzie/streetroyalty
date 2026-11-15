/**
 * Design DNA + Remix Dice. Every design is genes; a dice roll mutates a
 * few genes and deals a variant family. Deterministic from a seed, so a
 * family someone loves can be re-rolled exactly.
 */
import { CURATED_COLORWAYS } from "./colorway.ts";
import { TEXT_PRESETS } from "./textfx.ts";
import type { Finish } from "./pricing.ts";

export type Dna = {
  garment: string;
  garmentHex: string;
  inkHex: string;
  colorwayName: string;
  placement: string;
  textStyle: string;
  finish: Finish;
  theme: "matte" | "maximal";
};

export const PLACEMENT_GENES = ["front", "back", "sleeve_left", "sleeve_right"] as const;
export const FINISH_GENES: Finish[] = ["print", "embroidery", "vintage"];
export const GARMENT_GENES = ["T-Shirt", "Hoodie", "Hat", "Sweatshirt", "Long-Sleeve", "Joggers", "Tote"] as const;

/** mulberry32 — tiny deterministic RNG, seeded by the dice. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, pool: readonly T[]): T {
  return pool[Math.floor(rng() * pool.length)] ?? pool[0]!;
}

export function dnaFrom(input: Partial<Dna> = {}): Dna {
  const way = CURATED_COLORWAYS[0]!;
  return {
    garment: input.garment ?? "T-Shirt",
    garmentHex: input.garmentHex ?? way.garmentHex,
    inkHex: input.inkHex ?? way.inkHex,
    colorwayName: input.colorwayName ?? way.name,
    placement: input.placement ?? "front",
    textStyle: input.textStyle ?? "Block party",
    finish: input.finish ?? "print",
    theme: input.theme ?? "maximal",
  };
}

/** Mutate 1–3 genes. The garment gene is sticky — a family stays a family. */
export function mutateDna(dna: Dna, rng: () => number): Dna {
  const next = { ...dna };
  const rolls = 1 + Math.floor(rng() * 3);
  const genes = ["colorway", "placement", "textStyle", "finish", "theme"] as const;
  for (let i = 0; i < rolls; i += 1) {
    const gene = genes[Math.floor(rng() * genes.length)]!;
    if (gene === "colorway") {
      const way = pick(rng, CURATED_COLORWAYS);
      next.garmentHex = way.garmentHex;
      next.inkHex = way.inkHex;
      next.colorwayName = way.name;
    } else if (gene === "placement") {
      next.placement = pick(rng, PLACEMENT_GENES);
    } else if (gene === "textStyle") {
      next.textStyle = pick(rng, TEXT_PRESETS).name;
    } else if (gene === "finish") {
      next.finish = pick(rng, FINISH_GENES);
    } else {
      next.theme = next.theme === "matte" ? "maximal" : "matte";
    }
  }
  return next;
}

export function variantFamily(dna: Dna, count: number, seed: number): Dna[] {
  const rng = seededRng(seed);
  const family: Dna[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (family.length < count && guard < count * 12) {
    guard += 1;
    const variant = mutateDna(dna, rng);
    const key = dnaLabel(variant);
    if (seen.has(key)) continue;
    seen.add(key);
    family.push(variant);
  }
  return family;
}

export function dnaLabel(dna: Dna): string {
  return [dna.garment, dna.colorwayName, dna.placement, dna.textStyle, dna.finish, dna.theme]
    .join(" · ")
    .toUpperCase();
}

/** Public design changelog: drop openings + co-design (fork) credits, dated. */
export type ChangelogEntry = { date: string; text: string };

export function designChangelog(
  pieces: { title: string; forkedFromTitle?: string | null; updatedAt: string; collectionId: string | null }[],
  drops: { collectionId: string; name: string; dropAt: string }[],
): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const drop of drops) {
    entries.push({ date: drop.dropAt, text: `Drop opened: ${drop.name}` });
  }
  for (const piece of pieces) {
    if (piece.forkedFromTitle) {
      entries.push({
        date: piece.updatedAt,
        text: `Co-designed: “${piece.title}” forked from “${piece.forkedFromTitle}” — credit rides with the piece.`,
      });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
