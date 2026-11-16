import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  defaultColor,
  filterProducts,
  pickVariant,
  sizeAvailable,
  sortProducts,
} from "./browse.ts";
import { demoCatalog, isDemoVariantId } from "./demo.ts";

const products = demoCatalog.products;
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public");

describe("the preview drop", () => {
  it("has a photo on disk for every image it names", () => {
    for (const product of products) {
      assert.ok(product.images.length > 0, product.slug);
      for (const image of product.images)
        assert.ok(existsSync(join(publicDir, image.url)), `${product.slug}: ${image.url}`);
    }
  });
  it("only pairs pieces that exist, and never a piece with itself", () => {
    const slugs = new Set(products.map((product) => product.slug));
    assert.equal(slugs.size, products.length);
    for (const product of products) {
      for (const slug of product.pairsWith) {
        assert.ok(slugs.has(slug), `${product.slug} pairs with missing ${slug}`);
        assert.notEqual(slug, product.slug);
      }
    }
  });
  it("gives every variant a preview id and a price", () => {
    for (const product of products) {
      for (const variant of product.variants) {
        assert.ok(isDemoVariantId(variant.id));
        assert.ok(variant.priceCents > 0);
      }
      assert.equal(
        product.priceCents,
        Math.min(...product.variants.map((variant) => variant.priceCents)),
      );
    }
  });
});

describe("browsing", () => {
  it("filters by collection and by every search word", () => {
    assert.deepEqual(
      filterProducts(products, { collection: "sets", query: "" }).map(
        (product) => product.collection,
      ),
      ["sets", "sets", "sets", "sets"],
    );
    assert.deepEqual(
      filterProducts(products, { collection: "all", query: "mint hoodie" }).map(
        (product) => product.slug,
      ),
      ["mint-set-hoodie"],
    );
    assert.equal(filterProducts(products, { collection: "all", query: "tuxedo" }).length, 0);
    assert.equal(
      filterProducts(products, { collection: "all", query: " ! " }).length,
      products.length,
    );
  });
  it("sorts by price without touching the featured order", () => {
    const low = sortProducts(products, "low");
    assert.ok(low[0].priceCents <= low[low.length - 1].priceCents);
    assert.equal(
      sortProducts(products, "high")[0].priceCents,
      Math.max(...products.map((product) => product.priceCents)),
    );
    assert.equal(sortProducts(products, "featured"), products);
  });
  it("needs a size before a sized piece has a variant", () => {
    const hoodie = products.find((product) => product.slug === "lilac-set-hoodie")!;
    const color = defaultColor(hoodie);
    assert.equal(color, "Lilac");
    assert.equal(pickVariant(hoodie, { color }), null);
    assert.equal(pickVariant(hoodie, { color, size: "L" })?.id, "demo:lilac-set-hoodie:L");
    assert.equal(sizeAvailable(hoodie, color, "L"), true);
    assert.equal(sizeAvailable(hoodie, color, "5XL"), false);
  });
  it("picks the only variant of a one-size piece straight away", () => {
    const cap = products.find((product) => product.slug === "crown-cap")!;
    assert.equal(pickVariant(cap, { color: defaultColor(cap) })?.id, "demo:crown-cap:one");
  });
});
