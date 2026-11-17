/**
 * Who makes what. Typed so the app can later route an order to a maker that can do the job.
 *
 * The rule for this file: a claim is only "says-yes" when the maker's own site said so on the
 * day in `checkedOn`, and the page it came from is in `sourceUrl`. Anything else is
 * "not-checked". That is not a "no", it means nobody here has read it on the maker's site.
 * No prices live here.
 */

export type MethodId =
  "dtg" | "dtf" | "embroidery" | "puff" | "all-over" | "cut-and-sew" | "screen";

export const METHODS: { id: MethodId; label: string }[] = [
  { id: "dtg", label: "Direct to garment" },
  { id: "dtf", label: "Direct to film" },
  { id: "embroidery", label: "Embroidery" },
  { id: "puff", label: "Puff print" },
  { id: "all-over", label: "All-over print" },
  { id: "cut-and-sew", label: "Cut and sew" },
  { id: "screen", label: "Screen print" },
];

export type Claim =
  { status: "says-yes"; sourceUrl: string; saw: string; note?: string } | { status: "not-checked" };

export type MakerId = "printful" | "printify" | "contrado" | "gooten";

export type Maker = {
  id: MakerId;
  name: string;
  /** The date a person or agent last read the source pages. */
  checkedOn: string;
  /** Whether the studio can send this maker an order today. */
  wiredIn: boolean;
  /** How the maker describes who does the making. */
  whoMakesIt: Claim;
  /** Whether one piece can be ordered on its own. */
  noMinimum: Claim;
  methods: Record<MethodId, Claim>;
};

const CHECKED = "17 Nov 2026";
const NOT_CHECKED: Claim = { status: "not-checked" };

