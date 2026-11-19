import { describe, expect, it } from "vitest";
import { createSandboxProvider } from "../pod/sandbox.ts";
import type { CatalogProduct } from "../pod/types.ts";
import { MAX_LAYERS, parseLayers } from "../studio/validate.ts";
import { colorDistance, colorName, findColors, nearestColor } from "./colors.ts";
import { buildLayers, fitIntent, ghostLayers, pickProduct, pieceTitle } from "./fit.ts";
import { applyUtterance, emptyIntent, type SayIntent } from "./parse.ts";

/** The list has no variants, so the page loads the full blank before fitting. So does this. */
async function catalog(): Promise<CatalogProduct[]> {
  const provider = createSandboxProvider(new Map(), 2);
  const page = await provider.listProducts({ offset: 0, limit: 24 });
  return Promise.all(page.products.map((product) => provider.getProduct(product.id)));
}

function intentFor(...sentences: string[]): SayIntent {
  let intent = emptyIntent();
  for (const sentence of sentences) intent = applyUtterance(intent, sentence).intent;
  return intent;
}

describe("colours", () => {
  it("finds the longest phrase", () => {
    expect(findColors("a hot pink tee and royal blue ink").map((hit) => hit.word)).toEqual([
      "hot pink",
      "royal blue",
    ]);
    expect(findColors("blackout").length).toBe(0);
  });

  it("measures distance the way an eye does", () => {
    expect(colorDistance("#141414", "#141414")).toBe(0);
    expect(colorDistance("#ffffff", "#efe6d6")).toBeLessThan(colorDistance("#ffffff", "#141414"));
    const options = [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
      { name: "Royal", hex: "#2f5bff" },
    ];
    expect(nearestColor("#ffffff", options)?.option.name).toBe("Bone");
    expect(nearestColor("#14213d", options)?.option.name).toBe("Black");
    expect(nearestColor("#2563eb", options)?.option.name).toBe("Royal");
    expect(nearestColor("#ffffff", [])).toBeNull();
  });

  it("names any hex in plain words", () => {
    expect(colorName("#141414")).toBe("black");
    expect(colorName("#FF2D95")).toBe("hot pink");
    expect(colorName("#fefefe")).toBe("white");
  });
});

