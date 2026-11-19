import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { DesignLayer, PrintArea } from "../pod/types.ts";
import {
  canPublish,
  effectiveDpi,
  layerReach,
  preflightVerdict,
  runPrintChecks,
} from "./preflight.ts";

const AREA: PrintArea = { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 };

const WORD: DesignLayer = {
  id: "t",
  type: "text",
  text: "CROWN",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};

describe("the print check", () => {
  it("passes a centered line of light ink", () => {
    const checks = runPrintChecks({ layers: [WORD], area: AREA, garmentHex: "#141414" });
    assert.equal(preflightVerdict(checks), "pass");
    assert.equal(canPublish("pass", false), true);
  });

  it("fails ink that matches the garment, and an override is the only way through", () => {
    const checks = runPrintChecks({
      layers: [{ ...WORD, color: "#141414" }],
      area: AREA,
      garmentHex: "#141414",
    });
    const contrast = checks.find((check) => check.key === "contrast");
    assert.equal(contrast?.level, "fail");
    assert.equal(preflightVerdict(checks), "fail");
    assert.equal(canPublish("fail", false), false);
    assert.equal(canPublish("fail", true), true);
    assert.equal(canPublish("warn", false), true);
  });

  it("warns when a layer spills the box", () => {
    const checks = runPrintChecks({
      layers: [{ ...WORD, x: 0.02, scale: 2 }],
      area: AREA,
      garmentHex: "#141414",
    });
    assert.equal(checks.find((check) => check.key === "bounds")?.level, "warn");
    assert.equal(preflightVerdict(checks), "warn");
  });

  const bounds = (
    layers: DesignLayer[],
    images?: { layerId: string; widthPx: number; heightPx: number }[],
  ) =>
    runPrintChecks({ layers, area: AREA, garmentHex: "#141414", images }).find(
      (check) => check.key === "bounds",
    )?.level;

  it("passes the studio's own starting line, which the print file shrinks to fit", () => {
    // STREET ROYALTY, tilted, a little above centre: what every new piece starts with.
    const starter: DesignLayer = { ...WORD, text: "STREET ROYALTY", y: 0.46, rotation: -8 };
    assert.equal(bounds([starter]), "pass");
    for (const y of [0.3, 0.46, 0.5, 0.6, 0.7])
      assert.equal(bounds([{ ...starter, y }]), "pass", `y ${y}`);
  });

  it("warns when a long line is pushed off centre, since a fitted line still clips", () => {
    assert.equal(bounds([{ ...WORD, text: "STREET ROYALTY", x: 0.85 }]), "warn");
  });

  it("warns when a tall line sits on the bottom edge or a turned one leans out the top", () => {
    assert.equal(bounds([{ ...WORD, y: 0.98, scale: 2 }]), "warn");
    assert.equal(bounds([{ ...WORD, text: "STREET ROYALTY", y: 0.08, rotation: 30 }]), "warn");
  });

  it("measures a curve by the room its ends take", () => {
    const arch: DesignLayer = { ...WORD, text: "STREET ROYALTY", arc: -120, tracking: 0.1 };
    const flatReach = layerReach({ ...arch, arc: 0 }, AREA);
    const archReach = layerReach(arch, AREA);
    assert.ok(archReach.y > flatReach.y);
    assert.equal(bounds([{ ...arch, y: 0.5 }]), "pass");
    assert.equal(bounds([{ ...arch, y: 0.95 }]), "warn");
  });

  it("measures a picture at its own proportions", () => {
    const picture: DesignLayer = {
      id: "p",
      type: "image",
      src: "data:image/png;base64,AAAA",
      x: 0.5,
      y: 0.2,
      scale: 1,
      rotation: 0,
    };
    // Square, it fits. Three times taller than wide, it runs off the top.
    assert.equal(bounds([picture], [{ layerId: "p", widthPx: 600, heightPx: 600 }]), "pass");
    assert.equal(bounds([picture], [{ layerId: "p", widthPx: 600, heightPx: 1800 }]), "warn");
    assert.equal(bounds([{ ...picture, y: 0.5, scale: 2 }]), "warn");
  });

  it("grades artwork by the DPI it actually lands at", () => {
    const image: DesignLayer = {
      id: "art",
      type: "image",
      src: "data:image/png;base64,AAAA",
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
    };
    const placed = effectiveDpi({ layerId: "art", widthPx: 200, heightPx: 200 }, image, AREA);
    assert.ok(placed < 150);
    const soft = runPrintChecks({
      layers: [image],
      area: AREA,
      garmentHex: "#141414",
      images: [{ layerId: "art", widthPx: 200, heightPx: 200 }],
    });
    assert.equal(soft.find((check) => check.key === "dpi")?.level, "fail");
    const sharp = runPrintChecks({
      layers: [image],
      area: AREA,
      garmentHex: "#141414",
      images: [{ layerId: "art", widthPx: 2400, heightPx: 2400 }],
    });
    assert.equal(sharp.find((check) => check.key === "dpi")?.level, "pass");
    const unread = runPrintChecks({ layers: [image], area: AREA, garmentHex: "#141414" });
    assert.equal(unread.find((check) => check.key === "dpi")?.level, "warn");
  });

  it("fails an empty piece", () => {
    const checks = runPrintChecks({ layers: [], area: AREA, garmentHex: "#141414" });
    assert.equal(checks.find((check) => check.key === "empty")?.level, "fail");
  });
});
