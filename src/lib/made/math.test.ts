import { describe, expect, it } from "vitest";
import {
  bpsToPercent,
  cardFee,
  cleanPlan,
  DEFAULT_PLAN,
  dollarsToCents,
  percentToBps,
  planFromSearch,
  readPlanSearch,
  runPlan,
  searchFromPlan,
  shareOf,
  splitRetail,
} from "./math.ts";

describe("cardFee", () => {
  it("takes 2.9 percent plus 30 cents of what the buyer pays", () => {
    expect(cardFee(5000, 290, 30)).toBe(175);
  });

  it("rounds half a cent up", () => {
    // 2.9 percent of $0.50 is 1.45 cents, of $2.50 is 7.25 cents, of $17.25 is 50.025 cents.
    expect(shareOf(50, 290)).toBe(1);
    expect(shareOf(250, 290)).toBe(7);
    expect(shareOf(5000, 125)).toBe(63);
  });

  it("charges nothing when nothing is collected", () => {
    expect(cardFee(0, 290, 30)).toBe(0);
    expect(cardFee(-500, 290, 30)).toBe(0);
  });
});

describe("cleanPlan", () => {
  it("fills in the defaults", () => {
    expect(cleanPlan(undefined)).toEqual(DEFAULT_PLAN);
    expect(cleanPlan({})).toEqual(DEFAULT_PLAN);
  });

  it("turns junk and negatives into zero and never keeps part of a cent", () => {
    const plan = cleanPlan({
      priceCents: -4500,
      makeCents: Number.NaN,
      shipChargedCents: "abc",
      shipPaidCents: 499.6,
      feeBps: 99_999,
      perMonth: 3.9,
      adCents: Number.POSITIVE_INFINITY,
    });
    expect(plan.priceCents).toBe(0);
    expect(plan.makeCents).toBe(0);
    expect(plan.shipChargedCents).toBe(0);
    expect(plan.shipPaidCents).toBe(500);
    expect(plan.feeBps).toBe(10_000);
    expect(plan.perMonth).toBe(3);
    expect(plan.adCents).toBe(0);
  });
});

