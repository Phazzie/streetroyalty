/** Storefront types shared by the Fourthwall shop and the built-in preview drop. Safe for client code. */

export type StoreSource = "fourthwall" | "demo";

export type StoreImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

export type StoreVariant = {
  id: string;
  label: string;
  color?: string;
  swatch?: string;
  size?: string;
  priceCents: number;
  compareAtCents?: number;
  available: boolean;
  imageUrl?: string;
};

export type StoreDetail = {
  title: string;
  body: string[];
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  /** Short garment word used for search and the card caption: Hoodie, Jogger, Tee. */
  kind: string;
  blurb: string;
  description: string[];
  details: StoreDetail[];
  images: StoreImage[];
  priceCents: number;
  compareAtCents?: number;
  currency: string;
  soldOut: boolean;
  colors: { name: string; swatch: string }[];
  sizes: string[];
  variants: StoreVariant[];
  collection?: string;
  /** Every collection the piece is in, when it is in more than the one above. */
  collections?: string[];
  badge?: string;
  /** Slugs that finish the outfit. */
  pairsWith: string[];
};

export type StoreCollection = {
  slug: string;
  name: string;
};

export type StoreCatalog = {
  source: StoreSource;
  shopName: string;
  currency: string;
  collections: StoreCollection[];
  products: StoreProduct[];
  /** Set when the live shop could not be read. The page shows it instead of an empty shelf. */
  notice?: string;
};

export type BagLine = {
  variantId: string;
  slug: string;
  name: string;
  variantLabel: string;
  priceCents: number;
  imageUrl: string;
  quantity: number;
};

export type CheckoutStart = { mode: "fourthwall"; url: string } | { mode: "demo" };

export const MAX_LINE_QUANTITY = 10;
export const MAX_BAG_LINES = 20;
