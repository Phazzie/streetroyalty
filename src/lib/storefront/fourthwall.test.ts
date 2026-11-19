import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  checkoutHost,
  checkoutUrl,
  htmlToParagraphs,
  isFourthwallVariantId,
  mapFourthwallCollections,
  mapFourthwallProduct,
  mapFourthwallProducts,
  moneyToCents,
  sellableLines,
  withPairings,
} from "./fourthwall.ts";

const VARIANT_S = "55555555-5555-4555-8555-555555555551";
const VARIANT_L = "55555555-5555-4555-8555-555555555552";

function rawProduct(overrides: Record<string, unknown> = {}) {
  return {
    type: "PRODUCT",
    id: "44444444-4444-4444-8444-444444444444",
    name: "Crown Hoodie",
    slug: "crown-hoodie",
    description: "<p>Heavy fleece.</p><p>Runs <b>big</b> &amp; warm.</p><script>alert(1)</script>",
    state: { type: "AVAILABLE" },
    access: { type: "PUBLIC" },
    images: [
      {
        id: "i1",
        url: "https://cdn.example/a.png",
        transformedUrl: "https://cdn.example/a-t.png",
        width: 1200,
        height: 1500,
      },
    ],
    variants: [
      {
        id: VARIANT_S,
        name: "Crown Hoodie - Lilac, S",
        sku: "CH-S",
        unitPrice: { value: 64.5, currency: "USD" },
        compareAtPrice: { value: 80, currency: "USD" },
        attributes: {
          description: "Lilac, S",
          color: { name: "Lilac", swatch: "#b9a3ee" },
          size: { name: "S" },
        },
        stock: { type: "LIMITED", inStock: 0 },
        images: [],
      },
      {
        id: VARIANT_L,
        name: "Crown Hoodie - Lilac, L",
        sku: "CH-L",
        unitPrice: { value: 69.99, currency: "USD" },
        attributes: {
          description: "Lilac, L",
          color: { name: "Lilac", swatch: "#b9a3ee" },
          size: { name: "L" },
        },
        stock: { type: "UNLIMITED" },
        images: [{ id: "i2", url: "https://cdn.example/l.png", width: 800, height: 1000 }],
      },
    ],
    ...overrides,
  };
}

describe("moneyToCents", () => {
  it("rounds decimal money to whole cents", () => {
    assert.equal(moneyToCents({ value: 64.5, currency: "USD" }), 6450);
    assert.equal(moneyToCents({ value: 19.999, currency: "USD" }), 2000);
  });
  it("refuses missing or negative money", () => {
    assert.equal(moneyToCents(undefined), null);
    assert.equal(moneyToCents({ value: -1 }), null);
    assert.equal(moneyToCents({ value: "abc" }), null);
  });
});

describe("htmlToParagraphs", () => {
  it("keeps the words and drops the markup and scripts", () => {
    assert.deepEqual(
      htmlToParagraphs(
        "<p>Heavy fleece.</p><p>Runs <b>big</b> &amp; warm.</p><script>alert(1)</script>",
      ),
      ["Heavy fleece.", "Runs big & warm."],
    );
  });
  it("splits on line breaks and list items", () => {
    assert.deepEqual(htmlToParagraphs("One<br/>Two<ul><li>Three</li><li>Four</li></ul>"), [
      "One",
      "Two",
      "Three",
      "Four",
    ]);
  });
  it("never returns an angle bracket from a tag", () => {
    const out = htmlToParagraphs(
      '<img src=x onerror="alert(1)"><a href="javascript:1">link</a>',
    ).join(" ");
    assert.equal(out, "link");
  });
});

