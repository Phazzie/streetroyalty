import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  AOP_DPI,
  PRINTFUL_AOP,
  aopOnSale,
  aopOrderable,
  printfulAopById,
  setAopOnSaleForTests,
} from "./aop-printful.ts";

describe("Printful all-over print facts", () => {
  it("keeps the product ids that the public pages publish", () => {
    assert.equal(PRINTFUL_AOP.hoodie.catalogProductId, 388);
    assert.equal(PRINTFUL_AOP.joggers.catalogProductId, 400);
    assert.equal(PRINTFUL_AOP.jacket.catalogProductId, 801);
    assert.equal(AOP_DPI, 150);
    assert.match(PRINTFUL_AOP.hoodie.material.line, /sublimation/);
    assert.match(PRINTFUL_AOP.hoodie.material.line, /not sewn cotton/);
    assert.equal(printfulAopById(388)?.name.includes("Hoodie"), true);
    assert.equal(printfulAopById(1), null);
  });

  it("keeps the catalog variant ids read with the Printful key, one per size", () => {
    assert.equal(PRINTFUL_AOP.hoodie.catalogVariants.M, 10871);
    assert.equal(PRINTFUL_AOP.hoodie.catalogVariants["2XS"], 18730);
    assert.equal(PRINTFUL_AOP.joggers.catalogVariants.XS, 11033);
    assert.equal(PRINTFUL_AOP.joggers.catalogVariants["4XL"], undefined);
    assert.equal(PRINTFUL_AOP.jacket.catalogVariants["6XL"], 20380);
    for (const product of Object.values(PRINTFUL_AOP)) {
      assert.ok(product.startingPriceCents > 0);
      assert.deepEqual(product.catalogVariantIds, Object.values(product.catalogVariants));
      assert.equal(new Set(product.catalogVariantIds).size, product.catalogVariantIds.length);
    }
  });

  it("is off sale, and when on sale opens only when the panels cover every cut piece", () => {
    assert.equal(aopOnSale(), false);
    assert.equal(aopOrderable(388, []), false);
    setAopOnSaleForTests(true);
    assert.equal(aopOrderable(388, []), true);
    assert.equal(aopOrderable(388, ["front/body_front has no panel."]), false);
    assert.equal(aopOrderable(1, []), false);
    setAopOnSaleForTests(false);
  });

  it("gives each product its own material line and names no fabric that is not confirmed", () => {
    // Fabric words, and sublimation, which only works on synthetics.
    const fabricClaim =
      /polyester|spandex|elastane|cotton|fleece|nylon|rayon|viscose|recycled|brushed|jersey|sublimat/i;
    const lines = new Set<string>();
    for (const product of Object.values(PRINTFUL_AOP)) {
      const { line, fabric, fabricConfirmed } = product.material;
      assert.ok(line.length > 20, `${product.name} needs a material line`);
      assert.doesNotMatch(line, /!/);
      lines.add(line);
      if (fabricConfirmed) {
        assert.ok(fabric && line.toLowerCase().includes(fabric.toLowerCase()), product.name);
      } else {
        assert.equal(fabric, null, product.name);
        assert.doesNotMatch(
          line,
          fabricClaim,
          `${product.name} claims a fabric that is not confirmed`,
        );
      }
    }
    // All three confirmed by GET /products/{388,400,801} (docs/printful-aop-data.md).
    assert.equal(PRINTFUL_AOP.hoodie.material.fabricConfirmed, true);
    assert.equal(PRINTFUL_AOP.joggers.material.fabricConfirmed, true);
    assert.equal(PRINTFUL_AOP.jacket.material.fabricConfirmed, true);
    assert.ok(lines.size >= 2, "the lines are per product, not one line for all");
  });
});
