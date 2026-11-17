import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { arcLayout, clampFx, isFlatText, TEXT_PRESETS } from "./textfx.ts";

describe("curved text", () => {
  it("lays a flat line with tracking and no rotation", () => {
    const cells = arcLayout("CROWN", clampFx({ tracking: 0.1 }));
    assert.equal(cells.length, 5);
    assert.ok(cells.every((cell) => cell.rotate === 0 && cell.lift === 0));
    assert.ok((cells[0]?.along ?? 0) < 0);
    assert.ok((cells[4]?.along ?? 0) > 0);
    assert.equal(cells.map((cell) => cell.char).join(""), "CROWN");
  });

  it("arches the ends downward and smiles them upward", () => {
    const arch = arcLayout("CROWN", clampFx({ arc: -40 }));
    const smile = arcLayout("CROWN", clampFx({ arc: 40 }));
    assert.ok((arch[0]?.lift ?? 0) > 0);
    assert.ok((smile[0]?.lift ?? 0) < 0);
    assert.notEqual(arch[0]?.rotate, 0);
    assert.equal(arch[2]?.rotate, 0);
  });

  it("clamps wild bends and treats one letter as flat", () => {
    assert.equal(clampFx({ arc: 400, tracking: 9 }).arc, 120);
    assert.equal(clampFx({ arc: Number.NaN, tracking: Number.NaN }).arc, 0);
    assert.equal(clampFx({ tracking: -1 }).tracking, -0.05);
    assert.equal(arcLayout("R", clampFx({ arc: -80 }))[0]?.rotate, 0);
    assert.deepEqual(arcLayout("", FLAT()), []);
  });

  it("ships presets that are not all flat", () => {
    assert.ok(TEXT_PRESETS.some((preset) => !isFlatText(preset.fx)));
    assert.ok(TEXT_PRESETS.some((preset) => preset.fx.outline));
    assert.equal(isFlatText(clampFx(undefined)), true);
  });
});

function FLAT() {
  return clampFx(undefined);
}