describe("fitting onto the sandbox catalog", () => {
  it("picks the blank by type", async () => {
    const products = await catalog();
    expect(pickProduct("tee", products)?.id).toBe("tee-heavy");
    expect(pickProduct("hoodie", products)?.id).toBe("hoodie-pullover");
    expect(pickProduct("hat", products)?.id).toBe("hat-dad");
    expect(pickProduct("crewneck", products)?.id).toBe("crew-sweat");
    expect(pickProduct("hat", [])).toBeNull();
  });

  it("fits the brief's hoodie exactly, with nothing to explain", async () => {
    const intent = intentFor("put DO BETTER on the back of a black hoodie in pink, big");
    const product = pickProduct(intent.blank, await catalog());
    const fit = fitIntent(intent, product as CatalogProduct);
    expect(fit.productId).toBe("hoodie-pullover");
    expect(fit.variantId).toBe("hoodie-pullover-black-m");
    expect(fit.placement).toBe("back");
    expect(fit.notes).toEqual([]);
    expect(fit.title).toBe("DO BETTER");
    expect(fit.layers).toEqual([
      {
        id: "say-1",
        type: "text",
        text: "DO BETTER",
        font: "Archivo Black",
        color: "#ff5fa2",
        x: 0.5,
        y: 0.48,
        scale: 1.6,
        rotation: 0,
      },
    ]);
  });

  it("says so when the blank does not come in that colour", async () => {
    const intent = intentFor("a white tee that says free world in blue");
    const fit = fitIntent(intent, pickProduct("tee", await catalog()) as CatalogProduct);
    expect(fit.colorName).toBe("Bone");
    expect(fit.variantId).toBe("tee-heavy-bone-m");
    expect(fit.notes).toEqual(["Closest this blank comes in: Bone."]);
  });

  it("says where a hat prints when asked for the back", async () => {
    const intent = intentFor("hat with my name Dre on it", "on the back");
    const fit = fitIntent(intent, pickProduct("hat", await catalog()) as CatalogProduct);
    expect(fit.placement).toBe("front");
    expect(fit.variantId).toBe("hat-dad-black-one-size");
    expect(fit.notes[0]).toBe(
      "This blank does not print on the back. It prints on the front, so it went on the front.",
    );
  });

  it("puts a sleeve print on a sleeve the tee has, and moves it on a hoodie", async () => {
    const products = await catalog();
    const tee = fitIntent(
      intentFor("a tee that says hi", "on the sleeve"),
      pickProduct("tee", products) as CatalogProduct,
    );
    expect(tee.placement).toBe("sleeve_left");
    expect(tee.notes).toEqual([]);
    const hoodie = fitIntent(
      intentFor("a hoodie that says hi", "on the sleeve"),
      pickProduct("hoodie", products) as CatalogProduct,
    );
    expect(hoodie.placement).toBe("front");
    expect(hoodie.notes[0]).toContain("does not print on the sleeve");
    expect(hoodie.notes[0]).toContain("front or back");
  });

  it("every fit is something the studio will accept", async () => {
    const products = await catalog();
    const sentences = [
      "put DO BETTER on the back of a black hoodie in pink, big",
      "a white tee that says free world in blue across the chest",
      "hat with my name Dre on it",
      "a lilac crewneck that says no encore, huge, tilt it",
    ];
    for (const sentence of sentences) {
      const intent = intentFor(sentence, "second line still here", "add a line that says always");
      const product = pickProduct(intent.blank, products) as CatalogProduct;
      const fit = fitIntent(intent, product);
      expect(parseLayers(fit.layers)).toEqual(fit.layers);
      expect(product.variants.some((variant) => variant.id === fit.variantId)).toBe(true);
      expect(product.placements.some((item) => item.placement === fit.placement)).toBe(true);
    }
  });
});

describe("layers", () => {
  it("stacks lines top to bottom inside the print area", () => {
    const intent = intentFor(
      "a tee that says one, huge",
      ...Array.from({ length: 9 }, (_item, index) => `add a line that says row ${index}`),
    );
    const layers = buildLayers(intent);
    expect(layers.length).toBe(MAX_LAYERS);
    const ys = layers.map((layer) => layer.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    for (const layer of layers) {
      expect(layer.x).toBe(0.5);
      expect(layer.y).toBeGreaterThanOrEqual(0);
      expect(layer.y).toBeLessThanOrEqual(1);
      expect(layer.scale).toBeGreaterThanOrEqual(0.15);
      expect(layer.scale).toBeLessThanOrEqual(3);
    }
    expect(new Set(layers.map((layer) => layer.id)).size).toBe(layers.length);
  });

  it("carries tilt, case and font through", () => {
    const [layer] = buildLayers(
      intentFor("a tee that says hi", "tilt it", "lowercase", "plain letters"),
    );
    expect(layer).toMatchObject({ text: "hi", rotation: -8, font: "Outfit" });
  });

  it("falls back to a house font for a font the studio does not have", () => {
    const [layer] = buildLayers({ ...intentFor("a tee that says hi"), font: "Comic Sans" });
    expect(layer).toMatchObject({ font: "Archivo Black" });
  });

  it("an empty piece has no layers, and the stand-in is valid and faint", () => {
    expect(buildLayers(emptyIntent())).toEqual([]);
    const ghost = ghostLayers("#141414");
    expect(parseLayers(ghost)).toEqual(ghost);
    const [only] = ghost;
    expect(only?.type === "text" && colorDistance(only.color, "#141414")).toBeLessThan(40);
  });

  it("names the piece after its first line", () => {
    expect(pieceTitle([{ text: "DO BETTER", color: "#fff", size: "big", tilt: 0 }], "Tee")).toBe(
      "DO BETTER",
    );
    expect(pieceTitle([{ text: "X", color: "#fff", size: "big", tilt: 0 }], "Dad Hat")).toBe(
      "Said Dad Hat",
    );
    expect(pieceTitle([], "Dad Hat")).toBe("Said Dad Hat");
  });
});
