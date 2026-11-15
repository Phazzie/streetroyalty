import { demoCatalog } from "./demo.ts";
import {
  checkoutHost,
  checkoutUrl,
  isFourthwallVariantId,
  mapFourthwallCollections,
  mapFourthwallProducts,
  withPairings,
} from "./fourthwall.ts";
import type { CheckoutStart, StoreCatalog, StoreProduct } from "./types.ts";

/**
 * Live shop data from the Fourthwall Storefront API.
 *
 * FOURTHWALL_STOREFRONT_TOKEN turns it on. Without it every call answers from
 * the built-in preview drop. The token is a public storefront token, but it
 * stays on the server so there is one place that talks to Fourthwall.
 */

const BASE = "https://storefront-api.fourthwall.com/v1";
const FRESH_MS = 60_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
const MAX_COLLECTIONS = 8;

const RETRY_MS = 20_000;

type Cached = { at: number; catalog: StoreCatalog; shop: unknown };
type Failure = { at: number; refused: boolean };

const globalRef = globalThis as typeof globalThis & {
  __srStorefront__?: Cached;
  __srStorefrontDown__?: Failure;
};

function token(): string | undefined {
  const value = process.env.FOURTHWALL_STOREFRONT_TOKEN?.trim();
  return value ? value : undefined;
}

export function storefrontLive(): boolean {
  return Boolean(token());
}

async function call(
  path: string,
  query: Record<string, string>,
  init?: RequestInit,
): Promise<{ status: number; json: unknown }> {
  const params = new URLSearchParams({ storefront_token: token() ?? "", ...query });
  try {
    const res = await fetch(`${BASE}${path}?${params.toString()}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) console.error("fourthwall", path, res.status, text.slice(0, 200));
    return { status: res.status, json };
  } catch (error) {
    console.error("fourthwall", path, error);
    return { status: 0, json: null };
  }
}

/** The products of a collection, or the HTTP status that stopped the first page from loading. */
async function allProducts(collection: string, currency: string): Promise<StoreProduct[] | number> {
  const products: StoreProduct[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await call(`/collections/${encodeURIComponent(collection)}/products`, {
      currency,
      page: String(page),
      size: String(PAGE_SIZE),
    });
    if (res.status !== 200) return page === 0 ? res.status : products;
    const mapped = mapFourthwallProducts(res.json);
    products.push(...mapped.products);
    if (!mapped.hasNextPage) break;
  }
  return products;
}

async function fetchLive(): Promise<Cached | Failure> {
  const currency = "USD";
  const [shop, collections, products] = await Promise.all([
    call("/shop", {}),
    call("/collections", { size: "50" }),
    allProducts("all", currency),
  ]);
  if (typeof products === "number") {
    return { at: Date.now(), refused: products === 401 || products === 403 };
  }
  const named =
    collections.status === 200
      ? mapFourthwallCollections(collections.json).slice(0, MAX_COLLECTIONS)
      : [];
  const members = await Promise.all(
    named.map((collection) => allProducts(collection.slug, currency)),
  );
  const tagged = products.map((product) => {
    const index = members.findIndex(
      (list) => Array.isArray(list) && list.some((item) => item.slug === product.slug),
    );
    return index >= 0 ? { ...product, collection: named[index].slug } : product;
  });
  const used = named.filter((collection) =>
    tagged.some((product) => product.collection === collection.slug),
  );
  const shopName =
    shop.status === 200 &&
    shop.json &&
    typeof shop.json === "object" &&
    typeof (shop.json as { name?: unknown }).name === "string"
      ? String((shop.json as { name: string }).name)
      : "Street Royalty";
  return {
    at: Date.now(),
    shop: shop.status === 200 ? shop.json : null,
    catalog: {
      source: "fourthwall",
      shopName,
      currency,
      collections: used,
      products: withPairings(tagged),
    },
  };
}

async function live(): Promise<Cached | null> {
  const cached = globalRef.__srStorefront__;
  if (cached && Date.now() - cached.at < FRESH_MS) return cached;
  // After a failure, wait a little before asking again, so a broken shop is not hit on every page view.
  const down = globalRef.__srStorefrontDown__;
  if (down && Date.now() - down.at < RETRY_MS) return cached ?? null;
  const fresh = await fetchLive();
  if ("catalog" in fresh) {
    globalRef.__srStorefront__ = fresh;
    globalRef.__srStorefrontDown__ = undefined;
    return fresh;
  }
  globalRef.__srStorefrontDown__ = fresh;
  // A failed refresh keeps serving the last good shelf rather than an empty shop.
  return cached ?? null;
}

export async function loadCatalog(): Promise<StoreCatalog> {
  if (!storefrontLive()) return demoCatalog;
  const data = await live();
  if (data) return data.catalog;
  return {
    source: "fourthwall",
    shopName: "Street Royalty",
    currency: "USD",
    collections: [],
    products: [],
    notice: globalRef.__srStorefrontDown__?.refused
      ? "The shop's Fourthwall token was refused. Check FOURTHWALL_STOREFRONT_TOKEN."
      : "The shop did not answer. Try again in a minute.",
  };
}

export async function loadProduct(
  slug: string,
): Promise<{ catalog: StoreCatalog; product: StoreProduct } | null> {
  const catalog = await loadCatalog();
  const product = catalog.products.find((item) => item.slug === slug);
  return product ? { catalog, product } : null;
}

export type CheckoutLine = { variantId: string; quantity: number };

export async function startCheckout(lines: CheckoutLine[]): Promise<CheckoutStart> {
  if (!storefrontLive()) return { mode: "demo" };
  if (lines.length === 0) throw new Error("The bag is empty.");
  if (lines.some((line) => !isFourthwallVariantId(line.variantId))) {
    throw new Error(
      "Something in the bag is from the preview drop. Clear the bag and add it again.",
    );
  }
  const data = await live();
  const host = checkoutHost(data?.shop, process.env.FOURTHWALL_CHECKOUT_DOMAIN);
  if (!host)
    throw new Error(
      "Checkout is not set up yet. Set FOURTHWALL_CHECKOUT_DOMAIN to the shop's Fourthwall domain.",
    );
  const currency = data?.catalog.currency ?? "USD";
  const res = await call(
    "/carts",
    { currency },
    {
      method: "POST",
      body: JSON.stringify({
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      }),
    },
  );
  const cartId =
    res.status === 200 && res.json && typeof res.json === "object"
      ? String((res.json as { id?: unknown }).id ?? "")
      : "";
  if (!cartId) throw new Error("Checkout did not start. Something in the bag may have sold out.");
  return { mode: "fourthwall", url: checkoutUrl(host, cartId, currency) };
}

export type ProductPhoto = { name: string; kind: string; image?: string; path?: string };

/**
 * The first photo of a product, for sending a shop piece to the lab. A photo on
 * another host comes back as a data image, fetched here because the browser may
 * not read it. A photo served by this app comes back as its path for the page
 * to fetch itself. Only URLs from the catalog are ever used.
 */
export async function productPhoto(slug: string): Promise<ProductPhoto | null> {
  const found = await loadProduct(slug);
  const url = found?.product.images[0]?.url;
  if (!found || !url) return null;
  const about = { name: found.product.name, kind: found.product.kind };
  if (url.startsWith("/") && !url.startsWith("//")) return { ...about, path: url };
  if (!url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!mime.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 6_000_000) return null;
    return { ...about, image: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
  } catch (error) {
    console.error("fourthwall photo", error);
    return null;
  }
}
