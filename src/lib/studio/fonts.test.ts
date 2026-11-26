import { describe, expect, it } from "vitest";
import { FONTS, fontShorthand, studioFont } from "./fonts.ts";
import { parseLayers } from "./validate.ts";
import { textWidthEm } from "../text/layout.ts";
import { garmentStage } from "../gfx/garments/index.ts";

const text = (extra: Record<string, unknown>) => ({
  id: "t",
  type: "text",
  text: "KING",
  color: "#ffffff",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  ...extra,
});

describe("studio type", () => {
  it("keeps every studio face and drops one it does not serve", () => {
    for (const font of FONTS) expect(parseLayers([text({ font: font.name })])[0]).toMatchObject({ font: font.name });
    expect(parseLayers([text({ font: "Comic Sans MS" })])[0]).toMatchObject({ font: "Archivo Black" });
    expect(studioFont("nope").name).toBe("Archivo Black");
    expect(fontShorthand("UnifrakturCook", 40)).toBe('700 40px "UnifrakturCook", "Archivo Black", sans-serif');
  });

  it("guesses narrow faces narrower than wide ones", () => {
    expect(textWidthEm("STREET", "Bebas Neue")).toBeLessThan(textWidthEm("STREET", "Archivo Black"));
    expect(textWidthEm("STREET", "Rubik Mono One")).toBeGreaterThan(textWidthEm("STREET", "Archivo Black"));
  });

  it("keeps a sticker outline only as a hex, and never with outline-only type", () => {
    expect(parseLayers([text({ stroke: "#ff2d95" })])[0]).toMatchObject({ stroke: "#ff2d95" });
    expect(parseLayers([text({ stroke: "#ff2d95", arc: 20 })])[0]).toMatchObject({ stroke: "#ff2d95", arc: 20 });
    expect(parseLayers([text({ stroke: "red" })])[0]).not.toHaveProperty("stroke");
    expect(parseLayers([text({ stroke: "#ff2d95", outline: true })])[0]).not.toHaveProperty("stroke");
  });
});

describe("the studio stage", () => {
  it("puts the print area where the drawing prints it, sized to the real area", () => {
    const front = garmentStage({ shape: "T-Shirt", colorHex: "#111111", placement: "front", printArea: { widthIn: 12, heightIn: 16 } });
    expect(front.src.startsWith("data:image/svg+xml")).toBe(true);
    expect(front.box.cx).toBeCloseTo(0.5, 1);
    expect((front.box.w * 480) / (front.box.h * 600)).toBeCloseTo(12 / 16, 2);
    const sleeve = garmentStage({ shape: "T-Shirt", colorHex: "#111111", placement: "sleeve_left", printArea: { widthIn: 3.5, heightIn: 3.5 } });
    expect(sleeve.box.w).toBeGreaterThan(0);
    expect(sleeve.box.cx).not.toBeCloseTo(front.box.cx, 2);
  });
});
