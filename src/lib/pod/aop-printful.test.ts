import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { AOP_DPI, PRINTFUL_AOP, panelPrintTarget, printfulAopById } from "./aop-printful.ts";

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

  it("does not invent template pixel sizes or variant ids", () => {
    for (const product of Object.values(PRINTFUL_AOP)) {
      assert.equal(product.catalogVariantIds, null);
      assert.ok(product.startingPriceCents > 0);
      const target = panelPrintTarget(product.catalogProductId, "body_front");
      assert.equal(target.confirmed, false);
      assert.equal(target.widthPx, null);
      assert.equal(target.heightPx, null);
      assert.equal(target.placementKey, null);
      assert.match(target.todo, /TODO/);
      assert.match(target.todo, new RegExp(String(product.catalogProductId)));
    }
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
    assert.equal(PRINTFUL_AOP.hoodie.material.fabricConfirmed, true);
    assert.equal(PRINTFUL_AOP.joggers.material.fabricConfirmed, false);
    assert.equal(PRINTFUL_AOP.jacket.material.fabricConfirmed, false);
    assert.ok(lines.size >= 2, "the lines are per product, not one line for all");
  });
});
