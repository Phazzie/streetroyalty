/**
 * Live price ticker math for the studio. Pure and client-safe.
 *
 * Honesty rule (MOON-LOG round 0): the ticker starts from the catalog
 * variant's real wholesale/retail pair and only adds labeled, itemized
 * estimates. The server recomputes the saved price from the variant on
 * save and checkout — this module never sets a price, it explains one.
 */
import { applyMarkup, clampMarkup } from "../pod/money.ts";

export type Finish = "print" | "embroidery" | "vintage";

export type TickerInput = {
  /** Catalog wholesale for the chosen variant, cents. Null until loaded. */
  wholesaleCents: number | null;
  markup: number;
  layerCount: number;
  finish: Finish;
  /** True when any layer sits outside the print-area bounds estimate. */
  oversize?: boolean;
};

export type TickerLine = {
  key: string;
  label: string;
  cents: number;
};

export type TickerBreakdown = {
  lines: TickerLine[];
  /** Estimated wholesale after studio extras, cents. */
  wholesaleCents: number;
  /** Estimated retail (markup applied), cents. */
  retailCents: number;
  /** The variant's catalog retail, before studio extras. Display anchor. */
  catalogRetailCents: number | null;
};

/** First layer rides with the blank. Each layer after that costs ink/time. */
export const EXTRA_LAYER_CENTS = 85;
/** Embroidery is stitched, not printed: flat upcharge per piece. */
export const EMBROIDERY_CENTS = 450;
/** Vintage wash is a garment treatment, priced like one. */
export const VINTAGE_WASH_CENTS = 300;
/** Art that spills past the print area needs a bigger screen setup. */
export const OVERSIZE_CENTS = 200;

export function finishDeltaCents(finish: Finish): number {
  if (finish === "embroidery") return EMBROIDERY_CENTS;
  if (finish === "vintage") return VINTAGE_WASH_CENTS;
  return 0;
}

export function priceTicker(input: TickerInput): TickerBreakdown {
  const markup = clampMarkup(input.markup);
  const base = Math.max(0, Math.round(input.wholesaleCents ?? 0));
  const layers = Math.max(1, Math.round(input.layerCount) || 1);
  const extraLayers = Math.max(0, layers - 1);
  const lines: TickerLine[] = [{ key: "blank", label: "Blank + first print", cents: base }];
  if (extraLayers > 0) {
    lines.push({
      key: "layers",
      label: `Extra layers × ${extraLayers}`,
      cents: extraLayers * EXTRA_LAYER_CENTS,
    });
  }
  const finishDelta = finishDeltaCents(input.finish);
  if (finishDelta > 0) {
    lines.push({
      key: "finish",
      label: input.finish === "embroidery" ? "Embroidery finish" : "Vintage wash",
      cents: finishDelta,
    });
  }
  if (input.oversize) {
    lines.push({ key: "oversize", label: "Oversize setup", cents: OVERSIZE_CENTS });
  }
  const wholesale = lines.reduce((sum, line) => sum + line.cents, 0);
  return {
    lines,
    wholesaleCents: wholesale,
    retailCents: applyMarkup(wholesale, markup),
    catalogRetailCents: input.wholesaleCents == null ? null : applyMarkup(base, markup),
  };
}

/** Signed delta between two breakdowns, for the ticker's up/down flash. */
export function tickerDelta(previous: TickerBreakdown, next: TickerBreakdown): number {
  return next.retailCents - previous.retailCents;
}