export const MAKERS: Maker[] = [
  {
    id: "printful",
    name: "Printful",
    checkedOn: CHECKED,
    wiredIn: true,
    whoMakesIt: {
      status: "says-yes",
      sourceUrl: "https://www.printful.com/all-over-print",
      saw: "An in-house sewing team puts each all-over piece together.",
    },
    noMinimum: {
      status: "says-yes",
      sourceUrl: "https://www.printful.com/custom-products",
      saw: "No minimum order amount.",
    },
    methods: {
      dtg: {
        status: "says-yes",
        sourceUrl: "https://www.printful.com/dtg-printing",
        saw: "A digital printer applies water-based inks to fabric.",
      },
      dtf: {
        status: "says-yes",
        sourceUrl: "https://www.printful.com/dtflex",
        saw: "Sold as DTFlex, which it calls direct-to-film printing, perfected.",
      },
      embroidery: {
        status: "says-yes",
        sourceUrl: "https://www.printful.com/custom-embroidery",
        saw: "Custom embroidery made to last.",
      },
      puff: NOT_CHECKED,
      "all-over": {
        status: "says-yes",
        sourceUrl: "https://www.printful.com/all-over-print",
        saw: "Dye and heat on synthetics, water-based ink straight onto cotton.",
      },
      "cut-and-sew": {
        status: "says-yes",
        sourceUrl: "https://www.printful.com/all-over-print",
        saw: "After printing, the piece is cut and sewn to shape.",
        note: "Only as part of all-over print.",
      },
      screen: NOT_CHECKED,
    },
  },
  {
    id: "printify",
    name: "Printify",
    checkedOn: CHECKED,
    wiredIn: false,
    whoMakesIt: {
      status: "says-yes",
      sourceUrl: "https://printify.com/all-over-print/",
      saw: "Orders go to a network of separate print providers.",
    },
    noMinimum: {
      status: "says-yes",
      sourceUrl: "https://printify.com/all-over-print/",
      saw: "No upfront costs, no minimums.",
    },
    methods: {
      dtg: {
        status: "says-yes",
        sourceUrl: "https://printify.com/blog/dtf-vs-dtg-printing/",
        saw: "Printify offers both DTG and DTF products.",
      },
      dtf: {
        status: "says-yes",
        sourceUrl: "https://printify.com/blog/dtf-vs-dtg-printing/",
        saw: "Printify offers both DTG and DTF products.",
      },
      embroidery: {
        status: "says-yes",
        sourceUrl: "https://printify.com/guide/embroidery-guide/",
        saw: "It has an embroidery catalog and a guide to designing for it.",
      },
      puff: NOT_CHECKED,
      "all-over": {
        status: "says-yes",
        sourceUrl: "https://printify.com/all-over-print/",
        saw: "Most print providers use sublimation with cut-and-sew construction.",
      },
      "cut-and-sew": {
        status: "says-yes",
        sourceUrl: "https://printify.com/all-over-print/",
        saw: "The fabric is printed before it is sewn into the garment.",
        note: "Only as part of all-over print.",
      },
      screen: NOT_CHECKED,
    },
  },
  {
    id: "contrado",
    name: "Contrado",
    checkedOn: CHECKED,
    wiredIn: false,
    whoMakesIt: {
      status: "says-yes",
      sourceUrl: "https://www.contrado.com/",
      saw: "Made by us in our facility.",
    },
    noMinimum: {
      status: "says-yes",
      sourceUrl: "https://www.contrado.com/",
      saw: "No minimums. Order one or twenty.",
    },
    methods: {
      dtg: NOT_CHECKED,
      dtf: NOT_CHECKED,
      embroidery: NOT_CHECKED,
      puff: NOT_CHECKED,
      "all-over": {
        status: "says-yes",
        sourceUrl: "https://www.contrado.com/",
        saw: "Sublimation printing is listed among its print methods.",
      },
      "cut-and-sew": {
        status: "says-yes",
        sourceUrl: "https://www.contrado.com/",
        saw: "Cut and sew manufacturing is named in the site menu.",
        note: "We read the name only, not the details.",
      },
      screen: NOT_CHECKED,
    },
  },
  {
    id: "gooten",
    name: "Gooten",
    checkedOn: CHECKED,
    wiredIn: false,
    whoMakesIt: {
      status: "says-yes",
      sourceUrl: "https://www.gooten.com/",
      saw: "A network of vetted suppliers and decorators.",
    },
    noMinimum: NOT_CHECKED,
    methods: {
      dtg: {
        status: "says-yes",
        sourceUrl: "https://www.gooten.com/products/",
        saw: "DTG is a print technique filter in its catalog.",
      },
      dtf: {
        status: "says-yes",
        sourceUrl: "https://www.gooten.com/products/",
        saw: "DTF is a print technique filter in its catalog.",
      },
      embroidery: {
        status: "says-yes",
        sourceUrl: "https://www.gooten.com/products/",
        saw: "Embroidery is a print technique filter in its catalog.",
      },
      puff: NOT_CHECKED,
      "all-over": {
        status: "says-yes",
        sourceUrl: "https://www.gooten.com/products/",
        saw: "All over print is a collection, and dye sublimation is a technique filter.",
      },
      "cut-and-sew": NOT_CHECKED,
      screen: NOT_CHECKED,
    },
  },
];

/** Makers whose own site says they do every method asked for. */
export function makersFor(methods: MethodId[], makers: Maker[] = MAKERS): Maker[] {
  return makers.filter((maker) =>
    methods.every((method) => maker.methods[method].status === "says-yes"),
  );
}

/** The same, kept to makers the studio can already send an order to. */
export function routableMakersFor(methods: MethodId[], makers: Maker[] = MAKERS): Maker[] {
  return makersFor(methods, makers).filter((maker) => maker.wiredIn);
}

/** Every source page behind the table, once each. */
export function sourcesOf(maker: Maker): string[] {
  const claims: Claim[] = [maker.whoMakesIt, maker.noMinimum, ...Object.values(maker.methods)];
  const urls = claims.flatMap((claim) => (claim.status === "says-yes" ? [claim.sourceUrl] : []));
  return [...new Set(urls)];
}
