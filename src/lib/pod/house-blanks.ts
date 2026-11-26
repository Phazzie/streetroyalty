/**
 * The regular (placement-printed) pieces the studio sells. Each one is a real
 * Printful catalog product, read from the public v1 API on 2026-11-26:
 * `GET https://api.printful.com/products/{id}` gives the variant ids, colour
 * hexes, wholesale prices, stock and the placement surcharges below.
 *
 * The sandbox serves these same products, colours and sizes, so a piece built
 * in sandbox is the piece Printful makes once the shop goes live. Sandbox ids
 * (`tee-heavy`, …) stay as they were so saved designs and carts still open.
 *
 * Only DTG placements are listed. Embroidery, DTF and label placements need a
 * different kind of file from the one the studio exports, so they are left out.
 */
import { AOP_DPI } from "./aop-printful.ts";
import type { PrintArea } from "./types.ts";

export type HouseColor = {
  code: string;
  name: string;
  hex: string;
  /** Printful catalog variant id per size label, and whether Printful had it in stock. */
  variants: Record<string, { id: number; cents: number; inStock: boolean }>;
};

export type HousePlacement = {
  placement: string;
  title: string;
  /** Printful's wholesale surcharge for printing this spot, in cents. */
  extraCents: number;
  /**
   * Print area the sandbox shows. Printful's own sizes need the API key, so in
   * live mode the studio reads them from Printful instead of from here.
   */
  widthIn: number;
  heightIn: number;
};

export type HouseBlank = {
  /** Sandbox product id. Saved designs use it. */
  id: string;
  printfulId: number;
  name: string;
  model: string;
  type: string;
  description: string;
  technique: "dtg";
  placements: HousePlacement[];
  sizes: string[];
  colors: HouseColor[];
  shape: "tee" | "hoodie" | "crew" | "tote" | "joggers";
};

type Row = [size: string, id: number, dollars: number, inStock?: 0 | 1];

function color(code: string, name: string, hex: string, rows: Row[]): HouseColor {
  return {
    code,
    name,
    hex,
    variants: Object.fromEntries(
      rows.map(([size, id, dollars, inStock = 1]) => [
        size,
        { id, cents: Math.round(dollars * 100), inStock: inStock === 1 },
      ]),
    ),
  };
}

function spot(
  placement: string,
  title: string,
  extraDollars: number,
  widthIn: number,
  heightIn: number,
): HousePlacement {
  return { placement, title, extraCents: Math.round(extraDollars * 100), widthIn, heightIn };
}

/** Prices by size, the same across a product's colours. */
function sized(ids: number[], sizes: string[], prices: number[], stock: (0 | 1)[] = []): Row[] {
  return sizes.map((size, index) => [size, ids[index]!, prices[index]!, stock[index] ?? 1]);
}

const TEE_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const TEE_PRICES = [15.6, 15.6, 15.6, 15.6, 17.6, 19.6, 21.6];
const HOODIE_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const HOODIE_PRICES = [27.84, 27.84, 27.84, 27.84, 29.84, 31.84];
const CREW_PRICES = [24.53, 24.53, 24.53, 24.53, 26.53, 28.53];
const LONG_PRICES = [20.01, 20.01, 20.01, 20.01, 22.01, 24.01];
const PANTS_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const PANTS_PRICES = [29.98, 29.98, 29.98, 29.98, 29.98, 31.98];

