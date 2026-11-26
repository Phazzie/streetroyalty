import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AOP_ORDER_CLOSED, setAopOnSaleForTests } from "../pod/aop-printful.ts";
import { getSql } from "../db.ts";
import { aopOrderable, PRINTFUL_AOP } from "../pod/aop-printful.ts";
import {
  AOP_RECIPE_MIME,
  aopFileUrls,
  parseAopFileId,
  renderAopPrintFile,
} from "./aop-print.server.ts";
import { addToCart, listCart, quoteShipping } from "./cart.server.ts";
import { generateMockup, getDesign, publishDesign, saveDesign } from "./designs.server.ts";
import {
  AOP_TEMPLATES,
  canOrderProduct,
  coverageProblems,
  defaultGarment,
  printfulCard,
  setPanelFill,
  type GarmentDesign,
} from "./garments.ts";
import { startCheckout } from "./orders.server.ts";
import { seenTo } from "../../test/msw/server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, TEE, seedUser } from "../../test/seed.ts";

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
    expect(drawn).toContain(
      'data-panel="pocket" d="M162 300 L174 252 H226 L238 300 Z" fill="#c6a15b"',
    );
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
  // Off sale since 2026-11-26. Kept tested for orders paid before that.
  beforeEach(() => setAopOnSaleForTests(true));
  afterEach(() => setAopOnSaleForTests(false));

  async function publishedHoodie(owner = "ada") {
    const mockup = await generateMockup(hoodie(blackGoldChecker()));
    const saved = await saveDesign(owner, {
      ...hoodie(blackGoldChecker()),
      title: "Gold rush hoodie",
      mockupUrl: mockup.mockupUrl,
    });
    return publishDesign(owner, saved.id);
  }

  it("keeps the rule in one place: open because the panels cover every cut piece", () => {
    for (const template of Object.values(AOP_TEMPLATES)) {
      expect(coverageProblems(template.id)).toEqual([]);
      expect(canOrderProduct(template.id)).toBe(true);
      expect(aopOrderable(printfulCard(template.id)?.catalogProductId ?? 0, [])).toBe(true);
    }
    expect(
      aopOrderable(PRINTFUL_AOP.hoodie.catalogProductId, ["front/body_front has no panel."]),
    ).toBe(false);
    expect(canOrderProduct(TEE.productId)).toBe(true);
  });

  it("goes in the bag in the colorway the buyer picked, and checks out in the sandbox", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    await addToCart("bo", piece.id, "aop-hoodie-printed-m", "black-gold");
    const lines = await listCart("bo");
    expect(lines.map((line) => line.designId)).toEqual([piece.id]);
    const quote = await quoteShipping("bo", RECIPIENT);
    expect(quote.subtotalCents).toBeGreaterThan(0);
    const checkout = await startCheckout("bo", {
      recipient: RECIPIENT,
      shippingMethod: quote.rates[0]!.id,
    });
    expect(checkout.mode).toBe("sandbox");
    expect(seenTo("api.printful.com")).toEqual([]);
    const sql = await getSql();
    const recipes = await sql<{ id: string; user_id: string }>`
      select id, user_id from print_files where mime = ${AOP_RECIPE_MIME}
    `;
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.user_id).toBe("bo");
  });

  it("renders every placement at Printful's print size, in the colorway that was bought", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    await addToCart("bo", piece.id, "aop-hoodie-printed-m", "lilac-cream");
    await startCheckout("bo", { recipient: RECIPIENT, shippingMethod: "STANDARD" });
    const sql = await getSql();
    const [recipe] = await sql<{
      id: string;
    }>`select id from print_files where mime = ${AOP_RECIPE_MIME}`;
    const urls = aopFileUrls(recipe!.id, "aop-hoodie");
    expect(urls.map((item) => item.placement)).toEqual([
      "front",
      "back",
      "hood",
      "pocket",
      "label_panel",
      "sleeve_left",
      "sleeve_right",
    ]);
    for (const { url } of urls) {
      const id = new URL(url).pathname.split("/").pop()!;
      expect(parseAopFileId(id)?.recipe).toBe(recipe!.id);
    }
    const file = await renderAopPrintFile(recipe!.id, "pocket");
    expect(file?.mime).toBe("image/png");
    const bytes = file!.bytes;
    // PNG header: width and height are big-endian at bytes 16 and 20.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([6000, 6000]);
    expect(await renderAopPrintFile(recipe!.id, "leg_left")).toBeNull();
    expect(await renderAopPrintFile(crypto.randomUUID(), "front")).toBeNull();
  }, 60_000);

  it("snapshots the piece, so a later edit does not change what was ordered", async () => {
    await seedUser("bo");
    const piece = await publishedHoodie();
    await addToCart("bo", piece.id, "aop-hoodie-printed-m", "black-gold");
    await startCheckout("bo", { recipient: RECIPIENT, shippingMethod: "STANDARD" });
    const sql = await getSql();
    const [row] = await sql<{ data_base64: string }>`
      select data_base64 from print_files where mime = ${AOP_RECIPE_MIME}
    `;
    const recipe = JSON.parse(Buffer.from(row!.data_base64, "base64").toString("utf8")) as {
      colorwayId: string;
      garment: GarmentDesign;
      logoFileId: string;
    };
    expect(recipe.colorwayId).toBe("black-gold");
    expect(recipe.garment.panels.find((item) => item.id === "side_left")?.fill).toMatchObject({
      kind: "pattern",
      pattern: "checker",
    });
    expect(recipe.logoFileId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("publishes an all-over piece to the rack in the sandbox and does not call Printful", async () => {
    const piece = await publishedHoodie();
    expect(piece.status).toBe("published");
    expect(seenTo("api.printful.com")).toEqual([]);
    const sql = await getSql();
    const rows = await sql<{ provider_product_id: string | null }>`
      select provider_product_id from designs where id = ${piece.id}
    `;
    expect(rows[0]?.provider_product_id).toBeNull();
  });

  it("publishes an all-over piece in live mode without a store sync, since orders carry the files", async () => {
    const piece = await publishedHoodie();
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test_key";
    process.env.APP_PUBLIC_URL = "https://streetroyalty.com";
    process.env.PRINT_FILE_SIGNING_SECRET = "a-long-print-secret";
    const again = await publishDesign("ada", piece.id);
    expect(again.status).toBe("published");
    expect(seenTo("api.printful.com")).toEqual([]);
  });
});

describe("all-over pieces off sale", () => {
  it("can't be published or bagged, and a piece already on the rack can't be bought", async () => {
    const mockup = await generateMockup(hoodie(blackGoldChecker()));
    const saved = await saveDesign("ada", {
      ...hoodie(blackGoldChecker()),
      title: "Off sale",
      mockupUrl: mockup.mockupUrl,
    });
    await expect(publishDesign("ada", saved.id)).rejects.toThrow(AOP_ORDER_CLOSED);
    const sql = await getSql();
    // A piece published before the switch.
    await sql`update designs set status = 'published' where id = ${saved.id}`;
    await seedUser("bo");
    await expect(addToCart("bo", saved.id, "aop-hoodie-printed-m", "black-gold")).rejects.toThrow(
      AOP_ORDER_CLOSED,
    );
    expect(await listCart("bo")).toEqual([]);
  });
});
