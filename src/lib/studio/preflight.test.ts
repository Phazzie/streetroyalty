import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { DesignLayer, PrintArea } from "../pod/types.ts";
import { canPublish, effectiveDpi, preflightVerdict, runPrintChecks } from "./preflight.ts";

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