export const HOUSE_BLANKS: readonly HouseBlank[] = [
  {
    id: "tee-heavy",
    printfulId: 586,
    name: "Heavyweight Tee",
    model: "Comfort Colors 1717",
    type: "T-Shirt",
    description:
      "Garment-dyed heavyweight tee, 100% ring-spun cotton, relaxed fit. Prints on the front, the back and both sleeves.",
    technique: "dtg",
    placements: [
      spot("front", "Front", 0, 12, 16),
      spot("back", "Back", 5.95, 12, 16),
      spot("sleeve_left", "Left sleeve", 2.49, 3.5, 3.5),
      spot("sleeve_right", "Right sleeve", 2.49, 3.5, 3.5),
    ],
    sizes: TEE_SIZES,
    colors: [
      color("black", "Black", "#1b1b1c", sized([15114, 15115, 15116, 15117, 15118, 16326, 17500], TEE_SIZES, TEE_PRICES)),
      color("ivory", "Ivory", "#fff4d9", sized([16523, 16524, 16525, 16526, 16527, 16528, 17507], TEE_SIZES, TEE_PRICES)),
      color("white", "White", "#ffffff", sized([15124, 15125, 15126, 15127, 15128, 16335, 17508], TEE_SIZES, TEE_PRICES)),
      color("pepper", "Pepper", "#514f4c", sized([17693, 17694, 17695, 17696, 17697, 17698, 17699], TEE_SIZES, TEE_PRICES)),
      color("chalky-mint", "Chalky Mint", "#a1f2dc", sized([21513, 21514, 21515, 21516, 21517, 21518, 21519], TEE_SIZES, TEE_PRICES)),
      color("orchid", "Orchid", "#ead3f2", sized([21257, 21258, 21259, 21260, 21261, 21262, 21263], TEE_SIZES, TEE_PRICES)),
      color("violet", "Violet", "#9a8ad2", sized([15186, 15187, 15188, 15189, 15190, 16333, 17502], TEE_SIZES, TEE_PRICES)),
    ],
    shape: "tee",
  },
  {
    id: "hoodie-pullover",
    printfulId: 380,
    name: "Premium Pullover Hoodie",
    model: "Cotton Heritage M2580",
    type: "Hoodie",
    description:
      "Cotton-face fleece pullover with a pouch pocket. Prints on the front, the back and down both sleeves. Runs small.",
    technique: "dtg",
    placements: [
      spot("front", "Front", 0, 12, 12),
      spot("back", "Back", 5.95, 12, 16),
      spot("sleeve_left", "Left sleeve", 5.95, 3.5, 12),
      spot("sleeve_right", "Right sleeve", 5.95, 3.5, 12),
    ],
    sizes: HOODIE_SIZES,
    colors: [
      color("black", "Black", "#080808", sized([10779, 10780, 10781, 10782, 10783, 13416], HOODIE_SIZES, HOODIE_PRICES)),
      color("bone", "Bone", "#f5e8ce", sized([20284, 20285, 20286, 20287, 20288, 20289], HOODIE_SIZES, HOODIE_PRICES)),
      color("white", "White", "#ffffff", sized([10774, 10775, 10776, 10777, 10778, 13421], HOODIE_SIZES, HOODIE_PRICES)),
      color("lavender", "Lavender", "#ffdcf3", sized([25005, 25006, 25007, 25008, 25009, 25010], HOODIE_SIZES, HOODIE_PRICES)),
      color("dusty-rose", "Dusty Rose", "#d27e6f", sized([13887, 13888, 13889, 13890, 13891, 13892], HOODIE_SIZES, HOODIE_PRICES)),
      color("sky-blue", "Sky Blue", "#d6edf7", sized([13917, 13918, 13919, 13920, 13921, 13922], HOODIE_SIZES, HOODIE_PRICES)),
      color("forest-green", "Forest Green", "#335231", sized([16162, 16163, 16164, 16165, 16166, 16167], HOODIE_SIZES, HOODIE_PRICES)),
    ],
    shape: "hoodie",
  },
  {
    id: "crew-sweat",
    printfulId: 411,
    name: "Premium Crewneck",
    model: "Cotton Heritage M2480",
    type: "Sweatshirt",
    description:
      "Cotton-face 3-end fleece crew with ribbed cuffs. Prints on the front, the back and down both sleeves.",
    technique: "dtg",
    placements: [
      spot("front", "Front", 0, 12, 14),
      spot("back", "Back", 5.95, 12, 16),
      spot("sleeve_left", "Left sleeve", 5.95, 3.5, 12),
      spot("sleeve_right", "Right sleeve", 5.95, 3.5, 12),
    ],
    sizes: HOODIE_SIZES,
    colors: [
      color("black", "Black", "#101010", sized([11254, 11255, 11256, 11257, 11258, 13258], HOODIE_SIZES, CREW_PRICES)),
      color("bone", "Bone", "#f5e8ce", sized([20357, 20356, 20355, 20354, 20353, 20352], HOODIE_SIZES, CREW_PRICES)),
      color("white", "White", "#ffffff", sized([11249, 11250, 11251, 11252, 11253, 13261], HOODIE_SIZES, CREW_PRICES)),
      color("vintage-black", "Vintage Black", "#43413d", sized([20363, 20362, 20361, 20360, 20359, 20358], HOODIE_SIZES, CREW_PRICES)),
      color("lavender", "Lavender", "#ffdcf3", sized([25550, 25551, 25552, 25553, 25554, 25555], HOODIE_SIZES, CREW_PRICES)),
      color("agave", "Agave", "#c0d7d2", sized([13950, 13951, 13952, 13953, 13954, 13955], HOODIE_SIZES, CREW_PRICES)),
      color("dusty-rose", "Dusty Rose", "#f59382", sized([13863, 13864, 13865, 13866, 13867, 13868], HOODIE_SIZES, CREW_PRICES)),
    ],
    shape: "crew",
  },
  {
    id: "longsleeve-block",
    printfulId: 753,
    name: "Heavyweight Long-Sleeve",
    model: "Comfort Colors 6014",
    type: "Long-Sleeve",
    description:
      "Garment-dyed heavyweight long-sleeve, 100% ring-spun cotton. Prints on the front, the back and down both sleeves.",
    technique: "dtg",
    placements: [
      spot("front", "Front", 0, 12, 16),
      spot("back", "Back", 5.95, 12, 16),
      spot("sleeve_left", "Left sleeve", 5.95, 3.5, 12),
      spot("sleeve_right", "Right sleeve", 5.95, 3.5, 12),
    ],
    sizes: HOODIE_SIZES,
    colors: [
      color("black", "Black", "#080808", sized([19412, 19419, 19426, 19433, 19440, 19447], HOODIE_SIZES, LONG_PRICES)),
      color("white", "White", "#ffffff", sized([19418, 19425, 19432, 19439, 19446, 19453], HOODIE_SIZES, LONG_PRICES, [1, 1, 1, 1, 0, 0])),
      color("blue-jean", "Blue Jean", "#6b7c8f", sized([19413, 19420, 19427, 19434, 19441, 19448], HOODIE_SIZES, LONG_PRICES)),
      color("violet", "Violet", "#9a8ad2", sized([19417, 19424, 19431, 19438, 19445, 19452], HOODIE_SIZES, LONG_PRICES, [1, 1, 1, 1, 0, 0])),
    ],
    shape: "tee",
  },
  {
    id: "jogger-court",
    printfulId: 412,
    name: "Fleece Sweatpants",
    model: "Cotton Heritage M7580",
    type: "Joggers",
    description:
      "Cotton-face fleece sweatpants with cuffed legs and front pockets. Each leg prints front and back.",
    technique: "dtg",
    placements: [
      spot("leg_front_left", "Left leg, front", 5.95, 4.5, 13),
      spot("leg_front_right", "Right leg, front", 5.95, 4.5, 13),
      spot("leg_back_left", "Left leg, back", 5.95, 4.5, 13),
      spot("leg_back_right", "Right leg, back", 5.95, 4.5, 13),
    ],
    sizes: PANTS_SIZES,
    colors: [
      color("black", "Black", "#141414", sized([11265, 11266, 11267, 11268, 11269, 11270], PANTS_SIZES, PANTS_PRICES)),
      color("white", "White", "#ffffff", sized([11271, 11272, 11273, 11274, 11275, 11276], PANTS_SIZES, PANTS_PRICES)),
      color("carbon-grey", "Carbon Grey", "#d2cec6", sized([11277, 11278, 11279, 11280, 11281, 11282], PANTS_SIZES, PANTS_PRICES)),
      color("dusty-rose", "Dusty Rose", "#f59382", sized([13833, 13834, 13835, 13836, 13837, 13838], PANTS_SIZES, PANTS_PRICES)),
      color("navy-blazer", "Navy Blazer", "#171f2c", sized([13851, 13852, 13853, 13854, 13855, 13856], PANTS_SIZES, PANTS_PRICES)),
      color("military-green", "Military Green", "#5c4f32", sized([13845, 13846, 13847, 13848, 13849, 13850], PANTS_SIZES, PANTS_PRICES)),
    ],
    shape: "joggers",
  },
  {
    id: "tote-corner",
    printfulId: 367,
    name: "Eco Tote",
    model: "Econscious EC8000",
    type: "Tote",
    description:
      "Organic cotton twill tote, 16 by 14.5 inches with a 5-inch gusset. Prints on both sides.",
    technique: "dtg",
    placements: [spot("front", "Front", 0, 12, 12), spot("back", "Back", 5.95, 12, 12)],
    sizes: ["One size"],
    colors: [
      color("black", "Black", "#101010", [["One size", 10457, 15.87]]),
      color("oyster", "Oyster", "#edcea5", [["One size", 10458, 15.87]]),
    ],
    shape: "tote",
  },
];

