import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAopOnSaleForTests } from "../pod/aop-printful.ts";
import { getSql } from "../db.ts";
import { addToCart, listCart } from "./cart.server.ts";
import { getDesign, getShopDesign, publishDesign, saveDesign } from "./designs.server.ts";
import { defaultGarment } from "./garments.ts";
import { startCheckout } from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, seedUser } from "../../test/seed.ts";

const PRINT = pngDataUrl(600, 450);
const MOCK = "data:image/svg+xml;utf8,%3Csvg%2F%3E";

function piece(title: string, garment = defaultGarment("aop-hoodie")) {
  return {
    title,
    productId: "aop-hoodie",
    variantId: "aop-hoodie-printed-m",
    placement: "front",
    layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
    printFile: PRINT,
    mockupUrl: MOCK,
    garment,
  };
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("all-over pieces", () => {
  // Off sale since 2026-11-26. Kept tested for orders paid before that.
  beforeEach(() => setAopOnSaleForTests(true));
  afterEach(() => setAopOnSaleForTests(false));

  it("stores colorways on an all-over piece and ignores them on a tee", async () => {
    const saved = await saveDesign("ada", piece("Lilac set"));
    expect(saved.garment?.colorways.map((item) => item.name)).toEqual([
      "Lilac / cream",
      "Lilac / white",
      "Black / gold",
    ]);
    const again = await getDesign("ada", saved.id);
    expect(again.garment?.activeColorwayId).toBe("lilac-cream");

    const tee = await saveDesign("ada", {
      title: "Plain tee",
      productId: "tee-heavy",
      variantId: "tee-heavy-black-m",
      placement: "front",
      layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
      garment: defaultGarment("aop-hoodie"),
    });
    expect(tee.garment).toBeNull();
    const bare = await saveDesign("ada", { ...piece("Bare hoodie"), garment: undefined });
    expect(bare.garment).toBeNull();
    const kept = await saveDesign("ada", {
      ...piece("Lilac set"),
      id: saved.id,
      garment: undefined,
    });
    expect(kept.garment?.activeColorwayId).toBe("lilac-cream");
    await expect(
      saveDesign("ada", { ...piece("Bad"), garment: { templateId: "nope" } }),
    ).rejects.toThrow(/template/);
  });

  it("sells the chosen colorway of a published all-over piece", async () => {
    const hoodie = await saveDesign("ada", piece("Night track"));
    await publishDesign("ada", hoodie.id);
    const shop = await getShopDesign(hoodie.slug);
    expect(shop.construction).toBe("aop");
    expect(shop.materialNote).toMatch(/not sewn cotton/);
    expect(shop.colorways).toHaveLength(3);
    await expect(addToCart("ada", hoodie.id, "aop-hoodie-printed-m", "nope")).rejects.toThrow(
      /colorway/,
    );
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", "black-gold");
    const started = await startCheckout("ada", {
      recipient: RECIPIENT,
      shippingMethod: "STANDARD",
    });
    const sql = await getSql();
    const orders = await sql<{
      items_json: string;
    }>`select items_json from orders where id = ${started.orderId}`;
    const items = JSON.parse(orders[0]?.items_json ?? "[]") as {
      colorwayId: string;
      colorwayName: string;
    }[];
    expect(items[0]).toMatchObject({ colorwayId: "black-gold", colorwayName: "Black / gold" });
  });

  it("keeps the same size in two colorways as two cart lines", async () => {
    const hoodie = await saveDesign("ada", piece("Two Ways Hoodie"));
    const [first, second] = hoodie.garment?.colorways ?? [];
    if (!first || !second) throw new Error("the house colorways are missing");
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", first.id);
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", second.id);
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", second.id);
    const sql = await getSql();
    const lines = await sql<{ colorway_id: string; quantity: number }>`
      select colorway_id, quantity from cart_items where user_id = 'ada' order by colorway_id
    `;
    expect(lines).toEqual(
      [
        { colorway_id: first.id, quantity: 1 },
        { colorway_id: second.id, quantity: 2 },
      ].sort((a, b) => a.colorway_id.localeCompare(b.colorway_id)),
    );
  });
  it("stops checkout when the maker drops a colorway that is already in a bag", async () => {
    const hoodie = await saveDesign("ada", piece("Dropped Way Hoodie"));
    const [first, second] = hoodie.garment?.colorways ?? [];
    if (!first || !second || !hoodie.garment) throw new Error("the house colorways are missing");
    await publishDesign("ada", hoodie.id);
    await addToCart("bo", hoodie.id, "aop-hoodie-printed-m", second.id);
    // The maker keeps only the first colorway.
    await saveDesign("ada", {
      ...piece("Dropped Way Hoodie", {
        ...hoodie.garment,
        colorways: [first],
        activeColorwayId: first.id,
      }),
      id: hoodie.id,
    });
    await expect(
      startCheckout("bo", { recipient: RECIPIENT, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(/no longer comes in that colorway/);
    const sql = await getSql();
    const orders = await sql`select id from orders where user_id = 'bo'`;
    expect(orders).toEqual([]);
  });

  it("loads designs and cart lines stored the way migrations 0005 and 0013 wrote them", async () => {
    const garment = defaultGarment("aop-hoodie");
    const sql = await getSql();
    const layers = JSON.stringify([
      { id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 },
    ]);
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, garment_json, retail_cents, currency, set_id
      ) values (
        'legacy-hoodie', 'ada', 'Legacy lilac', 'legacy-lilac', 'published', 'aop-hoodie',
        'AOP Hoodie', 'Hoodie', 'aop-hoodie-printed-m', 'AOP Hoodie / Printed / M', 'Printed',
        '#c4a6e0', 'M', 'front', 'sublimation', ${layers}, ${JSON.stringify(garment)}, 4000,
        'USD', 'legacy-set'
      )
    `;
    const catalogJson = JSON.stringify({ ...garment, templateId: "388" });
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, garment_json, retail_cents, currency, set_id
      ) values (
        'catalog-hoodie', 'ada', 'Catalog id', 'catalog-id', 'draft', '388',
        'All-Over Print Recycled Unisex Hoodie', 'Hoodie', '9001', 'M', 'Printed',
        '#c4a6e0', 'M', 'front', 'sublimation', ${layers}, ${catalogJson}, 4075,
        'USD', 'legacy-set'
      )
    `;
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, retail_cents, currency, set_id
      ) values (
        'bare-joggers', 'ada', 'Bare joggers', 'bare-joggers', 'draft', 'aop-joggers',
        'AOP Joggers', 'Joggers', 'aop-joggers-printed-m', 'M', 'Printed',
        '#c4a6e0', 'M', 'front', 'sublimation', ${layers}, 3948, 'USD', 'legacy-set'
      )
    `;
    await sql`
      insert into cart_items (
        id, user_id, design_id, variant_id, variant_label, quantity, colorway_id
      ) values (
        'legacy-line', 'ada', 'legacy-hoodie', 'aop-hoodie-printed-m', 'M', 1, 'lilac-cream'
      )
    `;

    const loaded = await getDesign("ada", "legacy-hoodie");
    expect(loaded.garment?.templateId).toBe("aop-hoodie");
    expect(loaded.garment?.colorways.map((item) => item.id)).toEqual([
      "lilac-cream",
      "lilac-white",
      "black-gold",
    ]);
    const fromCatalog = await getDesign("ada", "catalog-hoodie");
    expect(fromCatalog.productId).toBe("388");
    expect(fromCatalog.garment?.templateId).toBe("aop-hoodie");

    const cart = await listCart("ada");
    expect(cart.map((line) => line.variantId)).toEqual(["aop-hoodie-printed-m"]);
    expect(cart[0]?.designId).toBe("legacy-hoodie");
  });

  it("stops a cart that holds a catalog id saved before any panel design existed", async () => {
    // Old live mode stored 388 as a placement print. garment_json was null.
    // parseGarment would not have accepted templateId "388", so that is not the
    // row to reproduce. One chest file on an all-over blank still must not print.
    const sql = await getSql();
    const layers = JSON.stringify([
      { id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 },
    ]);
    await sql`
      insert into designs (
        id, user_id, title, slug, status, product_id, product_name, product_type,
        variant_id, variant_label, color_name, color_hex, size_label, placement, technique,
        layers_json, retail_cents, currency
      ) values (
        'old-live-hoodie', 'ada', 'Old live hoodie', 'old-live-hoodie', 'published', '388',
        'All-Over Print Recycled Unisex Hoodie', 'Hoodie', '9001', 'M', 'Printed',
        '#c4a6e0', 'M', 'front', 'dtg', ${layers}, 4075, 'USD'
      )
    `;
    await sql`
      insert into cart_items (
        id, user_id, design_id, variant_id, variant_label, quantity, colorway_id
      ) values (
        'old-live-line', 'bo', 'old-live-hoodie', '9001', 'M', 1, ''
      )
    `;
    const loaded = await getDesign("ada", "old-live-hoodie");
    expect(loaded.productId).toBe("388");
    expect(loaded.garment).toBeNull();
    const cart = await listCart("bo");
    expect(cart.map((line) => line.designId)).toEqual(["old-live-hoodie"]);
    await expect(
      startCheckout("bo", { recipient: RECIPIENT, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(/missing a print file|lost its panels/);
  });
});
