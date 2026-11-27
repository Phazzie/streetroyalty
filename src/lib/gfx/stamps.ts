import type { StampId } from "../studio/chat.ts";

/**
 * Art the studio draws in code: one-colour silhouettes, sharp at any print size and
 * free to use. The SVG is pure; `renderStamp` turns it into a PNG in the browser.
 */

type Shape = { w: number; h: number; body: string };

/** [left, width, top] boxes for the low skyline, ground at 500. */
const FILL: [number, number, number][] = [
  [0, 70, 440], [64, 44, 410], [104, 60, 425], [160, 36, 380], [192, 58, 400], [246, 42, 350],
  [284, 62, 372], [342, 40, 318], [378, 58, 345], [432, 50, 300], [478, 50, 330], [676, 40, 300],
  [712, 58, 262], [766, 36, 320], [798, 52, 226], [846, 46, 290], [888, 56, 250], [940, 44, 300],
  [980, 60, 210], [1036, 34, 280], [1150, 46, 240], [1360, 22, 330], [1496, 52, 290],
  [1544, 46, 340], [1586, 64, 370], [1646, 48, 400], [1690, 60, 425], [1746, 54, 450],
];

const SKYLINE: Shape = {
  w: 1800,
  h: 500,
  body: [
    ...FILL.map(([x, w, top]) => `M${x} 500V${top}h${w}V500z`),
    // The tall black one: bundled tubes stepping down, two masts.
    "M524 500V150h36V96h40V58h44v62h36V200h4V500z",
    "M570 58V0h7v58zM606 58V6h7v52z",
    // The one with the rising setbacks and a spire.
    "M1068 500V170h14V120h14V84h12V20h4v64h12v36h14v50h14V500z",
    // The tall flat white slab.
    "M1196 500V64h74V500z",
    // The diamond top, cut on a slant.
    "M1282 500V150l34-46 34 46V500z",
    // The tapered one with two masts.
    "M1388 500l14-438h66l14 438z",
    "M1412 62V2h6v60zM1450 62V2h6v60z",
    // Waterline.
    "M0 492h1800v8H0z",
  ].join(""),
};

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 6) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${points.join("L")}z`;
}

const STAR: Shape = { w: 200, h: 200, body: starPath(100, 100, 98, 50) };

const SHAPES: Record<StampId, Shape> = {
  "chicago-skyline": SKYLINE,
  "chicago-star": STAR,
};

export function stampSvg(stamp: StampId, color: string): string {
  const shape = SHAPES[stamp];
  const fill = /^#[0-9a-f]{6}$/i.test(color) ? color : "#141414";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.w} ${shape.h}" width="${shape.w}" height="${shape.h}"><path fill="${fill}" fill-rule="nonzero" d="${shape.body}"/></svg>`;
}

/** The stamp as a transparent PNG, wide enough to print sharp across a 12 inch area. */
export async function renderStamp(stamp: StampId, color: string, width = 2000): Promise<string> {
  const shape = SHAPES[stamp];
  const height = Math.round((width * shape.h) / shape.w);
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not draw that stamp."));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stampSvg(stamp, color))}`;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw stamps.");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
