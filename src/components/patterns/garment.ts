import { drawPattern, mixHex, type Ctx2D, type PatternSpec } from "@/lib/gfx/patterns";

/**
 * Three plain garment shapes, each drawn in a 400 by 440 box. The blank is one
 * colour and the pattern sits in a print box, the way the studio really prints
 * it. They are sketches for the Pattern Lab, not print files.
 */

export const GARMENT_BOX = { width: 400, height: 440 } as const;

export type GarmentId = "tee" | "hoodie" | "joggers";

export const GARMENTS: { id: GarmentId; name: string }[] = [
  { id: "tee", name: "Tee" },
  { id: "hoodie", name: "Hoodie" },
  { id: "joggers", name: "Sweatpants" },
];

type Line = readonly [number, number, number, number];
type Curve = readonly [number, number, number, number, number, number];

type Shape = {
  outline: (ctx: Ctx2D) => void;
  /** Where the studio prints on this blank: x, y, width, height in the 400 by 440 box. */
  print: readonly [number, number, number, number];
  /** Dashed seams. */
  seams: Line[];
  /** Soft dark folds. */
  folds: Curve[];
  /** Solid parts in the second colour: ribs, cuffs, the inside of a hood. */
  trim: (ctx: Ctx2D, rib: string, deep: string, edge: string) => void;
};

function band(
  ctx: Ctx2D,
  points: readonly (readonly [number, number])[],
  fill: string,
  edge: string,
): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

const SHAPES: Record<GarmentId, Shape> = {
  tee: {
    // Front, 12 by 16 inches.
    print: [140, 96, 120, 160],
    outline(ctx) {
      ctx.beginPath();
      ctx.moveTo(140, 34);
      ctx.quadraticCurveTo(200, 78, 260, 34);
      ctx.lineTo(318, 56);
      ctx.lineTo(392, 136);
      ctx.lineTo(338, 190);
      ctx.lineTo(304, 158);
      ctx.quadraticCurveTo(298, 300, 306, 412);
      ctx.quadraticCurveTo(200, 428, 94, 412);
      ctx.quadraticCurveTo(102, 300, 96, 158);
      ctx.lineTo(62, 190);
      ctx.lineTo(8, 136);
      ctx.lineTo(82, 56);
      ctx.closePath();
    },
    seams: [
      [82, 56, 96, 158],
      [318, 56, 304, 158],
      [14, 130, 68, 184],
      [386, 130, 332, 184],
      [98, 400, 302, 400],
    ],
    folds: [
      [96, 158, 150, 210, 128, 300],
      [304, 158, 250, 210, 272, 300],
      [130, 412, 170, 360, 150, 320],
      [270, 412, 240, 370, 262, 330],
    ],
    trim(ctx, rib, deep) {
      ctx.lineCap = "round";
      ctx.strokeStyle = deep;
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(140, 34);
      ctx.quadraticCurveTo(200, 78, 260, 34);
      ctx.stroke();
      ctx.strokeStyle = rib;
      ctx.lineWidth = 10;
      ctx.stroke();
    },
  },
  hoodie: {
    // Front, 12 by 12 inches, above the pouch.
    print: [146, 168, 108, 108],
    outline(ctx) {
      ctx.beginPath();
      ctx.moveTo(138, 74);
      ctx.bezierCurveTo(128, 2, 272, 2, 262, 74);
      ctx.lineTo(328, 98);
      ctx.quadraticCurveTo(372, 190, 390, 322);
      ctx.lineTo(340, 334);
      ctx.quadraticCurveTo(324, 256, 302, 200);
      ctx.lineTo(304, 414);
      ctx.lineTo(96, 414);
      ctx.lineTo(98, 200);
      ctx.quadraticCurveTo(76, 256, 60, 334);
      ctx.lineTo(10, 322);
      ctx.quadraticCurveTo(28, 190, 72, 98);
      ctx.closePath();
    },
    seams: [
      [72, 98, 98, 200],
      [328, 98, 302, 200],
      [136, 306, 264, 306],
      [136, 306, 118, 376],
      [264, 306, 282, 376],
      [118, 376, 282, 376],
    ],
    folds: [
      [98, 200, 150, 250, 130, 330],
      [302, 200, 250, 250, 270, 330],
      [40, 300, 60, 220, 84, 150],
      [360, 300, 340, 220, 316, 150],
    ],
    trim(ctx, rib, deep, edge) {
      // the inside of the hood
      ctx.beginPath();
      ctx.moveTo(156, 78);
      ctx.bezierCurveTo(152, 26, 248, 26, 244, 78);
      ctx.quadraticCurveTo(200, 112, 156, 78);
      ctx.closePath();
      ctx.fillStyle = deep;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      band(
        ctx,
        [
          [96, 392],
          [304, 392],
          [304, 414],
          [96, 414],
        ],
        rib,
        edge,
      );
      band(
        ctx,
        [
          [14, 300],
          [64, 312],
          [60, 334],
          [10, 322],
        ],
        rib,
        edge,
      );
      band(
        ctx,
        [
          [386, 300],
          [336, 312],
          [340, 334],
          [390, 322],
        ],
        rib,
        edge,
      );
      // drawstrings
      ctx.lineCap = "round";
      ctx.strokeStyle = rib;
      ctx.lineWidth = 5;
      for (const [x0, x1] of [
        [184, 178],
        [216, 224],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(x0, 96);
        ctx.quadraticCurveTo(x0, 130, x1, 168);
        ctx.stroke();
      }
    },
  },
  joggers: {
    // Down the front of the left leg.
    print: [112, 120, 46, 200],
    outline(ctx) {
      ctx.beginPath();
      ctx.moveTo(108, 26);
      ctx.lineTo(292, 26);
      ctx.quadraticCurveTo(312, 120, 322, 404);
      ctx.lineTo(236, 412);
      ctx.quadraticCurveTo(226, 250, 204, 160);
      ctx.lineTo(196, 160);
      ctx.quadraticCurveTo(174, 250, 164, 412);
      ctx.lineTo(78, 404);
      ctx.quadraticCurveTo(88, 120, 108, 26);
      ctx.closePath();
    },
    seams: [
      [200, 52, 200, 160],
      [112, 66, 136, 124],
      [288, 66, 264, 124],
    ],
    folds: [
      [100, 150, 150, 200, 124, 300],
      [300, 150, 250, 200, 276, 300],
      [150, 400, 130, 340, 150, 280],
      [250, 400, 270, 340, 250, 280],
    ],
    trim(ctx, rib, _deep, edge) {
      band(
        ctx,
        [
          [108, 26],
          [292, 26],
          [297, 52],
          [103, 52],
        ],
        rib,
        edge,
      );
      band(
        ctx,
        [
          [79, 380],
          [165, 388],
          [164, 412],
          [78, 404],
        ],
        rib,
        edge,
      );
      band(
        ctx,
        [
          [321, 380],
          [235, 388],
          [236, 412],
          [322, 404],
        ],
        rib,
        edge,
      );
      ctx.lineCap = "round";
      ctx.strokeStyle = edge;
      ctx.lineWidth = 4;
      for (const x of [190, 210]) {
        ctx.beginPath();
        ctx.moveTo(x, 44);
        ctx.quadraticCurveTo(x - (200 - x) * 0.6, 70, x - (200 - x) * 1.4, 92);
        ctx.stroke();
      }
    },
  },
};

/** A plain blank that sets the print off: black under light prints, bone under dark ones. */
function blankColor(spec: PatternSpec): string {
  const ground = spec.colors[0] ?? "#000000";
  const hex = ground.replace("#", "");
  const n = Number.parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16) || 0;
  const light = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  return light > 140 ? "#1b1b1c" : "#f5e8ce";
}

