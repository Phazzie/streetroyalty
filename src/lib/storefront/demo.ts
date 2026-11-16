import type { StoreCatalog, StoreImage, StoreProduct, StoreVariant } from "./types.ts";

/**
 * The preview drop. It stands in for the Fourthwall shop until a storefront
 * token is set, so the shop pages are never empty. Nothing here can be bought.
 */

const SIZES = ["S", "M", "L", "XL", "2XL"];

function flat(file: string, alt: string): StoreImage {
  return { url: `/brand/${file}.webp`, width: 864, height: 1152, alt };
}

function worn(url: string, width: number, height: number, alt: string): StoreImage {
  return { url, width, height, alt };
}

function sized(
  slug: string,
  priceCents: number,
  color: string,
  swatch: string,
  imageUrl: string,
): StoreVariant[] {
  return SIZES.map((size) => ({
    id: `demo:${slug}:${size}`,
    label: `${color} / ${size}`,
    color,
    swatch,
    size,
    priceCents,
    available: true,
    imageUrl,
  }));
}

function oneSize(
  slug: string,
  priceCents: number,
  color: string,
  swatch: string,
  imageUrl: string,
): StoreVariant[] {
  return [
    {
      id: `demo:${slug}:one`,
      label: color,
      color,
      swatch,
      priceCents,
      available: true,
      imageUrl,
    },
  ];
}

const FIT = {
  title: "Size and fit",
  body: [
    "Relaxed through the body with a dropped shoulder.",
    "Between sizes, take the smaller one.",
  ],
};

const PREVIEW = {
  title: "Preview drop",
  body: [
    "This piece is part of the preview drop. Prices and sizes are placeholders until the shop is connected.",
  ],
};

const LILAC = "#b9a3ee";
const MINT = "#a5dccb";
const CREAM = "#f3ead9";
const NIGHT = "#2a2a2e";

