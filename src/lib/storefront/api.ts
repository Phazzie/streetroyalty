import { createServerFn } from "@tanstack/react-start";
import { sellableLines } from "./fourthwall.ts";
import { MAX_BAG_LINES, MAX_LINE_QUANTITY } from "./types.ts";

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCatalog } = await import("./fourthwall.server.ts");
  return loadCatalog();
});

export const getStoreProduct = createServerFn({ method: "GET" })
  .validator((input: { slug?: string } | undefined) => ({
    slug: String(input?.slug ?? "")
      .trim()
      .slice(0, 160),
  }))
  .handler(async ({ data }) => {
    const { loadProduct } = await import("./fourthwall.server.ts");
    const found = await loadProduct(data.slug);
    if (!found) return null;
    const pairs = found.product.pairsWith
      .map((slug) => found.catalog.products.find((item) => item.slug === slug))
      .filter((item) => item !== undefined);
    return { product: found.product, pairs, source: found.catalog.source };
  });

export const startStoreCheckout = createServerFn({ method: "POST" })
  .validator((input: { lines?: unknown } | undefined) => {
    const lines: { variantId: string; quantity: number }[] = [];
    for (const raw of Array.isArray(input?.lines) ? input.lines : []) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as { variantId?: unknown; quantity?: unknown };
      const variantId = typeof row.variantId === "string" ? row.variantId.slice(0, 80) : "";
      const quantity = Math.round(Number(row.quantity));
      if (!variantId || !Number.isFinite(quantity) || quantity < 1) continue;
      lines.push({ variantId, quantity: Math.min(MAX_LINE_QUANTITY, quantity) });
      if (lines.length >= MAX_BAG_LINES) break;
    }
    return { lines };
  })
  .handler(async ({ data }) => {
    const { startCheckout, storefrontLive } = await import("./fourthwall.server.ts");
    if (storefrontLive() && sellableLines(data.lines)) {
      // Each live checkout creates a cart at Fourthwall, so one visitor cannot start them without end.
      // A bag that cannot be sent is refused by startCheckout below and is never counted.
      const { count } = await import("../ai/guard.server.ts");
      const verdict = await count("checkout", { visitor: 40, global: 5000 });
      if (!verdict.ok) throw new Error("Too many checkouts started today. Try again tomorrow.");
    }
    return startCheckout(data.lines);
  });

/** The first product photo as a data image, so a shop piece can be tried on in the lab. */
export const getProductPhoto = createServerFn({ method: "GET" })
  .validator((input: { slug?: string } | undefined) => ({
    slug: String(input?.slug ?? "")
      .trim()
      .slice(0, 160),
  }))
  .handler(async ({ data }) => {
    const { productPhoto } = await import("./fourthwall.server.ts");
    return productPhoto(data.slug);
  });
