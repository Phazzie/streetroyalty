import { drawPattern, mixHex, type Ctx2D, type PatternSpec } from "@/lib/gfx/patterns";

/** A plain tee, drawn in a 400 by 440 box, with the pattern as its cloth. A preview shape, not a print file. */

export const GARMENT_BOX = { width: 400, height: 440 } as const;

function silhouette(ctx: Ctx2D): void {
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
}

export function drawGarment(
  ctx: Ctx2D,
  spec: PatternSpec,
  widthPx: number,
  outline: string,
  draft = false,
): void {
  const k = widthPx / GARMENT_BOX.width;
  const height = GARMENT_BOX.height * k;
  ctx.clearRect(0, 0, widthPx, height);

  // the cloth, clipped to the tee
  ctx.save();
  ctx.scale(k, k);
  silhouette(ctx);
  ctx.restore();
  ctx.save();
  ctx.clip();
  drawPattern(ctx, spec, widthPx, height, { unit: widthPx / 3.4, draft });
  ctx.restore();

  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // soft folds, so it reads as cloth and not a sticker
  ctx.save();
  silhouette(ctx);
  ctx.clip();
  ctx.strokeStyle = "rgb(0 0 0 / 0.16)";
  ctx.lineWidth = 14;
  for (const [x0, y0, cx, cy, x1, y1] of [
    [96, 158, 150, 210, 128, 300],
    [304, 158, 250, 210, 272, 300],
    [130, 412, 170, 360, 150, 320],
    [270, 412, 240, 370, 262, 330],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(255 255 255 / 0.12)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(196, 110);
  ctx.quadraticCurveTo(214, 250, 200, 400);
  ctx.stroke();
  ctx.restore();

  // neck rib in the pattern's second colour
  const rib = spec.colors[1] ?? "#17101f";
  ctx.strokeStyle = mixHex(rib, "#000000", 0.25);
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(140, 34);
  ctx.quadraticCurveTo(200, 78, 260, 34);
  ctx.stroke();
  ctx.strokeStyle = rib;
  ctx.lineWidth = 10;
  ctx.stroke();

  // seams and the edge
  ctx.strokeStyle = "rgb(0 0 0 / 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  for (const [x0, y0, x1, y1] of [
    [82, 56, 96, 158],
    [318, 56, 304, 158],
    [14, 130, 68, 184],
    [386, 130, 332, 184],
    [98, 400, 302, 400],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 4;
  silhouette(ctx);
  ctx.stroke();
  ctx.restore();
}