const products: StoreProduct[] = [
  {
    id: "demo-lilac-hoodie",
    slug: "lilac-set-hoodie",
    name: "The Lilac Hoodie",
    kind: "Hoodie",
    blurb: "Lilac fleece, cream panels, orange piping.",
    description: [
      "The top half of the Lilac Set. Lilac fleece with cream panels down the sleeves and sides, outlined in thin orange piping.",
      "Wear it with the Lilac Jogger and the block lines up from shoulder to ankle.",
    ],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-lilac-hoodie", "Lilac hoodie laid flat, cream panels and orange piping"),
      worn("/wild/side-lilac.jpg", 600, 900, "The Lilac Set worn, front view"),
      worn("/model/lilac.jpg", 619, 1100, "The Lilac Hoodie worn at a cafe table"),
    ],
    priceCents: 11800,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Lilac", swatch: LILAC }],
    sizes: SIZES,
    variants: sized("lilac-set-hoodie", 11800, "Lilac", LILAC, "/brand/prod-lilac-hoodie.webp"),
    collection: "sets",
    badge: "The Lilac Set",
    pairsWith: ["lilac-set-jogger", "crown-cap"],
  },
  {
    id: "demo-lilac-jogger",
    slug: "lilac-set-jogger",
    name: "The Lilac Jogger",
    kind: "Jogger",
    blurb: "Lilac fleece with a cream stripe down each leg.",
    description: [
      "The bottom half of the Lilac Set. A cream stripe and orange piping run the full outer leg, into a ribbed cuff.",
    ],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-lilac-jogger", "Lilac joggers laid flat, cream stripe down each leg"),
      worn("/wild/side-lilac.jpg", 600, 900, "The Lilac Set worn, front view"),
      worn("/wild/bowtie.jpg", 600, 900, "The Lilac Set worn with a bow tie"),
    ],
    priceCents: 9800,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Lilac", swatch: LILAC }],
    sizes: SIZES,
    variants: sized("lilac-set-jogger", 9800, "Lilac", LILAC, "/brand/prod-lilac-jogger.webp"),
    collection: "sets",
    badge: "The Lilac Set",
    pairsWith: ["lilac-set-hoodie", "crown-tee"],
  },
  {
    id: "demo-mint-hoodie",
    slug: "mint-set-hoodie",
    name: "The Mint Hoodie",
    kind: "Hoodie",
    blurb: "Mint fleece, peach stripe, blue piping.",
    description: [
      "The top half of the Mint Set. Mint fleece with a peach lined hood and a peach stripe down each sleeve, edged in blue piping.",
    ],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-mint-hoodie", "Mint hoodie laid flat, peach hood lining and sleeve stripe"),
      worn("/wild/side-mint.jpg", 600, 900, "The Mint Set worn, front view"),
      worn("/model/mint.jpg", 619, 1100, "The Mint Set worn on a city pavement"),
    ],
    priceCents: 11800,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Mint", swatch: MINT }],
    sizes: SIZES,
    variants: sized("mint-set-hoodie", 11800, "Mint", MINT, "/brand/prod-mint-hoodie.webp"),
    collection: "sets",
    badge: "The Mint Set",
    pairsWith: ["mint-set-jogger", "royal-cup"],
  },
  {
    id: "demo-mint-jogger",
    slug: "mint-set-jogger",
    name: "The Mint Jogger",
    kind: "Jogger",
    blurb: "Mint fleece with a peach stripe down each leg.",
    description: [
      "The bottom half of the Mint Set. A peach stripe and blue piping run the full outer leg, into a ribbed cuff.",
    ],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-mint-jogger", "Mint joggers laid flat, peach stripe down each leg"),
      worn("/wild/side-mint.jpg", 600, 900, "The Mint Set worn, front view"),
      worn("/wild/stride.jpg", 600, 900, "The Mint Set worn mid stride"),
    ],
    priceCents: 9800,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Mint", swatch: MINT }],
    sizes: SIZES,
    variants: sized("mint-set-jogger", 9800, "Mint", MINT, "/brand/prod-mint-jogger.webp"),
    collection: "sets",
    badge: "The Mint Set",
    pairsWith: ["mint-set-hoodie", "night-crown-tee"],
  },
  {
    id: "demo-crown-tee",
    slug: "crown-tee",
    name: "Crown Tee, Cream",
    kind: "Tee",
    blurb: "Boxy cream tee with a lilac crown on the chest.",
    description: [
      "A boxy cream tee with a small lilac crown stitched on the left chest. It sits under either hoodie.",
    ],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-crown-tee", "Cream t-shirt laid flat with a small lilac crown on the chest"),
    ],
    priceCents: 4200,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Cream", swatch: CREAM }],
    sizes: SIZES,
    variants: sized("crown-tee", 4200, "Cream", CREAM, "/brand/prod-crown-tee.webp"),
    collection: "tees",
    pairsWith: ["lilac-set-jogger", "crown-cap"],
  },
  {
    id: "demo-night-crown-tee",
    slug: "night-crown-tee",
    name: "Crown Tee, Night",
    kind: "Tee",
    blurb: "Washed black tee with a lime crown on the chest.",
    description: ["The same boxy tee in washed black, with the crown stitched in lime."],
    details: [FIT, PREVIEW],
    images: [
      flat("prod-night-tee", "Washed black t-shirt laid flat with a small lime crown on the chest"),
    ],
    priceCents: 4200,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Night", swatch: NIGHT }],
    sizes: SIZES,
    variants: sized("night-crown-tee", 4200, "Night", NIGHT, "/brand/prod-night-tee.webp"),
    collection: "tees",
    pairsWith: ["mint-set-jogger", "crown-cap"],
  },
  {
    id: "demo-crown-cap",
    slug: "crown-cap",
    name: "Crown Cap",
    kind: "Cap",
    blurb: "Washed lilac cap with a cream crown.",
    description: [
      "A soft six-panel cap in washed lilac with a cream crown stitched on the front. One size, strap at the back.",
    ],
    details: [PREVIEW],
    images: [flat("prod-crown-cap", "Lilac cap with a cream crown stitched on the front")],
    priceCents: 3600,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Lilac", swatch: LILAC }],
    sizes: [],
    variants: oneSize("crown-cap", 3600, "Lilac", LILAC, "/brand/prod-crown-cap.webp"),
    collection: "extras",
    pairsWith: ["lilac-set-hoodie", "crown-tee"],
  },
  {
    id: "demo-royal-cup",
    slug: "royal-cup",
    name: "Royal Cup",
    kind: "Cup",
    blurb: "Mint espresso cup and saucer with a gold crown.",
    description: [
      "The cup from every photo. Matte mint ceramic with a gold rim and a small gold crown, on a matching saucer.",
    ],
    details: [PREVIEW],
    images: [
      flat("prod-royal-cup", "Mint espresso cup and saucer with a gold rim and a gold crown"),
    ],
    priceCents: 2800,
    currency: "USD",
    soldOut: false,
    colors: [{ name: "Mint", swatch: MINT }],
    sizes: [],
    variants: oneSize("royal-cup", 2800, "Mint", MINT, "/brand/prod-royal-cup.webp"),
    collection: "extras",
    pairsWith: ["mint-set-hoodie", "night-crown-tee"],
  },
];

export const demoCatalog: StoreCatalog = {
  source: "demo",
  shopName: "Street Royalty",
  currency: "USD",
  collections: [
    { slug: "sets", name: "The sets" },
    { slug: "tees", name: "Tees" },
    { slug: "extras", name: "Extras" },
  ],
  products,
};

export function isDemoVariantId(id: string): boolean {
  return id.startsWith("demo:");
}
