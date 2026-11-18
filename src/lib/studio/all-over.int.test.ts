import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { AOP_ORDER_CLOSED, aopOrderable, PRINTFUL_AOP } from "../pod/aop-printful.ts";
import { addToCart, listCart, quoteShipping } from "./cart.server.ts";
import { generateMockup, getDesign, publishDesign, saveDesign } from "./designs.server.ts";
import {
  AOP_TEMPLATES,
  canOrderProduct,
  defaultGarment,
  setPanelFill,
  type GarmentDesign,
} from "./garments.ts";
import { createMatchedSet } from "./garments.server.ts";
import { startCheckout } from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, TEE, seedDesign, seedUser } from "../../test/seed.ts";

const PRINT = pngDataUrl(600, 450);
const LAYERS = [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }];
const LILAC = "#c4a6e0";
const CREAM = "#f3e6d0";

const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

/** Black / gold, with checker side panels in hot pink and lime. */
function blackGoldChecker(): GarmentDesign {
  let garment: GarmentDesign = { ...defaultGarment("aop-hoodie"), activeColorwayId: "black-gold" };
  for (const id of ["side_left", "side_right"]) {
    garment = setPanelFill(garment, id, {
      kind: "pattern",
      pattern: "checker",
      hex: "#ff2d95",
      accent: "#d6ff3c",
    });
  }
  return garment;
}

function hoodie(garment: unknown) {
  return {
    productId: "aop-hoodie",
    variantId: "aop-hoodie-printed-m",
    placement: "front",
    layers: LAYERS,
    printFile: PRINT,
    garment,
  };
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
});