export function drawGarment(
  ctx: Ctx2D,
  spec: PatternSpec,
  widthPx: number,
  outline: string,
  draft = false,
  garment: GarmentId = "tee",
): void {
  const shape = SHAPES[garment];
  const k = widthPx / GARMENT_BOX.width;
  const height = GARMENT_BOX.height * k;
  ctx.clearRect(0, 0, widthPx, height);

  // the blank, in one colour
  const body = blankColor(spec);
  ctx.save();
  ctx.scale(k, k);
  shape.outline(ctx);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();

  // the pattern, only where it prints
  const [px, py, pw, ph] = shape.print;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px * k, py * k, pw * k, ph * k);
  ctx.clip();
  ctx.translate(px * k, py * k);
  drawPattern(ctx, spec, pw * k, ph * k, { unit: widthPx / 3.4, draft });
  ctx.restore();

  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // soft folds, so it reads as cloth and not a sticker
  ctx.save();
  shape.outline(ctx);
  ctx.clip();
  ctx.strokeStyle = "rgb(0 0 0 / 0.16)";
  ctx.lineWidth = 14;
  for (const [x0, y0, cx, cy, x1, y1] of shape.folds) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgb(0 0 0 / 0.38)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  for (const [x0, y0, x1, y1] of shape.seams) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Ribs and cuffs are the blank's own colour: a blank is one dyed fabric.
  shape.trim(ctx, body, mixHex(body, "#000000", 0.35), mixHex(body, "#000000", 0.6));

  ctx.strokeStyle = outline;
  ctx.lineWidth = 4;
  shape.outline(ctx);
  ctx.stroke();
  ctx.restore();
}
