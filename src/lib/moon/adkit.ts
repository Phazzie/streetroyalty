/**
 * Ad Factory. Fabletics makes tens of thousands of ads with an army.
 * Here every design mints its own kit: static cards across its colorways
 * and both storefront themes, offer cards with the price said out loud,
 * and PSA-parody copy in the house voice. Volume is a feature of the
 * product, not a department.
 */
import { CURATED_COLORWAYS, type Colorway } from "./colorway.ts";
import { SHOP_THEMES } from "./theme.ts";
import { formatMoney } from "../pod/money.ts";

export type AdCard = {
  kind: "static" | "offer" | "psa";
  theme: string;
  garmentHex: string;
  inkHex: string;
  headline: string;
  sub: string;
  cta: string;
};

export type AdPiece = {
  title: string;
  productName: string;
  retailCents: number;
};

const PSA_LINES: { headline: string; sub: string }[] = [
  { headline: "This is an intervention for your fit.", sub: "Friends stage them. Strangers just stare." },
  { headline: "Somewhere, a box-cut tee is ruining a good night.", sub: "It does not have to be yours." },
  { headline: "Your closet called. It wants a word.", sub: "The word is standards." },
  { headline: "A public service announcement, from the block.", sub: "Wear it like you mean it." },
];

export function psaCards(piece: AdPiece): AdCard[] {
  return PSA_LINES.map((line, index) => ({
    kind: "psa" as const,
    theme: SHOP_THEMES[index % SHOP_THEMES.length]!.name,
    garmentHex: "#141414",
    inkHex: "#d6ff3c",
    headline: line.headline,
    sub: `${line.sub} — ${piece.title}`,
    cta: "Rescue the fit",
  }));
}

export function adKitFor(piece: AdPiece, colorways: Colorway[] = CURATED_COLORWAYS): AdCard[] {
  const cards: AdCard[] = [];
  for (const way of colorways) {
    for (const theme of SHOP_THEMES) {
      cards.push({
        kind: "static",
        theme: theme.name,
        garmentHex: way.garmentHex,
        inkHex: way.inkHex,
        headline: piece.title.toUpperCase(),
        sub: `${piece.productName} — ${way.name}`,
        cta: "Peel this look",
      });
    }
  }
  cards.push(
    {
      kind: "offer",
      theme: SHOP_THEMES[1]!.name,
      garmentHex: "#141414",
      inkHex: "#ff2d95",
      headline: `${piece.title} — ${formatMoney(piece.retailCents)}`,
      sub: "The whole price. No membership behind it. No charge hiding anywhere.",
      cta: "See the receipt",
    },
    {
      kind: "offer",
      theme: SHOP_THEMES[0]!.name,
      garmentHex: "#141414",
      inkHex: "#f6f1ff",
      headline: "Steal this look. Legally.",
      sub: "Fork it, change it, wear your version. Credit rides with the piece.",
      cta: "Fork it",
    },
  );
  return [...cards, ...psaCards(piece)];
}
