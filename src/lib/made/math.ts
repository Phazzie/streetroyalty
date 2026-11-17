/**
 * The money maths for makers. Pure, whole cents, no environment access, safe on the client.
 * Percentages travel as basis points (290 means 2.9 percent) so nothing is ever a float.
 */

export type Plan = {
  /** What you charge for one piece. */
  priceCents: number;
  /** What it costs to make one piece: the blank and the print. */
  makeCents: number;
  /** Shipping the buyer pays you. */
  shipChargedCents: number;
  /** Shipping you pay the printer. */
  shipPaidCents: number;
  /** Card fee, percent part, in basis points. */
  feeBps: number;
  /** Card fee, fixed part, per sale. */
  feeFixedCents: number;
  /** The house cut of the price, in basis points. Not decided yet, so it starts at zero. */
  houseBps: number;
  /** Pieces sold a month. */
  perMonth: number;
  /** An ad budget to pay back. */
  adCents: number;
  /** What you want to keep a month. */
  targetCents: number;
};

export const DEFAULT_PLAN: Plan = {
  priceCents: 4500,
  makeCents: 1395,
  shipChargedCents: 500,
  shipPaidCents: 500,
  feeBps: 290,
  feeFixedCents: 30,
  houseBps: 0,
  perMonth: 10,
  adCents: 5000,
  targetCents: 50000,
};

const MAX_CENTS = 100_000_000;
const MAX_PIECES = 100_000;

function wholeCents(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(MAX_CENTS, Math.round(number));
}

function basisPoints(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(10_000, Math.round(number));
}

function wholeCount(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(MAX_PIECES, Math.floor(number));
}

/** Clean a plan from anywhere: junk, negatives and fractions of a cent never get through. */
export function cleanPlan(input: Partial<Record<keyof Plan, unknown>> | undefined): Plan {
  const pick = (key: keyof Plan): unknown => {
    const value = input?.[key];
    return value === undefined || value === null || value === "" ? DEFAULT_PLAN[key] : value;
  };
  return {
    priceCents: wholeCents(pick("priceCents")),
    makeCents: wholeCents(pick("makeCents")),
    shipChargedCents: wholeCents(pick("shipChargedCents")),
    shipPaidCents: wholeCents(pick("shipPaidCents")),
    feeBps: basisPoints(pick("feeBps")),
    feeFixedCents: wholeCents(pick("feeFixedCents")),
    houseBps: basisPoints(pick("houseBps")),
    perMonth: wholeCount(pick("perMonth")),
    adCents: wholeCents(pick("adCents")),
    targetCents: wholeCents(pick("targetCents")),
  };
}

/** A share of an amount, rounded half up to a whole cent. */
export function shareOf(cents: number, bps: number): number {
  return Math.round((wholeCents(cents) * basisPoints(bps)) / 10_000);
}

/** The card fee on what the buyer pays. Nothing collected means no charge and no fee. */
export function cardFee(collectedCents: number, feeBps: number, feeFixedCents: number): number {
  const collected = wholeCents(collectedCents);
  if (collected === 0) return 0;
  return shareOf(collected, feeBps) + wholeCents(feeFixedCents);
}

export type PlanResult = {
  /** Price plus the shipping you charge. The card fee is taken on this. */
  collectedCents: number;
  cardFeeCents: number;
  houseCutCents: number;
  /** Shipping charged minus shipping paid. Negative means you cover part of it. */
  shippingGapCents: number;
  /** What is left from one piece. It can be negative. */
  keepCents: number;
  keepPerMonthCents: number;
  /** Whole pieces to pay back the ad budget. Null when a piece keeps nothing. */
  piecesForAds: number | null;
  /** Whole pieces a month to reach the target. Null when a piece keeps nothing. */
  piecesForTarget: number | null;
  /** The lowest price that does not lose money. Null when no price can. */
  breakEvenPriceCents: number | null;
  /** Where one sale goes, for a bar. Always adds up to collectedCents when keep is not negative. */
  parts: { making: number; shipping: number; cardFee: number; house: number; keep: number };
};

function keepAt(plan: Plan, priceCents: number): number {
  const collected = priceCents + plan.shipChargedCents;
  return (
    collected -
    plan.makeCents -
    plan.shipPaidCents -
    cardFee(collected, plan.feeBps, plan.feeFixedCents) -
    shareOf(priceCents, plan.houseBps)
  );
}

function piecesToCover(amountCents: number, keepCents: number): number | null {
  if (amountCents <= 0) return 0;
  if (keepCents <= 0) return null;
  return Math.ceil(amountCents / keepCents);
}

