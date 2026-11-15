import type { StoreCollection, StoreImage, StoreProduct, StoreVariant } from "./types.ts";

/**
 * Pure mapping from Fourthwall Storefront API JSON to the app's product shape.
 * Everything here takes `unknown` so a changed or partial response cannot throw
 * in a render path; a product that cannot be sold is dropped instead.
 */

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Fourthwall money is a decimal number in major units. Cents are integers here. */
export function moneyToCents(value: unknown): number | null {
  const money = asObject(value);
  const amount = Number(money?.value);
  if (!money || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Product copy arrives as HTML. It is reduced to plain paragraphs so it can be
 * rendered as text, which keeps shop-entered markup out of the page.
 */
export function htmlToParagraphs(html: string): string[] {
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/?\s*(p|div|li|ul|ol|h[1-6]|tr)(\s[^>]*)?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (entity) => ENTITIES[entity] ?? " ");
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function safeHttps(value: unknown): string {
  const url = asString(value);
  return url.startsWith("https://") ? url : "";
}

function mapImage(raw: unknown, alt: string): StoreImage | null {
  const image = asObject(raw);
  const url = safeHttps(image?.transformedUrl) || safeHttps(image?.url);
  if (!url) return null;
  const width = Number(image?.width);
  const height = Number(image?.height);
  return {
    url,
    width: Number.isFinite(width) && width > 0 ? width : 1000,
    height: Number.isFinite(height) && height > 0 ? height : 1250,
    alt,
  };
}

function variantAvailable(stock: unknown): boolean {
  const info = asObject(stock);
  if (!info) return true;
  if (asString(info.type).toUpperCase() !== "LIMITED") return true;
  return Number(info.inStock) > 0;
}

function mapVariant(raw: unknown): StoreVariant | null {
  const variant = asObject(raw);
  const id = asString(variant?.id);
  const priceCents = moneyToCents(variant?.unitPrice);
  if (!variant || !id || priceCents === null) return null;
  const attributes = asObject(variant.attributes);
  const color = asObject(attributes?.color);
  const size = asObject(attributes?.size);
  const colorName = asString(color?.name) || undefined;
  const sizeName = asString(size?.name) || undefined;
  const swatch = asString(color?.swatch);
  const compareAt = moneyToCents(variant.compareAtPrice);
  const firstImage = asArray(variant.images)
    .map((image) => mapImage(image, ""))
    .find(Boolean);
  return {
    id,
    label:
      asString(attributes?.description) ||
      [colorName, sizeName].filter(Boolean).join(" / ") ||
      asString(variant.name),
    color: colorName,
    swatch: /^#[0-9a-f]{3,8}$/i.test(swatch) ? swatch : undefined,
    size: sizeName,
    priceCents,
    compareAtCents: compareAt !== null && compareAt > priceCents ? compareAt : undefined,
    available: variantAvailable(variant.stock),
    imageUrl: firstImage?.url,
  };
}

function kindFromName(name: string): string {
  const lower = name.toLowerCase();
  const words: [string, string][] = [
    ["hoodie", "Hoodie"],
    ["jogger", "Jogger"],
    ["sweatpant", "Jogger"],
    ["crewneck", "Crewneck"],
    ["sweatshirt", "Crewneck"],
    ["long sleeve", "Long sleeve"],
    ["t-shirt", "Tee"],
    ["tee", "Tee"],
    ["shirt", "Tee"],
    ["cap", "Cap"],
    ["hat", "Cap"],
    ["beanie", "Beanie"],
    ["mug", "Cup"],
    ["cup", "Cup"],
    ["tote", "Bag"],
    ["bag", "Bag"],
    ["sticker", "Sticker"],
    ["poster", "Poster"],
  ];
  // Whole words only: "steel mug" is not a tee and "landscape poster" is not a cap.
  const has = (word: string) =>
    new RegExp(`(^|[^a-z])${word.replace("-", "[- ]?")}s?([^a-z]|$)`).test(lower);
  return words.find(([word]) => has(word))?.[1] ?? "Piece";
}

export function mapFourthwallProduct(raw: unknown): StoreProduct | null {
  const product = asObject(raw);
  if (!product) return null;
  // Bundles have no variants of their own and need a different picker. They are skipped for now.
  if (asString(product.type).toUpperCase() === "BUNDLE") return null;
  const id = asString(product.id);
  const slug = asString(product.slug);
  const name = asString(product.name).trim();
  if (!id || !slug || !name) return null;
  const variants = asArray(product.variants)
    .map(mapVariant)
    .filter((variant): variant is StoreVariant => variant !== null);
  if (variants.length === 0) return null;
  const images = asArray(product.images)
    .map((image) => mapImage(image, name))
    .filter((image): image is StoreImage => image !== null);
  const fallback = variants.find((variant) => variant.imageUrl)?.imageUrl;
  if (images.length === 0 && fallback)
    images.push({ url: fallback, width: 1000, height: 1250, alt: name });
  if (images.length === 0) return null;

  const colors: { name: string; swatch: string }[] = [];
  const sizes: string[] = [];
  for (const variant of variants) {
    if (variant.color && !colors.some((color) => color.name === variant.color)) {
      colors.push({ name: variant.color, swatch: variant.swatch ?? "#888888" });
    }
    if (variant.size && !sizes.includes(variant.size)) sizes.push(variant.size);
  }
  const cheapest = variants.reduce(
    (low, variant) => (variant.priceCents < low.priceCents ? variant : low),
    variants[0],
  );
  const description = htmlToParagraphs(asString(product.description));
  const state = asString(asObject(product.state)?.type).toUpperCase();
  const details = asArray(product.additionalInformation)
    .map((entry) => {
      const info = asObject(entry);
      const title = asString(info?.title).trim();
      const body = htmlToParagraphs(asString(info?.bodyHtml));
      return title && body.length > 0 ? { title, body } : null;
    })
    .filter((detail): detail is { title: string; body: string[] } => detail !== null)
    .slice(0, 4);

  return {
    id,
    slug,
    name,
    kind: kindFromName(name),
    blurb: description[0]?.slice(0, 120) ?? "",
    description,
    details,
    images,
    priceCents: cheapest.priceCents,
    compareAtCents: cheapest.compareAtCents,
    currency:
      asString(asObject(asObject(asArray(product.variants)[0])?.unitPrice)?.currency) || "USD",
    soldOut: state === "SOLD_OUT" || variants.every((variant) => !variant.available),
    colors,
    sizes,
    variants,
    pairsWith: [],
  };
}

export function mapFourthwallProducts(payload: unknown): {
  products: StoreProduct[];
  hasNextPage: boolean;
} {
  const body = asObject(payload);
  const products = asArray(body?.results)
    .map(mapFourthwallProduct)
    .filter((product): product is StoreProduct => product !== null);
  return { products, hasNextPage: asObject(body?.paging)?.hasNextPage === true };
}

export function mapFourthwallCollections(payload: unknown): StoreCollection[] {
  return asArray(asObject(payload)?.results)
    .map((entry) => {
      const collection = asObject(entry);
      const slug = asString(collection?.slug);
      const name = asString(collection?.name).trim();
      return slug && name && slug !== "all" ? { slug, name } : null;
    })
    .filter((collection): collection is StoreCollection => collection !== null);
}

/** Fourthwall reports either a bare shop handle or a full host. Checkout always needs a host. */
export function checkoutHost(shop: unknown, override?: string): string | null {
  const clean = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
  const valid = (host: string) =>
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
  if (override) {
    const host = clean(override);
    return valid(host) ? host : null;
  }
  const domain = clean(asString(asObject(shop)?.domain));
  if (!domain) return null;
  const host = domain.includes(".") ? domain : `${domain}.fourthwall.com`;
  return valid(host) ? host : null;
}

export function checkoutUrl(host: string, cartId: string, currency: string): string {
  const params = new URLSearchParams({ cartCurrency: currency, cartId });
  return `https://${host}/checkout/?${params.toString()}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFourthwallVariantId(id: string): boolean {
  return UUID.test(id);
}

/** Attach "finish the outfit" picks to live products, which carry no such data of their own. */
export function withPairings(products: StoreProduct[]): StoreProduct[] {
  return products.map((product) => {
    const others = products.filter((other) => other.slug !== product.slug && !other.soldOut);
    const different = others.filter((other) => other.kind !== product.kind);
    const picks = [...different, ...others.filter((other) => other.kind === product.kind)].slice(
      0,
      3,
    );
    return { ...product, pairsWith: picks.map((pick) => pick.slug) };
  });
}
