import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { AOP_TEMPLATES } from "../panels.ts";
import {
  OUTLINE_TEMPLATE_IDS,
  TEMPLATE_UNITS,
  outlineFor,
  pathPoints,
  pieceArea,
  piecesOf,
  placementOf,
  printPixels,
  templateToPrintPx,
  type OutlinePiece,
} from "./index.ts";

/**
 * The placements Printful cuts pieces from, per its v2 catalog
 * (GET /v2/catalog-products/{388,400,801}, 2026-11-19), without the printed labels
 * and the mockup-only placement. Written out here so the check runs from the
 * printer's side: a placement the outlines leave out fails, not just a bad one.
 */
const PRINTER_CUT_PLACEMENTS: Record<string, string[]> = {
  "aop-hoodie": ["front", "back", "sleeve_left", "sleeve_right", "pocket", "hood", "label_panel"],
  "aop-joggers": ["leg_left", "leg_right"],
  "aop-track-jacket": ["front", "back", "sleeve_left", "sleeve_right", "details", "pocket"],
};

function inside(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

/** Share of `a`'s area that also lies inside `b`, sampled on a grid. */
function overlapShare(a: OutlinePiece, b: OutlinePiece): number {
  const polyA = pathPoints(a.path);
  const polyB = pathPoints(b.path);
  const [x, y, w, h] = a.bbox;
  let inA = 0;
  let inBoth = 0;
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const point = { x: x + (w * i) / steps, y: y + (h * j) / steps };
      if (!inside(point, polyA)) continue;
      inA += 1;
      if (inside(point, polyB)) inBoth += 1;
    }
  }
  return inA === 0 ? 0 : inBoth / inA;
}

describe("printer cut outlines", () => {
  it("has an outline for every all-over template, and none for unknown ids", () => {
    assert.deepEqual([...OUTLINE_TEMPLATE_IDS].sort(), Object.keys(AOP_TEMPLATES).sort());
    assert.equal(outlineFor("tee-heavy"), null);
    assert.equal(outlineFor("toString"), null);
  });

  it("covers every placement the printer cuts, and only those", () => {
    for (const [templateId, expected] of Object.entries(PRINTER_CUT_PLACEMENTS)) {
      const outline = outlineFor(templateId);
      assert.ok(outline, templateId);
      assert.deepEqual(
        outline.placements.map((item) => item.placement).sort(),
        [...expected].sort(),
        templateId,
      );
      for (const placement of outline.placements) {
        assert.ok(
          placement.pieces.length > 0,
          `${templateId} ${placement.placement} has no pieces`,
        );
      }
    }
  });

  it("names every piece once per garment", () => {
    for (const templateId of OUTLINE_TEMPLATE_IDS) {
      const ids = piecesOf(templateId).map((item) => item.piece.id);
      assert.equal(new Set(ids).size, ids.length, templateId);
    }
  });

  it("draws every piece as a closed shape on the sheet, inside its box", () => {
    for (const templateId of OUTLINE_TEMPLATE_IDS) {
      for (const { placement, piece } of piecesOf(templateId)) {
        const where = `${templateId} ${placement} ${piece.id}`;
        assert.match(piece.path, /^M[\d. L-]+ Z$/, where);
        const points = pathPoints(piece.path);
        assert.ok(points.length >= 4, where);
        const [x, y, w, h] = piece.bbox;
        for (const point of points) {
          assert.ok(point.x >= 0 && point.x <= TEMPLATE_UNITS, where);
          assert.ok(point.y >= 0 && point.y <= TEMPLATE_UNITS, where);
          assert.ok(point.x >= x - 6 && point.x <= x + w + 6, `${where} x outside its box`);
          assert.ok(point.y >= y - 6 && point.y <= y + h + 6, `${where} y outside its box`);
        }
        assert.ok(pieceArea(piece) > 0.4 * w * h, `${where} is thinner than its box`);
      }
    }
  });

  it("keeps the pieces on one sheet apart", () => {
    for (const templateId of OUTLINE_TEMPLATE_IDS) {
      for (const placement of outlineFor(templateId)!.placements) {
        for (const a of placement.pieces) {
          for (const b of placement.pieces) {
            if (a === b) continue;
            assert.ok(
              overlapShare(a, b) < 0.03,
              `${templateId} ${placement.placement}: ${a.id} overlaps ${b.id}`,
            );
          }
        }
      }
    }
  });

  it("has no side panels or piping on the hoodie: they are printed, not cut", () => {
    const ids = piecesOf("aop-hoodie").map((item) => item.piece.id);
    for (const expected of [
      "body_front",
      "body_back",
      "waistband_front",
      "waistband_back",
      "sleeve_left",
      "sleeve_right",
      "cuff_left",
      "cuff_right",
      "pocket",
      "hood_1",
      "hood_2",
      "hood_3",
      "hood_4",
      "label_panel",
    ]) {
      assert.ok(ids.includes(expected), expected);
    }
    assert.ok(!ids.some((id) => /side|piping/.test(id)), ids.join(", "));
  });

  it("cuts each jogger leg as one piece, front and back together", () => {
    assert.deepEqual(
      piecesOf("aop-joggers").map((item) => `${item.placement}:${item.piece.id}`),
      [
        "leg_left:waistband_left",
        "leg_left:leg_left",
        "leg_left:cuff_left",
        "leg_right:waistband_right",
        "leg_right:leg_right",
        "leg_right:cuff_right",
      ],
    );
  });

  it("sizes the print files at 150 DPI", () => {
    assert.deepEqual(printPixels(placementOf("aop-hoodie", "front")!), {
      width: 6000,
      height: 6000,
    });
    assert.deepEqual(printPixels(placementOf("aop-joggers", "leg_left")!), {
      width: 4950,
      height: 7500,
    });
    assert.deepEqual(printPixels(placementOf("aop-track-jacket", "back")!), {
      width: 6600,
      height: 6900,
    });
  });

  it("maps the print area's corners to the print file's corners", () => {
    const front = placementOf("aop-hoodie", "front")!;
    const area = front.printArea;
    assert.deepEqual(templateToPrintPx(front, { x: area.left, y: area.top }), { x: 0, y: 0 });
    const far = templateToPrintPx(front, { x: area.left + area.width, y: area.top + area.height });
    assert.ok(Math.abs(far.x - 6000) < 1e-6 && Math.abs(far.y - 6000) < 1e-6);
    const leg = placementOf("aop-joggers", "leg_left")!;
    const mid = templateToPrintPx(leg, {
      x: leg.printArea.left + leg.printArea.width / 2,
      y: leg.printArea.top + leg.printArea.height / 2,
    });
    assert.ok(Math.abs(mid.x - 2475) < 1e-6 && Math.abs(mid.y - 3750) < 1e-6);
  });
});
