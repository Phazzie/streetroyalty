import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  AOP_DPI,
  AOP_MATERIAL,
  PRINTFUL_AOP,
  panelPrintTarget,
  printfulAopById,
} from "./aop-printful.ts";

describe("Printful all-over print facts", () => {
  it("keeps the product ids that the public pages publish", () => {
    assert.equal(PRINTFUL_AOP.hoodie.catalogProductId, 388);
    assert.equal(PRINTFUL_AOP.joggers.catalogProductId, 400);
    assert.equal(PRINTFUL_AOP.jacket.catalogProductId, 801);
    assert.equal(AOP_DPI, 150);
    assert.match(AOP_MATERIAL, /sublimation/);
    assert.match(AOP_MATERIAL, /not sewn cotton/);
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
});
