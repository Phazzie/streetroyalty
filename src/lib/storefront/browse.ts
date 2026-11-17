import type { StoreProduct, StoreVariant } from "./types.ts";

export type ShopSort = "featured" | "low" | "high";

/** Shelf filtering. Every search word has to appear somewhere on the product. */
export function filterProducts(
  products: StoreProduct[],
  filter: { collection: string; query: string },
): StoreProduct[] {
  const words = filter.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .slice(0, 6);
  return products.filter((product) => {
    if (
      filter.collection !== "all" &&
      product.collection !== filter.collection &&
      !product.collections?.includes(filter.collection)
    )
      return false;
    if (words.length === 0) return true;
    const text = [
      product.name,
      product.kind,
      product.blurb,
      product.badge ?? "",
      ...product.colors.map((color) => color.name),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function sortProducts(products: StoreProduct[], sort: ShopSort): StoreProduct[] {
  if (sort === "featured") return products;
  const sign = sort === "low" ? 1 : -1;
  return [...products].sort((a, b) => sign * (a.priceCents - b.priceCents));
}

/** The variant a shopper has picked, or null while a size is still needed. */
export function pickVariant(
  product: StoreProduct,
  choice: { color?: string; size?: string },
): StoreVariant | null {
  const byColor =
    product.colors.length > 0
      ? product.variants.filter((variant) => variant.color === choice.color)
      : product.variants;
  const pool = byColor.length > 0 ? byColor : product.variants;
  if (product.sizes.length === 0) return pool[0] ?? null;
  if (!choice.size) return null;
  return pool.find((variant) => variant.size === choice.size) ?? null;
}

/** Whether a size can be bought in the chosen colour. */
export function sizeAvailable(
  product: StoreProduct,
  color: string | undefined,
  size: string,
): boolean {
  return product.variants.some(
    (variant) =>
      variant.size === size &&
      variant.available &&
      (product.colors.length === 0 || variant.color === color),
  );
}

export function defaultColor(product: StoreProduct): string | undefined {
  const available = product.variants.find((variant) => variant.available && variant.color);
  return available?.color ?? product.colors[0]?.name;
}