describe("mapFourthwallProduct", () => {
  it("maps price, colours, sizes and stock", () => {
    const product = mapFourthwallProduct(rawProduct());
    assert.ok(product);
    assert.equal(product.slug, "crown-hoodie");
    assert.equal(product.kind, "Hoodie");
    assert.equal(product.priceCents, 6450);
    assert.equal(product.compareAtCents, 8000);
    assert.deepEqual(product.colors, [{ name: "Lilac", swatch: "#b9a3ee" }]);
    assert.deepEqual(product.sizes, ["S", "L"]);
    assert.equal(product.variants[0].available, false);
    assert.equal(product.variants[1].available, true);
    assert.equal(product.soldOut, false);
    assert.equal(product.images[0].url, "https://cdn.example/a-t.png");
    assert.deepEqual(product.description, ["Heavy fleece.", "Runs big & warm."]);
  });
  it("names the kind from whole words in the title", () => {
    const kind = (name: string) => mapFourthwallProduct(rawProduct({ name }))?.kind;
    assert.equal(kind("Steel Mug"), "Cup");
    assert.equal(kind("Landscape Poster"), "Poster");
    assert.equal(kind("Crown T-Shirt"), "Tee");
    assert.equal(kind("Night Tees"), "Tee");
    assert.equal(kind("Heavy Sweatpants"), "Jogger");
    assert.equal(kind("Mystery Box"), "Piece");
  });
  it("marks a product sold out when the shop says so or nothing is in stock", () => {
    assert.equal(mapFourthwallProduct(rawProduct({ state: { type: "SOLD_OUT" } }))?.soldOut, true);
    const none = rawProduct();
    (none.variants as { stock: unknown }[])[1].stock = { type: "LIMITED", inStock: 0 };
    assert.equal(mapFourthwallProduct(none)?.soldOut, true);
  });
  it("drops bundles, products with no variants, and products with no usable photo", () => {
    assert.equal(mapFourthwallProduct(rawProduct({ type: "BUNDLE" })), null);
    assert.equal(mapFourthwallProduct(rawProduct({ variants: [] })), null);
    const noPhoto = rawProduct({ images: [{ url: "http://insecure.example/a.png" }] });
    (noPhoto.variants as { images: unknown[] }[])[1].images = [];
    assert.equal(mapFourthwallProduct(noPhoto), null);
    assert.equal(mapFourthwallProduct(null), null);
    assert.equal(mapFourthwallProduct("nope"), null);
  });
  it("ignores a swatch that is not a hex colour", () => {
    const raw = rawProduct();
    (raw.variants as { attributes: { color: { swatch: string } } }[])[0].attributes.color.swatch =
      "url(javascript:1)";
    const product = mapFourthwallProduct(raw);
    assert.equal(product?.variants[0].swatch, undefined);
    assert.equal(product?.colors[0].swatch, "#888888");
  });
});

describe("mapFourthwallProducts and collections", () => {
  it("reads a page and its paging flag", () => {
    const page = mapFourthwallProducts({
      results: [rawProduct(), { type: "BUNDLE" }, 7],
      paging: { hasNextPage: true },
    });
    assert.equal(page.products.length, 1);
    assert.equal(page.hasNextPage, true);
    assert.deepEqual(mapFourthwallProducts(null), { products: [], hasNextPage: false });
  });
  it("lists named collections and leaves out the catch-all", () => {
    assert.deepEqual(
      mapFourthwallCollections({
        results: [
          { slug: "all", name: "All" },
          { slug: "sets", name: " Sets " },
          { slug: "", name: "x" },
        ],
      }),
      [{ slug: "sets", name: "Sets" }],
    );
  });
});

describe("checkout", () => {
  it("turns a bare shop handle into a Fourthwall host", () => {
    assert.equal(checkoutHost({ domain: "my-shop" }), "my-shop.fourthwall.com");
    assert.equal(checkoutHost({ domain: "my-shop.fourthwall.com" }), "my-shop.fourthwall.com");
  });
  it("prefers a clean override and refuses a bad one", () => {
    assert.equal(
      checkoutHost({ domain: "my-shop" }, "https://Checkout.Example.com/path"),
      "checkout.example.com",
    );
    assert.equal(checkoutHost({ domain: "my-shop" }, "not a host"), null);
    assert.equal(checkoutHost({}), null);
  });
  it("builds the hosted checkout link", () => {
    assert.equal(
      checkoutUrl("my-shop.fourthwall.com", "22222222-2222-4222-8222-222222222222", "USD"),
      "https://my-shop.fourthwall.com/checkout/?cartCurrency=USD&cartId=22222222-2222-4222-8222-222222222222",
    );
  });
  it("tells real variant ids from preview ones", () => {
    assert.equal(isFourthwallVariantId(VARIANT_S), true);
    assert.equal(isFourthwallVariantId("demo:crown-tee:S"), false);
  });
  it("only calls a bag sellable when every line could go to Fourthwall", () => {
    assert.equal(sellableLines([{ variantId: VARIANT_S }]), true);
    assert.equal(sellableLines([]), false);
    assert.equal(sellableLines([{ variantId: "not-a-real-id" }]), false);
    assert.equal(
      sellableLines([{ variantId: VARIANT_S }, { variantId: "demo:crown-tee:S" }]),
      false,
    );
  });
});

describe("withPairings", () => {
  it("pairs each product with other pieces, different kinds first", () => {
    const hoodie = mapFourthwallProduct(rawProduct())!;
    const tee = { ...hoodie, id: "t", slug: "crown-tee", kind: "Tee" };
    const second = { ...hoodie, id: "h2", slug: "night-hoodie" };
    const paired = withPairings([hoodie, second, tee]);
    assert.deepEqual(paired[0].pairsWith, ["crown-tee", "night-hoodie"]);
    assert.ok(!paired[0].pairsWith.includes("crown-hoodie"));
  });
});