describe("runPlan", () => {
  const plan = { ...DEFAULT_PLAN };

  it("works out what one piece keeps", () => {
    // $45 plus $5 shipping collected. Fee is 2.9 percent of $50 plus 30 cents: $1.75.
    // 5000 - 1395 making - 500 shipping - 175 fee = 2930.
    const result = runPlan(plan);
    expect(result.collectedCents).toBe(5000);
    expect(result.cardFeeCents).toBe(175);
    expect(result.houseCutCents).toBe(0);
    expect(result.keepCents).toBe(2930);
    expect(result.keepPerMonthCents).toBe(29_300);
  });

  it("makes the parts add up to what was collected", () => {
    const result = runPlan({ ...plan, houseBps: 1000 });
    const { making, shipping, cardFee: fee, house, keep } = result.parts;
    expect(result.houseCutCents).toBe(450);
    expect(making + shipping + fee + house + keep).toBe(result.collectedCents);
  });

  it("takes the house cut from the price, not from shipping", () => {
    expect(runPlan({ ...plan, houseBps: 2000, shipChargedCents: 9900 }).houseCutCents).toBe(900);
  });

  it("rounds pieces up, because nobody sells part of a piece", () => {
    const result = runPlan({ ...plan, adCents: 5000, targetCents: 50_000 });
    expect(result.piecesForAds).toBe(2); // 5000 / 2930 = 1.7
    expect(result.piecesForTarget).toBe(18); // 50000 / 2930 = 17.06
  });

  it("needs no pieces to pay back nothing", () => {
    const result = runPlan({ ...plan, adCents: 0, targetCents: 0 });
    expect(result.piecesForAds).toBe(0);
    expect(result.piecesForTarget).toBe(0);
  });

  it("says a losing piece can never pay anything back", () => {
    const result = runPlan({ ...plan, priceCents: 1000 });
    expect(result.keepCents).toBeLessThan(0);
    expect(result.keepPerMonthCents).toBeLessThan(0);
    expect(result.piecesForAds).toBeNull();
    expect(result.piecesForTarget).toBeNull();
    expect(result.parts.keep).toBe(0);
  });

  it("treats a piece that keeps exactly nothing the same way", () => {
    const flat = runPlan({
      priceCents: 1000,
      makeCents: 1000,
      shipChargedCents: 0,
      shipPaidCents: 0,
      feeBps: 0,
      feeFixedCents: 0,
    });
    expect(flat.keepCents).toBe(0);
    expect(flat.piecesForAds).toBeNull();
  });

  it("survives everything being zero", () => {
    const result = runPlan({
      priceCents: 0,
      makeCents: 0,
      shipChargedCents: 0,
      shipPaidCents: 0,
      perMonth: 0,
      adCents: 0,
      targetCents: 0,
    });
    expect(result.keepCents).toBe(0);
    expect(result.cardFeeCents).toBe(0);
    expect(result.keepPerMonthCents).toBe(0);
  });

  it("finds the lowest price that does not lose money", () => {
    const result = runPlan(plan);
    const price = result.breakEvenPriceCents;
    expect(price).not.toBeNull();
    if (price === null) return;
    expect(runPlan({ ...plan, priceCents: price }).keepCents).toBeGreaterThanOrEqual(0);
    expect(runPlan({ ...plan, priceCents: price - 1 }).keepCents).toBeLessThan(0);
  });

  it("says no price works when the fees take everything", () => {
    expect(runPlan({ ...plan, feeBps: 6000, houseBps: 5000 }).breakEvenPriceCents).toBeNull();
  });

  it("only ever returns whole cents", () => {
    const result = runPlan({ ...plan, priceCents: 3333, feeBps: 333, houseBps: 777 });
    for (const value of [result.cardFeeCents, result.houseCutCents, result.keepCents]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("the plan in the address bar", () => {
  it("leaves the defaults out", () => {
    expect(searchFromPlan(DEFAULT_PLAN)).toEqual({});
  });

  it("goes there and back", () => {
    const plan = { ...DEFAULT_PLAN, priceCents: 6000, houseBps: 1500, perMonth: 40 };
    const search = searchFromPlan(plan, "hoodie-pullover");
    expect(search).toEqual({ p: 6000, h: 1500, n: 40, b: "hoodie-pullover" });
    expect(planFromSearch(readPlanSearch(search))).toEqual(plan);
  });

  it("drops junk from a pasted link", () => {
    expect(readPlanSearch({ p: "abc", m: -5, n: "12", b: "<script>", zz: 1 })).toEqual({ n: 12 });
  });

  it("falls back to the default when the router passes junk straight through", () => {
    const plan = planFromSearch({ p: "abc", m: -4, h: 99_999, n: 1e99 });
    expect(plan.priceCents).toBe(DEFAULT_PLAN.priceCents);
    expect(plan.makeCents).toBe(DEFAULT_PLAN.makeCents);
    expect(plan.houseBps).toBe(10_000);
    expect(plan.perMonth).toBe(100_000);
  });

  it("keeps a zero that someone typed on purpose", () => {
    expect(planFromSearch(readPlanSearch({ sc: 0 })).shipChargedCents).toBe(0);
  });
});

describe("typing money", () => {
  it("reads what people type", () => {
    expect(dollarsToCents("45")).toBe(4500);
    expect(dollarsToCents("45.5")).toBe(4550);
    expect(dollarsToCents("$45.00")).toBe(4500);
    expect(dollarsToCents("45,50")).toBe(4550);
    expect(dollarsToCents(".5")).toBe(50);
    expect(dollarsToCents("12.999")).toBe(1299);
    expect(dollarsToCents("")).toBe(0);
    expect(dollarsToCents("-20")).toBe(2000);
  });

  it("reads a comma as thousands unless it is plainly the cents", () => {
    expect(dollarsToCents("1,000")).toBe(100_000);
    expect(dollarsToCents("$1,250.50")).toBe(125_050);
    expect(dollarsToCents("12,000,000")).toBe(100_000_000);
    expect(dollarsToCents("1.250,50")).toBe(125_050);
    expect(dollarsToCents("45,5")).toBe(4550);
    expect(dollarsToCents(",5")).toBe(50);
    expect(dollarsToCents("abc")).toBe(0);
    expect(dollarsToCents("1e9")).toBe(1900);
  });

  it("reads a percent", () => {
    expect(percentToBps("2.9")).toBe(290);
    expect(percentToBps("10%")).toBe(1000);
    expect(percentToBps("")).toBe(0);
    expect(percentToBps("250")).toBe(10_000);
    expect(bpsToPercent(290)).toBe("2.9");
  });
});

describe("splitRetail", () => {
  it("splits a price into making it, the card fee and what is left", () => {
    // $48 at a 2.2 markup: making is 4800 / 2.2 = 2182. Fee is 139 + 30 = 169.
    const split = splitRetail(4800, 2.2);
    expect(split.makingCents).toBe(2182);
    expect(split.cardFeeCents).toBe(169);
    expect(split.leftCents).toBe(4800 - 2182 - 169);
    expect(split.makingCents + split.cardFeeCents + split.leftCents).toBe(4800);
    expect(split.percent.making + split.percent.cardFee + split.percent.left).toBe(100);
  });

  it("never lets a part go below zero", () => {
    const split = splitRetail(100, 1);
    expect(split.makingCents).toBe(100);
    expect(split.cardFeeCents).toBe(0);
    expect(split.leftCents).toBe(0);
  });

  it("handles nothing and nonsense", () => {
    expect(splitRetail(0, 2.2).percent).toEqual({ making: 0, cardFee: 0, left: 0 });
    expect(splitRetail(-500, 2.2).retailCents).toBe(0);
    expect(splitRetail(4800, Number.NaN).makingCents).toBe(4800);
    expect(splitRetail(4800, 0).leftCents).toBe(0);
  });
});
