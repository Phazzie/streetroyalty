import { beforeEach, describe, expect, it } from "vitest";
import { generateMockup, getDesign, saveDesign } from "./designs.server.ts";
import { defaultGarment, setPanelFill, type GarmentDesign } from "./garments.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { seedUser } from "../../test/seed.ts";

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
