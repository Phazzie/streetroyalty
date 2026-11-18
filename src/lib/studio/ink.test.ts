import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast.ts";
import type { DesignLayer } from "../pod/types.ts";
import { defaultGarment, HOUSE_COLORWAYS } from "./garments.ts";
import {
  garmentInk,
  HOUSE_LIME,
  printGround,
  restoreInk,
  swapForAllOver,
  swapNote,
} from "./ink.ts";
import { runPrintChecks } from "./preflight.ts";

const TEE_BLACK = "#141414";
const LILAC = HOUSE_COLORWAYS[0]!.colors; // lilac body, night logo colour
const BLACK_GOLD = HOUSE_COLORWAYS[2]!.colors; // black body, cream logo colour

const starter: DesignLayer = {
  id: "tagline",
  type: "text",
  text: "STREET ROYALTY",
  font: "Archivo Black",
  color: HOUSE_LIME,
  x: 0.5,
  y: 0.46,
  scale: 1,
  rotation: -8,
};
const pink: DesignLayer = { ...starter, id: "pink", text: "NEW", color: "#ff2d95" };
const art: DesignLayer = {
  id: "art",
  type: "image",
  src: "data:image/png;base64,AAAA",
  x: 0.5,
  y: 0.4,
  scale: 1,
  rotation: 0,
};

function colorOf(layers: DesignLayer[], id: string): string | undefined {
  const layer = layers.find((item) => item.id === id);
  return layer?.type === "text" ? layer.color : undefined;
}

describe("swapForAllOver", () => {
  it("starts lime in the logo colour on a lilac body and remembers the maker's lime", () => {
    const moved = swapForAllOver([starter, pink, art], LILAC);
    expect(colorOf(moved.layers, "tagline")).toBe(LILAC.mark);
    expect(moved.swap).toEqual({ tagline: { mine: HOUSE_LIME, studio: LILAC.mark } });
  });

  it("never touches any ink but lime, and never touches pictures", () => {
    const moved = swapForAllOver([starter, pink, art], LILAC);
    expect(colorOf(moved.layers, "pink")).toBe("#ff2d95");
    expect(moved.layers[2]).toBe(art);
  });

  it("leaves lime alone where it already reads", () => {
    const layers = [starter, pink];
    const moved = swapForAllOver(layers, BLACK_GOLD);
    expect(moved.layers).toBe(layers);
    expect(moved.swap).toEqual({});
  });

  it("reads lime however its hex is written", () => {
    const loud = { ...starter, color: "#D6FF3C" };
    expect(colorOf(swapForAllOver([loud], LILAC).layers, "tagline")).toBe(LILAC.mark);
  });

  it("does not swap to a logo colour that reads no better", () => {
    const moved = swapForAllOver([starter], { body: LILAC.body, mark: "#c9adea" });
    expect(colorOf(moved.layers, "tagline")).toBe(HOUSE_LIME);
  });
});

describe("restoreInk", () => {
  it("tee to all-over and back keeps the maker's colours", () => {
    const onTee = [starter, pink, art];
    const onHoodie = swapForAllOver(onTee, LILAC);
    const back = restoreInk(onHoodie.layers, onHoodie.swap);
    expect(back.layers).toEqual(onTee);
    expect(back.restored).toBe(1);
  });

  it("keeps a colour the maker picked while on the all-over blank", () => {
    const onHoodie = swapForAllOver([starter, pink], LILAC);
    const repainted = onHoodie.layers.map((layer) =>
      layer.id === "tagline" && layer.type === "text" ? { ...layer, color: "#ff6a00" } : layer,
    );
    const back = restoreInk(repainted, onHoodie.swap);
    expect(colorOf(back.layers, "tagline")).toBe("#ff6a00");
    expect(back.restored).toBe(0);
    expect(back.layers).toBe(repainted);
  });

  it("keeps lime the maker put back on purpose", () => {
    const onHoodie = swapForAllOver([starter], LILAC);
    const limeAgain = onHoodie.layers.map((layer) => ({ ...layer, color: HOUSE_LIME }));
    expect(colorOf(restoreInk(limeAgain, onHoodie.swap).layers, "tagline")).toBe(HOUSE_LIME);
  });

  it("does nothing for layers the studio never changed, or that were deleted", () => {
    const onHoodie = swapForAllOver([starter, pink], LILAC);
    const without = onHoodie.layers.filter((layer) => layer.id !== "tagline");
    const back = restoreInk(without, onHoodie.swap);
    expect(back.layers).toBe(without);
    expect(back.restored).toBe(0);
  });
});

