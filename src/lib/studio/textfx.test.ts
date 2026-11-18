import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  arcLayout,
  clampFx,
  fitFontSize,
  isFlatText,
  lineRiseEm,
  lineSpanEm,
  TEXT_PRESETS,
} from "./textfx.ts";

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

  it("reads left to right on an arch and on a smile, each letter leaning with the curve", () => {
    for (const arc of [-38, -18, -120, 34, 120]) {
      const cells = arcLayout("STREET", clampFx({ arc }));
      const alongs = cells.map((cell) => cell.along);
      // Each letter sits to the right of the one before it.
      for (let index = 1; index < alongs.length; index += 1) {
        assert.ok((alongs[index] ?? 0) > (alongs[index - 1] ?? 0), `arc ${arc}, letter ${index}`);
      }
      assert.ok(Math.abs((alongs[0] ?? 0) + (alongs[alongs.length - 1] ?? 0)) < 1e-9);
      // On an arch the first letter tips left (anticlockwise); on a smile it tips right.
      const first = cells[0]?.rotate ?? 0;
      assert.ok(arc < 0 ? first < 0 : first > 0, `arc ${arc} leans ${first}`);
    }
  });

  it("measures how wide and how tall a laid-out line is", () => {
    assert.equal(lineSpanEm([]), 0);
    const flat = arcLayout("CROWN", clampFx({ tracking: 0.1 }));
    assert.ok(Math.abs(lineSpanEm(flat) - (4 * 0.72 + 1)) < 1e-9);
    assert.equal(lineRiseEm(flat), 1.2);
    const arch = arcLayout("STREET ROYALTY", clampFx({ arc: -38 }));
    assert.ok(lineRiseEm(arch) > 1.2);
  });

  it("shrinks a line that is too wide and leaves one that fits alone", () => {
    assert.equal(fitFontSize(336, 4, 1656), 336);
    assert.equal(fitFontSize(336, 10, 1656), 165.6);
    assert.equal(fitFontSize(336, 0, 1656), 336);
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
