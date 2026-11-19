import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { AOP_TEMPLATES } from "../garments/panels.ts";
import { createSandboxProvider } from "./sandbox.ts";
import {
  GARMENT_BINDINGS,
  SANDBOX_PLACEMENT_PRODUCT_IDS,
  aopFieldsFor,
  bindingsFor,
  isPrintfulPlacementProduct,
  isSandboxPlacementProduct,
  normalizeVariantIds,
  productForTemplate,
  templateForProduct,
  templateForVariant,
  variantsForTemplate,
  type GarmentBinding,
} from "./garment-map.ts";

const TEMPLATES = ["aop-hoodie", "aop-joggers", "aop-track-jacket"] as const;
const PRINTFUL = { "aop-hoodie": "388", "aop-joggers": "400", "aop-track-jacket": "801" } as const;

const FIXTURE: GarmentBinding[] = [
  {
    templateId: "aop-hoodie",
    provider: "printful",
    productId: "388",
    variantIds: ["9001", "9002"],
  },
  { templateId: "aop-joggers", provider: "printful", productId: "400", variantIds: ["9001"] },
  { templateId: "short", provider: "sandbox", productId: "aop", variantIds: null },
  { templateId: "aop-hoodie", provider: "sandbox", productId: "aop-hoodie", variantIds: null },
];

describe("garment template mapping", () => {
  it("maps template ids and provider product ids both ways", () => {
    assert.deepEqual(
      bindingsFor("sandbox").map((item) => item.templateId),
      [...TEMPLATES],
    );
    assert.deepEqual(
      bindingsFor("printful").map((item) => item.templateId),
      [...TEMPLATES],
    );
    for (const templateId of TEMPLATES) {
      assert.equal(productForTemplate("sandbox", templateId), templateId);
      assert.equal(templateForProduct("sandbox", templateId), templateId);
      assert.equal(productForTemplate("printful", templateId), PRINTFUL[templateId]);
      assert.equal(templateForProduct("printful", PRINTFUL[templateId]), templateId);
      assert.equal(templateForProduct("printful", templateId), null);
      assert.equal(productForTemplate("sandbox", "not-a-garment"), null);
      assert.equal(templateForProduct("sandbox", "yacht"), null);
      assert.ok(AOP_TEMPLATES[templateId]);
    }
    assert.equal(GARMENT_BINDINGS.length, TEMPLATES.length * 2);
  });

  it("maps variant ids both ways, and refuses an ambiguous or unknown one", () => {
    assert.equal(normalizeVariantIds(null), null);
    assert.equal(normalizeVariantIds([]), null);
    assert.deepEqual(normalizeVariantIds([9001, "9002"]), ["9001", "9002"]);
    assert.equal(variantsForTemplate("printful", "aop-hoodie"), null);
    assert.equal(templateForVariant("printful", "9001"), null);
    assert.deepEqual(variantsForTemplate("printful", "aop-hoodie", FIXTURE), ["9001", "9002"]);
    assert.equal(templateForVariant("printful", "9002", FIXTURE), "aop-hoodie");
    assert.equal(templateForVariant("printful", "9001", FIXTURE), null);
    assert.equal(templateForVariant("printful", "nope", FIXTURE), null);
    assert.equal(templateForVariant("sandbox", "aop-hoodie-printed-m"), "aop-hoodie");
    assert.equal(templateForVariant("sandbox", "aop-joggers-printed-xl"), "aop-joggers");
    assert.equal(templateForVariant("sandbox", "aop-hoodie"), null);
    assert.equal(templateForVariant("sandbox", "aop-hoodie-printed-m", FIXTURE), "aop-hoodie");
    assert.equal(productForTemplate("printful", "aop-hoodie", FIXTURE), "388");
    assert.equal(templateForProduct("sandbox", "aop-hoodie", FIXTURE), "aop-hoodie");
  });

  it("attaches all-over construction from the map and leaves placement blanks alone", () => {
    const hoodie = aopFieldsFor("sandbox", "aop-hoodie");
    const liveHoodie = aopFieldsFor("printful", "388");
    assert.equal(hoodie.construction, "aop");
    assert.equal(liveHoodie.construction, "aop");
    if (hoodie.construction === "aop" && liveHoodie.construction === "aop") {
      assert.equal(hoodie.aopTemplateId, "aop-hoodie");
      assert.equal(liveHoodie.aopTemplateId, "aop-hoodie");
      assert.equal(liveHoodie.materialNote, hoodie.materialNote);
      assert.match(hoodie.materialNote, /sublimation/);
    }
    assert.deepEqual(aopFieldsFor("printful", "71"), { construction: "placement" });
    assert.deepEqual(aopFieldsFor("sandbox", "tee-heavy"), { construction: "placement" });
    assert.equal(aopFieldsFor("printful", "400").construction, "aop");
    assert.equal(aopFieldsFor("printful", "801").construction, "aop");
    assert.equal(isSandboxPlacementProduct("tee-heavy"), true);
    assert.equal(isSandboxPlacementProduct("aop-hoodie"), false);
    assert.equal(isPrintfulPlacementProduct("71", ["dtg"]), true);
    assert.equal(isPrintfulPlacementProduct("71", ["DTG"]), true);
    assert.equal(isPrintfulPlacementProduct("71", ["embroidery"]), true);
    assert.equal(isPrintfulPlacementProduct("71", []), false);
    assert.equal(isPrintfulPlacementProduct("71", ["cut-sew"]), false);
    assert.equal(isPrintfulPlacementProduct("71", ["sublimation"]), false);
    assert.equal(isPrintfulPlacementProduct("500", ["cut_sew"]), false);
    assert.equal(isPrintfulPlacementProduct("500", ["dtg", "cut-sew"]), false);
    assert.equal(isPrintfulPlacementProduct("388", ["dtg"]), false);
    assert.equal(isPrintfulPlacementProduct("yacht", ["dtg"]), true);
    assert.equal(isPrintfulPlacementProduct("999999", []), false);
  });

  it("lists the tracksuit in the sandbox catalog with the mapped template id", async () => {
    const provider = createSandboxProvider();
    const page = await provider.listProducts();
    const aop = page.products.filter((item) => item.construction === "aop");
    assert.deepEqual(
      aop.map((item) => item.id),
      [...TEMPLATES],
    );
    for (const product of aop) {
      const full = await provider.getProduct(product.id);
      assert.equal(full.construction, "aop");
      assert.equal(full.aopTemplateId, templateForProduct("sandbox", product.id));
      assert.notEqual(full.aopTemplateId, undefined);
    }
    const placement = page.products
      .filter((item) => item.construction !== "aop")
      .map((item) => item.id)
      .sort();
    assert.deepEqual(placement, [...SANDBOX_PLACEMENT_PRODUCT_IDS].sort());
  });
});
