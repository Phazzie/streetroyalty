/**
 * A maker's ink as the piece moves between blanks. Pure, so every move can be tested.
 *
 * Lime is the house starter ink and it disappears on a pale all-over body. So when a piece
 * moves onto an all-over blank, lime text that would not read there starts in that garment's
 * logo colour, the maker is told, and the swap is remembered. When the piece leaves the
 * all-over blank, each colour the studio changed goes back, unless the maker picked a new
 * one in the meantime. No other ink is ever touched: the tool does not correct anyone's taste.
 */
import { contrastRatio } from "../contrast.ts";
import type { DesignLayer } from "../pod/types.ts";
import { activeColorway, type GarmentDesign } from "./garments.ts";

export const HOUSE_LIME = "#d6ff3c";

/** The print check's own "it reads" line. Lime at or above it is left alone. */
const READS = 3.2;

/** Each text layer the studio recoloured: the maker's colour, and the colour the studio put in. */
export type InkSwap = Record<string, { mine: string; studio: string }>;

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** On moving onto an all-over blank: lime that would vanish on the body starts in the logo colour. */
export function swapForAllOver(
  layers: DesignLayer[],
  colors: { body: string; mark: string },
): { layers: DesignLayer[]; swap: InkSwap } {
  const swap: InkSwap = {};
  const next = layers.map((layer) => {
    if (layer.type !== "text" || !same(layer.color, HOUSE_LIME)) return layer;
    const lime = contrastRatio(layer.color, colors.body);
    if (lime >= READS || contrastRatio(colors.mark, colors.body) <= lime) return layer;
    swap[layer.id] = { mine: layer.color, studio: colors.mark };
    return { ...layer, color: colors.mark };
  });
  return { layers: Object.keys(swap).length > 0 ? next : layers, swap };
}

/** On leaving the all-over blank: the maker's own colours come back, except where they chose again. */
export function restoreInk(
  layers: DesignLayer[],
  swap: InkSwap,
): { layers: DesignLayer[]; restored: number } {
  let restored = 0;
  const next = layers.map((layer) => {
    const entry = swap[layer.id];
    if (!entry || layer.type !== "text" || !same(layer.color, entry.studio)) return layer;
    restored += 1;
    return { ...layer, color: entry.mine };
  });
  return { layers: restored > 0 ? next : layers, restored };
}

/** Said when the studio changed a maker's ink, so nothing changes behind their back. */
export function swapNote(count: number): string {
  const what = count === 1 ? "your lime text starts" : "your lime text layers start";
  return `Lime does not show on this body, so ${what} in the logo colour. Pick another blank and your lime comes back.`;
}

/** Said when the maker's own ink comes back, so the note about the swap does not linger. */
export function restoreNote(count: number): string {
  return count === 1
    ? "Your lime is back."
    : "Your lime is back on every layer the studio changed.";
}

/**
 * What the print check measures ink against: the garment that is actually selected. A garment
 * left over from an all-over blank the maker has since left never counts.
 */
export function printGround(input: {
  aopTemplateId?: string | null;
  garment: GarmentDesign | null;
  variantHex?: string | null;
}): string {
  const { aopTemplateId, garment } = input;
  if (aopTemplateId && garment?.templateId === aopTemplateId) {
    return activeColorway(garment).colors.body;
  }
  return input.variantHex || "#141414";
}

/** The two colours of an all-over garment that ink has to read on and can fall back to. */
export function garmentInk(garment: GarmentDesign): { body: string; mark: string } {
  const { body, mark } = activeColorway(garment).colors;
  return { body, mark };
}
