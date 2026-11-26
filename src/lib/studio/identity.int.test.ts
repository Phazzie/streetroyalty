import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { addToCart, listCart } from "./cart.server.ts";
import { getDesign, getShopDesign, publishDesign, saveDesign } from "./designs.server.ts";
import { loadProduct } from "./shared.server.ts";
import { defaultGarment } from "./garments.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { seedUser } from "../../test/seed.ts";

const LAYERS = [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }];

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("garment identity across printers", () => {
  it("still loads a sandbox piece after the shop flips to live", async () => {
    const saved = await saveDesign("ada", {
      title: "Lilac hoodie",
      productId: "aop-hoodie",
      variantId: "aop-hoodie-printed-m",
      placement: "front",
      layers: LAYERS,
      printFile: pngDataUrl(600, 450),
      mockupUrl: "data:image/svg+xml;utf8,%3Csvg%2F%3E",
      garment: defaultGarment("aop-hoodie"),
    });
    await publishDesign("ada", saved.id);
    expect(saved.templateId).toBe("aop-hoodie");
    expect(saved.provider).toBe("sandbox");

    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test_key";
    process.env.PRINTFUL_STORE_ID = "1";
    process.env.APP_PUBLIC_URL = "https://streetroyalty.example";

    const loaded = await getDesign("ada", saved.id);
    expect(loaded.templateId).toBe("aop-hoodie");
    expect(loaded.garment?.templateId).toBe("aop-hoodie");
    expect(loaded.productId).toBe("aop-hoodie");
    const shop = await getShopDesign(saved.slug);
    expect(shop.templateId).toBe("aop-hoodie");
    expect(shop.sizes.map((size) => size.variantId)).toContain("aop-hoodie-printed-m");
    // A sandbox size is not a Printful variant, so the live shop will not bag it.
    await expect(addToCart("ada", saved.id, "aop-hoodie-printed-m")).rejects.toThrow();
    expect((await getShopDesign(saved.slug)).id).toBe(saved.id);
    expect((await getDesign("ada", saved.id)).garment?.panels.length).toBeGreaterThan(0);
  });

  it("finds the cart and the shop sizes after a color label changes", async () => {
    const saved = await saveDesign("ada", {
      title: "Ink tee",
      productId: "tee-heavy",
      variantId: "tee-heavy-black-m",
      placement: "front",
      layers: LAYERS,
      printFile: pngDataUrl(1800, 2400),
      mockupUrl: "data:image/svg+xml;utf8,%3Csvg%2F%3E",
    });
    await publishDesign("ada", saved.id);
    const sql = await getSql();
    await sql`update designs set color_name = 'Ink' where id = ${saved.id}`;
    const shop = await getShopDesign(saved.slug);
    expect(shop.colorName).toBe("Ink");
    expect(shop.sizes.map((size) => size.variantId)).toEqual([
      "tee-heavy-black-s",
      "tee-heavy-black-m",
      "tee-heavy-black-l",
      "tee-heavy-black-xl",
      "tee-heavy-black-2xl",
    ]);
    await addToCart("bo", saved.id, "tee-heavy-black-l");
    const cart = await listCart("bo");
    expect(cart.map((line) => line.variantId)).toEqual(["tee-heavy-black-l"]);
    expect(cart[0]?.unitCents).toBeGreaterThan(0);
  });

  it("keeps garment panels when an older writer clears them on a catalog id", async () => {
    const garment = defaultGarment("aop-hoodie");
    const sql = await getSql();
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, garment_json, retail_cents, currency
      ) values (
        'old-388', 'ada', 'Old hoodie', 'old-388', 'draft', '388',
        'Hoodie', 'Hoodie', '9001', 'M', 'Printed', '#c4a6e0', 'M', 'front', 'sublimation',
        ${JSON.stringify(LAYERS)}, ${JSON.stringify(garment)}, 4075, 'USD'
      )
    `;
    const before = await sql<{ template_id: string; garment_json: string }>`
      select template_id, garment_json from designs where id = 'old-388'
    `;
    expect(before[0]?.template_id).toBe("aop-hoodie");
    expect(before[0]?.garment_json).toContain("aop-hoodie");
    await sql`
      update designs
      set garment_json = null, product_id = '388'
      where id = 'old-388'
    `;
    const after = await sql<{
      template_id: string;
      garment_json: string | null;
      product_id: string;
    }>`
      select template_id, garment_json, product_id from designs where id = 'old-388'
    `;
    expect(after[0]?.product_id).toBe("388");
    expect(after[0]?.template_id).toBe("aop-hoodie");
    expect(after[0]?.garment_json).toContain("aop-hoodie");
    const loaded = await getDesign("ada", "old-388");
    expect(loaded.garment?.templateId).toBe("aop-hoodie");
  });

  it("refuses an unbound blank in live and still shows a piece the printer will not answer", async () => {
    const saved = await saveDesign("ada", {
      title: "Live tee",
      productId: "tee-heavy",
      variantId: "tee-heavy-black-m",
      placement: "front",
      layers: LAYERS,
      printFile: pngDataUrl(1800, 2400),
      mockupUrl: "data:image/svg+xml;utf8,%3Csvg%2F%3E",
    });
    await publishDesign("ada", saved.id);
    await addToCart("bo", saved.id, "tee-heavy-black-m");

    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test_key";
    process.env.PRINTFUL_STORE_ID = "1";
    process.env.APP_PUBLIC_URL = "https://streetroyalty.example";

    expect(await listCart("bo")).toHaveLength(1);
    const shop = await getShopDesign(saved.slug);
    expect(shop.sizes.map((size) => size.variantId)).toContain("tee-heavy-black-m");
    await expect(
      saveDesign("ada", {
        title: "Another tee",
        productId: "tee-heavy",
        variantId: "tee-heavy-black-m",
        placement: "front",
        layers: LAYERS,
      }),
    ).rejects.toThrow(/not bound/);
    await expect(loadProduct("tee-heavy")).rejects.toThrow(/not bound/);
    await expect(addToCart("bo", saved.id, "tee-heavy-black-l")).rejects.toThrow(/not bound/);

    const sql = await getSql();
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, retail_cents, currency, provider_catalog_id
      ) values (
        'odd-71', 'ada', 'Odd tee', 'odd-71', 'published', '71',
        'Softstyle Tee', 'T-Shirt', '4011', 'M', 'Black', '#141414', 'M', 'front', 'dtg',
        ${JSON.stringify(LAYERS)}, 3069, 'USD', '71'
      )
    `;
    const odd = await getShopDesign("odd-71");
    expect(odd.templateId).toBe("71");
    expect(odd.sizes.map((size) => size.variantId)).toEqual(["4011"]);
  });
});