/** Sandbox ids of the regular pieces, in studio order. */
export const HOUSE_BLANK_IDS = HOUSE_BLANKS.map((blank) => blank.id);

export function houseBlank(id: string): HouseBlank | null {
  return HOUSE_BLANKS.find((blank) => blank.id === id) ?? null;
}

export function houseBlankByPrintfulId(id: string | number): HouseBlank | null {
  return HOUSE_BLANKS.find((blank) => String(blank.printfulId) === String(id)) ?? null;
}

/** Every Printful variant id of a blank, across colours and sizes. */
export function houseVariantIds(blank: HouseBlank): string[] {
  return blank.colors.flatMap((item) => Object.values(item.variants).map((v) => String(v.id)));
}

export function houseAreas(blank: HouseBlank): PrintArea[] {
  return blank.placements.map((item) => ({
    placement: item.placement,
    widthIn: item.widthIn,
    heightIn: item.heightIn,
    dpi: AOP_DPI,
  }));
}

/**
 * What printing these spots adds to the wholesale price, in cents. Printful
 * charges each spot's surcharge; the front carries none.
 */
export function placementExtraCents(blank: HouseBlank | null, placements: readonly string[]): number {
  if (!blank) return 0;
  return [...new Set(placements)].reduce(
    (sum, key) => sum + (blank.placements.find((item) => item.placement === key)?.extraCents ?? 0),
    0,
  );
}

/** Size code used in sandbox variant ids: "M" → "m", "One size" → "one-size". */
export function sizeCode(size: string): string {
  return size.trim().toLowerCase().replaceAll(" ", "-");
}

/**
 * The Printful variant for a sandbox variant id (`tee-heavy-black-m`), so a
 * piece made in sandbox can be ordered once the shop is live. Null for any
 * other id.
 */
export function printfulVariantFor(sandboxVariantId: string): string | null {
  for (const blank of HOUSE_BLANKS) {
    if (!sandboxVariantId.startsWith(`${blank.id}-`)) continue;
    const rest = sandboxVariantId.slice(blank.id.length + 1);
    for (const item of blank.colors) {
      if (!rest.startsWith(`${item.code}-`)) continue;
      const code = rest.slice(item.code.length + 1);
      const found = Object.entries(item.variants).find(([size]) => sizeCode(size) === code);
      if (found) return String(found[1].id);
    }
  }
  return null;
}