describe("all-over mockups", () => {
  it("draws the maker's colorway and panels, saves them, and two colorways look different", async () => {
    const mockup = await generateMockup({ ...hoodie(blackGoldChecker()), userId: "ada" });
    const saved = await saveDesign("ada", {
      ...hoodie(blackGoldChecker()),
      title: "Black gold checker",
      mockupUrl: mockup.mockupUrl,
    });
    const svg = decode((await getDesign("ada", saved.id)).mockupUrl ?? "");
    expect(svg).toContain('fill="#141414"');
    expect(svg).toContain('fill="#c6a15b"');
    expect(svg).toMatch(/<pattern id="pat-side_left"[^>]*>.*fill="#ff2d95".*fill="#d6ff3c"/);
    expect(svg).toContain(
      'data-panel="side_left" d="M118 128 H146 V392 H118 Z" fill="url(#pat-side_left)"',
    );
    expect(svg).not.toContain(LILAC);
    expect(svg).not.toContain(CREAM);

    const lilac = await generateMockup(hoodie(defaultGarment("aop-hoodie")));
    expect(decode(lilac.mockupUrl)).toContain(LILAC);
    expect(lilac.mockupUrl).not.toBe(mockup.mockupUrl);
  });

  it("refuses or cleans a hostile garment before it reaches the drawing", async () => {
    const base = blackGoldChecker();
    const badHex = {
      ...base,
      colorways: base.colorways.map((item, index) =>
        index === 0 ? { ...item, colors: { ...item.colors, body: "red" } } : item,
      ),
    };
    await expect(generateMockup(hoodie(badHex))).rejects.toThrow(/hex/);

    const huge = setPanelFill(base, "hood", {
      kind: "art",
      src: `data:image/png;base64,${"A".repeat(1_400_001)}`,
    });
    await expect(generateMockup(hoodie(huge))).rejects.toThrow(/too large/);

    const joggers = defaultGarment("aop-joggers");
    await expect(generateMockup(hoodie(joggers))).rejects.toThrow(/different garment/);

    const hostile = {
      ...base,
      colorways: base.colorways.map((item) => ({ ...item, name: '<script>alert("x")</script>' })),
      panels: base.panels.map((item) =>
        item.id === "pocket"
          ? {
              id: item.id,
              fill: {
                kind: "pattern",
                pattern: "checker",
                hex: '#fff" onload="x',
                accent: "#000000",
              },
            }
          : item.id === "hood"
            ? { id: item.id, fill: { kind: "art", src: "javascript:alert(1)" } }
            : item.id === "body_front"
              ? {
                  id: item.id,
                  fill: { kind: "art", src: 'https://x.test/a.png"/><script>alert(1)</script>' },
                }
              : item,
      ),
    };
    const drawn = decode(
      (
        await generateMockup({
          ...hoodie(hostile),
          layers: [{ ...LAYERS[0], text: "<script>alert(1)</script>" }],
        })
      ).mockupUrl,
    );
    expect(drawn).not.toMatch(/<script/i);
    expect(drawn).not.toContain("onload");
    expect(drawn).not.toContain("javascript:");
    expect(drawn).toContain("&lt;script&gt;");
    expect(drawn).toContain('data-panel="pocket" d="M174 236 H226 V312 H174 Z" fill="#c6a15b"');
  });

  it("leaves a placement mockup alone when a garment is sent with it", async () => {
    const tee = await generateMockup({
      productId: "tee-heavy",
      variantId: "tee-heavy-black-m",
      placement: "front",
      layers: LAYERS,
      garment: { templateId: "nope" },
    });
    expect(tee.mockupUrl).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("ordering an all-over piece", () => {
  async function publishedHoodie(owner = "ada") {
    const mockup = await generateMockup(hoodie(blackGoldChecker()));
    const saved = await saveDesign(owner, {
      ...hoodie(blackGoldChecker()),
      title: "Gold rush hoodie",
      mockupUrl: mockup.mockupUrl,
    });
    return publishDesign(owner, saved.id);
  }

  it("keeps the rule in one place, closed while no panel template is confirmed", () => {
    for (const template of Object.values(AOP_TEMPLATES)) {
      expect(canOrderProduct(template.id)).toBe(false);
      expect(
        aopOrderable(
          template.printful.catalogProductId,
          template.panels.map((item) => item.id),
        ),
      ).toBe(false);
    }
    expect(aopOrderable(PRINTFUL_AOP.hoodie.catalogProductId, [])).toBe(false);
    expect(canOrderProduct(TEE.productId)).toBe(true);
    expect(AOP_ORDER_CLOSED).toMatch(/^All-over pieces can be designed, saved and shared now\./);
  });

  it("can still be published, but not added to the cart, while a tee can", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    expect(piece.status).toBe("published");
    await expect(addToCart("bo", piece.id, "aop-hoodie-printed-m")).rejects.toThrow(
      AOP_ORDER_CLOSED,
    );
    await expect(addToCart("ada", piece.id, "aop-hoodie-printed-m", "black-gold")).rejects.toThrow(
      AOP_ORDER_CLOSED,
    );
    const tee = await seedDesign("ada", { published: true });
    await addToCart("bo", tee.id, TEE.variantId);
    const sql = await getSql();
    const lines = await sql<{
      design_id: string;
    }>`select design_id from cart_items where user_id = 'bo'`;
    expect(lines.map((line) => line.design_id)).toEqual([tee.id]);
  });

  it("refuses in live mode too, before asking the printer", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test_key";
    await expect(addToCart("bo", piece.id, "aop-hoodie-printed-m")).rejects.toThrow(
      AOP_ORDER_CLOSED,
    );
  });

  it("stops checkout and the shipping quote when an all-over line is already in the cart", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    const tee = await seedDesign("ada", { published: true });
    await addToCart("bo", tee.id, TEE.variantId);
    const sql = await getSql();
    await sql`
      insert into cart_items (id, user_id, design_id, variant_id, variant_label, quantity, colorway_id)
      values (${crypto.randomUUID()}, 'bo', ${piece.id}, 'aop-hoodie-printed-m', 'M', 1, '')
    `;
    await expect(
      startCheckout("bo", { recipient: RECIPIENT, shippingMethod: "STANDARD" }),
    ).rejects.toThrow(AOP_ORDER_CLOSED);
    await expect(quoteShipping("bo", RECIPIENT)).rejects.toThrow(AOP_ORDER_CLOSED);
    const orders = await sql<{ id: string }>`select id from orders where user_id = 'bo'`;
    expect(orders).toHaveLength(0);
    // The line still shows in the bag, so it can be taken out.
    expect((await listCart("bo")).map((line) => line.designId).sort()).toEqual(
      [piece.id, tee.id].sort(),
    );
  });
});

describe("making a matched set", () => {
  async function designCount(userId: string): Promise<number> {
    const sql = await getSql();
    const rows = await sql<{
      count: number;
    }>`select count(*)::int as count from designs where user_id = ${userId}`;
    return Number(rows[0]?.count ?? 0);
  }

  it("refuses a one-letter set name before it saves the partner, however often it is tried", async () => {
    const piece = await saveDesign("ada", { ...hoodie(blackGoldChecker()), title: "Night track" });
    const before = await designCount("ada");
    await expect(createMatchedSet("ada", piece.id, "x")).rejects.toThrow(/Name the set/);
    await expect(createMatchedSet("ada", piece.id, " y ")).rejects.toThrow(/Name the set/);
    expect(await designCount("ada")).toBe(before);
    const sql = await getSql();
    expect(await sql`select id from garment_sets where user_id = 'ada'`).toHaveLength(0);

    const set = await createMatchedSet("ada", piece.id, "Night track set");
    expect(set.pieces).toHaveLength(2);
    expect(await designCount("ada")).toBe(before + 1);
  });
});
