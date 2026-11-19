/** Payloads in the shape the Fourthwall Storefront API returns. The live job checks these keys still exist. */

export const VARIANT_S = "55555555-5555-4555-8555-555555555551";
export const VARIANT_L = "55555555-5555-4555-8555-555555555552";

export function fourthwallProduct(slug = "crown-hoodie", overrides: Record<string, unknown> = {}) {
  return {
    type: "PRODUCT",
    id: "44444444-4444-4444-8444-444444444444",
    name: slug.replaceAll("-", " "),
    slug,
    description: "<p>Heavy fleece.</p>",
    state: { type: "AVAILABLE" },
    access: { type: "PUBLIC" },
    images: [
      { id: "i1", url: `https://cdn.fourthwall.test/${slug}.png`, width: 1200, height: 1500 },
    ],
    variants: [
      {
        id: VARIANT_S,
        name: "S",
        sku: `${slug}-S`,
        unitPrice: { value: 64.5, currency: "USD" },
        attributes: {
          description: "Lilac, S",
          color: { name: "Lilac", swatch: "#b9a3ee" },
          size: { name: "S" },
        },
        stock: { type: "UNLIMITED" },
        images: [],
      },
      {
        id: VARIANT_L,
        name: "L",
        sku: `${slug}-L`,
        unitPrice: { value: 69.99, currency: "USD" },
        attributes: {
          description: "Lilac, L",
          color: { name: "Lilac", swatch: "#b9a3ee" },
          size: { name: "L" },
        },
        stock: { type: "UNLIMITED" },
        images: [],
      },
    ],
    ...overrides,
  };
}

export function fourthwallPage(products: unknown[], hasNextPage = false) {
  return { results: products, paging: { hasNextPage } };
}

export const fourthwallShop = {
  id: "sh_1",
  name: "Street Royalty Official",
  domain: "streetroyalty",
};

export const FOURTHWALL_KEYS = {
  shop: ["name", "domain"],
  productPage: ["results", "paging"],
  product: ["id", "name", "slug", "images", "variants"],
  variant: ["id", "unitPrice", "attributes", "stock"],
};