function breakEvenPrice(plan: Plan): number | null {
  if (keepAt(plan, MAX_CENTS) < 0) return null;
  let low = 0;
  let high = MAX_CENTS;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (keepAt(plan, middle) >= 0) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function runPlan(input: Partial<Record<keyof Plan, unknown>> | undefined): PlanResult {
  const plan = cleanPlan(input);
  const collectedCents = plan.priceCents + plan.shipChargedCents;
  const cardFeeCents = cardFee(collectedCents, plan.feeBps, plan.feeFixedCents);
  const houseCutCents = shareOf(plan.priceCents, plan.houseBps);
  const keepCents = keepAt(plan, plan.priceCents);
  return {
    collectedCents,
    cardFeeCents,
    houseCutCents,
    shippingGapCents: plan.shipChargedCents - plan.shipPaidCents,
    keepCents,
    keepPerMonthCents: keepCents * plan.perMonth,
    piecesForAds: piecesToCover(plan.adCents, keepCents),
    piecesForTarget: piecesToCover(plan.targetCents, keepCents),
    breakEvenPriceCents: breakEvenPrice(plan),
    parts: {
      making: plan.makeCents,
      shipping: plan.shipPaidCents,
      cardFee: cardFeeCents,
      house: houseCutCents,
      keep: Math.max(0, keepCents),
    },
  };
}

/* The plan in the address bar. Short keys, whole numbers, and defaults are left out. */

export type PlanSearch = {
  p?: number;
  m?: number;
  sc?: number;
  sp?: number;
  f?: number;
  x?: number;
  h?: number;
  n?: number;
  a?: number;
  t?: number;
  /** The id of the blank the cost came from, so the preset stays lit. */
  b?: string;
};

const KEYS: [keyof Omit<PlanSearch, "b">, keyof Plan][] = [
  ["p", "priceCents"],
  ["m", "makeCents"],
  ["sc", "shipChargedCents"],
  ["sp", "shipPaidCents"],
  ["f", "feeBps"],
  ["x", "feeFixedCents"],
  ["h", "houseBps"],
  ["n", "perMonth"],
  ["a", "adCents"],
  ["t", "targetCents"],
];

/** For validateSearch: keep only whole, sane numbers, and drop the rest. */
export function readPlanSearch(search: Record<string, unknown>): PlanSearch {
  const out: PlanSearch = {};
  for (const [short] of KEYS) {
    const raw = search[short];
    if (raw === undefined || raw === null || raw === "") continue;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) continue;
    out[short] = Math.min(MAX_CENTS, Math.round(number));
  }
  if (typeof search.b === "string" && /^[\w-]{1,64}$/.test(search.b)) out.b = search.b;
  else if (typeof search.b === "number" && Number.isFinite(search.b)) out.b = String(search.b);
  return out;
}

/**
 * The router hands back whatever was in the link for any key validateSearch left out, so
 * this reads the search again and trusts nothing: junk falls back to the default.
 */
export function planFromSearch(search: PlanSearch | Record<string, unknown>): Plan {
  const safe = readPlanSearch(search as Record<string, unknown>);
  const raw: Partial<Record<keyof Plan, unknown>> = {};
  for (const [short, long] of KEYS) raw[long] = safe[short];
  return cleanPlan(raw);
}

export function searchFromPlan(plan: Plan, blankId?: string): PlanSearch {
  const clean = cleanPlan(plan);
  const out: PlanSearch = {};
  for (const [short, long] of KEYS) {
    if (clean[long] !== DEFAULT_PLAN[long]) out[short] = clean[long];
  }
  if (blankId) out.b = blankId;
  return out;
}

/* Typing money. People type "45", "45.5", "$45.00" or "45,50". */

export function dollarsToCents(text: string): number {
  const tidy = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  const match = /^(\d*)(?:\.(\d{0,2})\d*)?/.exec(tidy);
  if (!match) return 0;
  const dollars = Number(match[1] || "0");
  const cents = Number((match[2] ?? "").padEnd(2, "0") || "0");
  return wholeCents(dollars * 100 + cents);
}

export function percentToBps(text: string): number {
  const tidy = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  const number = Number.parseFloat(tidy);
  if (!Number.isFinite(number)) return 0;
  return basisPoints(number * 100);
}

export function bpsToPercent(bps: number): string {
  return String(basisPoints(bps) / 100);
}

/* The split on a piece page. */

export const CARD_FEE_BPS = 290;
export const CARD_FEE_FIXED_CENTS = 30;

export type Split = {
  retailCents: number;
  makingCents: number;
  cardFeeCents: number;
  leftCents: number;
  /** Shares of the bar, in whole percent, adding up to 100. */
  percent: { making: number; cardFee: number; left: number };
};

/**
 * Where the price of a piece goes. Making it is about the price divided by the markup,
 * because the price was set as the making cost times the markup.
 */
export function splitRetail(retailCents: number, markup: number): Split {
  const retail = wholeCents(retailCents);
  const factor = Number.isFinite(markup) && markup >= 1 ? Math.min(5, markup) : 1;
  const makingCents = Math.min(retail, Math.round(retail / factor));
  const cardFeeCents = Math.min(
    retail - makingCents,
    cardFee(retail, CARD_FEE_BPS, CARD_FEE_FIXED_CENTS),
  );
  const leftCents = retail - makingCents - cardFeeCents;
  if (retail === 0) {
    return {
      retailCents: 0,
      makingCents: 0,
      cardFeeCents: 0,
      leftCents: 0,
      percent: { making: 0, cardFee: 0, left: 0 },
    };
  }
  const making = Math.round((makingCents / retail) * 100);
  const fee = Math.round((cardFeeCents / retail) * 100);
  return {
    retailCents: retail,
    makingCents,
    cardFeeCents,
    leftCents,
    percent: { making, cardFee: fee, left: Math.max(0, 100 - making - fee) },
  };
}