describe("printGround", () => {
  const hoodie = defaultGarment("aop-hoodie");

  it("measures an all-over piece against its active colourway's body", () => {
    expect(
      printGround({ aopTemplateId: "aop-hoodie", garment: hoodie, variantHex: "#c4a6e0" }),
    ).toBe(LILAC.body);
    const gold = { ...hoodie, activeColorwayId: "black-gold" };
    expect(printGround({ aopTemplateId: "aop-hoodie", garment: gold, variantHex: "#c4a6e0" })).toBe(
      BLACK_GOLD.body,
    );
  });

  it("measures a tee against the tee, even with an all-over garment left over", () => {
    expect(printGround({ aopTemplateId: null, garment: hoodie, variantHex: TEE_BLACK })).toBe(
      TEE_BLACK,
    );
    expect(printGround({ garment: hoodie, variantHex: "#efe6d6" })).toBe("#efe6d6");
  });

  it("does not use a garment drawn for a different all-over blank", () => {
    expect(
      printGround({ aopTemplateId: "aop-joggers", garment: hoodie, variantHex: "#c4a6e0" }),
    ).toBe("#c4a6e0");
  });

  it("falls back to black when nothing is chosen yet", () => {
    expect(printGround({ garment: null })).toBe("#141414");
  });
});

describe("the reviewer's round trip", () => {
  const area = { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 };
  const hoodie = defaultGarment("aop-hoodie");

  function inkCheck(layers: DesignLayer[], garmentHex: string) {
    return runPrintChecks({ layers, area, garmentHex }).find((check) => check.key === "contrast");
  }

  it("black tee, AOP hoodie, black tee: lime is back and the check reads the tee", () => {
    const onHoodie = swapForAllOver([starter], LILAC);
    const back = restoreInk(onHoodie.layers, onHoodie.swap).layers;
    const ground = printGround({ aopTemplateId: null, garment: hoodie, variantHex: TEE_BLACK });
    expect(colorOf(back, "tagline")).toBe(HOUSE_LIME);
    expect(ground).toBe(TEE_BLACK);
    expect(inkCheck(back, ground)?.level).toBe("pass");
  });

  it("night ink the maker chose on the hoodie fails on the black tee", () => {
    const onHoodie = swapForAllOver([starter], LILAC);
    const night = onHoodie.layers.map((layer) => ({ ...layer, color: "#141018" }));
    const back = restoreInk(night, onHoodie.swap);
    const ground = printGround({ aopTemplateId: null, garment: hoodie, variantHex: TEE_BLACK });
    expect(colorOf(back.layers, "tagline")).toBe("#141018");
    expect(contrastRatio("#141018", ground)).toBeLessThan(1.2);
    expect(inkCheck(back.layers, ground)?.level).toBe("fail");
  });
});

describe("swapNote", () => {
  it("says what changed and that it comes back, plainly", () => {
    for (const note of [swapNote(1), swapNote(3)]) {
      expect(note).toContain("logo colour");
      expect(note).toContain("comes back");
      expect(note).not.toContain("!");
      expect(note.endsWith(".")).toBe(true);
    }
    expect(swapNote(1)).toContain("your lime text starts");
    expect(swapNote(2)).toContain("your lime text layers start");
  });
});

describe("garmentInk", () => {
  it("reads the body and logo colours of the active colourway", () => {
    const hoodie = defaultGarment("aop-hoodie");
    expect(garmentInk(hoodie)).toEqual({ body: LILAC.body, mark: LILAC.mark });
    expect(garmentInk({ ...hoodie, activeColorwayId: "black-gold" })).toEqual({
      body: BLACK_GOLD.body,
      mark: BLACK_GOLD.mark,
    });
  });
});
