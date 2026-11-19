import type { DesignLayer } from "../../pod/types.ts";
import {
  arcLayout,
  clampFx,
  fitFontSize,
  isFlatText,
  LINE_FIT,
  lineSpanEm,
  OUTLINE_EM,
  TEXT_EM,
  textWidthEm,
} from "../../studio/textfx.ts";
import {
  drawGarment,
  resolveShape,
  resolveView,
  type Drawing,
  type GarmentShape,
  type GarmentView,
  type Part,
  type PrintWindow,
  type Tone,
} from "./shapes.ts";

/**
 * Mockups that look like clothes: a flat lay on the night table, drawn as one SVG.
 *
 * The result goes in an <img>, so it carries no script, no outside resource and no web
 * font. Layer text, colours and picture links are somebody's input: every one is checked
 * and escaped before it reaches the markup.
 *
 * Art is placed the way the print file places it (src/components/studio/print-file.ts):
 * a layer's x and y are a share of the print area, type is 14% of the area's height at
 * scale 1 and never wider than 92% of it, a picture is 52% of the area's width.
 */

export { GARMENT_SHAPES, resolveShape, resolveView } from "./shapes.ts";
export type { GarmentShape, GarmentView, PrintWindow } from "./shapes.ts";

export type GarmentMockupInput = {
  shape: string;
  colorHex: string;
  placement: string;
  layers: DesignLayer[];
  /**
   * The blank's real print area, when the caller has it (a MockupRequest carries one).
   * The drawn area takes its proportions, so art sits where the print file puts it.
   * Left out, each shape uses the area of its sandbox blank.
   */
  printArea?: { widthIn: number; heightIn: number };
};

type Rgb = readonly [number, number, number];

const NIGHT: Rgb = [11, 6, 20];
const WHITE: Rgb = [255, 255, 255];
const PAPER = "#f5ebdd";
const INK = "#17101f";
const FALLBACK_COLOR = "#141414";
const MAX_TEXT = 120;
const MAX_LAYERS = 40;

/* ---------------------------------------------------------------- safety */

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Keeps only characters XML allows, so hostile text cannot break the picture. */
function cleanText(value: unknown): string {
  const out: string[] = [];
  for (const char of String(value ?? "")) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x9 || code === 0xa || code === 0xd) out.push(" ");
    else if (
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      code >= 0x10000
    ) {
      out.push(char);
    }
    if (out.length >= MAX_TEXT) break;
  }
  return out.join("");
}

function garmentHex(value: unknown): string {
  const raw = String(value ?? "").trim();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const long = /^#?([0-9a-f]{6})$/i.exec(raw);
  return long ? `#${long[1]}`.toLowerCase() : FALLBACK_COLOR;
}

/** A layer colour: a hex, a plain colour name, or rgb()/hsl(). Anything else is dropped. */
function inkColor(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw.toLowerCase();
  if (/^[a-z]{3,24}$/i.test(raw)) return raw.toLowerCase();
  if (/^(?:rgb|hsl)a?\([0-9.,%\s/]{1,48}\)$/i.test(raw)) return raw.toLowerCase();
  return fallback;
}

/**
 * A picture can only come from inside the file. An <img> never loads an outside link
 * from within an SVG, and a link that did load would tell a stranger who is looking.
 */
function pictureHref(value: unknown): string | null {
  const raw = String(value ?? "");
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(raw) ? raw : null;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const f = (value: number) => String(Math.round(value * 10) / 10);

/* ---------------------------------------------------------------- colour */

function toRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: Rgb, b: Rgb, amount: number): string {
  const part = (i: 0 | 1 | 2) =>
    Math.round(a[i] + (b[i] - a[i]) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${part(0)}${part(1)}${part(2)}`;
}

/** Perceived lightness of a garment colour, 0 to 1. */
export function garmentLuminance(colorHex: string): number {
  const [r, g, b] = toRgb(garmentHex(colorHex));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

type Palette = Record<Tone, string> & {
  ribLine: string;
  seam: string;
  stitch: string;
  edge: string;
  shade: string;
  shadeAlpha: number;
  lightAlpha: number;
  grain: string;
  grainAlpha: number;
  dark: boolean;
};

/**
 * Every tone on the garment comes from its own colour. A dark cloth cannot get darker,
 * so its shape is told with highlights; a pale one is told with shadow.
 */
function palette(hex: string): Palette {
  const base = toRgb(hex);
  const lum = garmentLuminance(hex);
  const dark = lum < 0.2;
  const pale = lum > 0.6;
  return {
    base: hex,
    rib: dark ? mix(base, WHITE, 0.07) : mix(base, NIGHT, 0.08),
    ribLine: dark ? mix(base, WHITE, 0.24) : mix(base, NIGHT, 0.34),
    inner: dark ? mix(base, [0, 0, 0], 0.55) : mix(base, NIGHT, 0.48),
    trim: pale ? INK : PAPER,
    label: "#fffaf2",
    metal: "#cfc8dc",
    cord: pale ? mix(base, NIGHT, 0.34) : PAPER,
    seam: dark ? mix(base, WHITE, 0.2) : mix(base, NIGHT, 0.5),
    stitch: dark ? mix(base, WHITE, 0.4) : mix(base, NIGHT, 0.46),
    edge: dark ? mix(base, WHITE, 0.3) : mix(base, NIGHT, 0.55),
    shade: dark ? "#000000" : mix(base, NIGHT, 0.86),
    shadeAlpha: Math.min(0.62, Math.max(0.24, 0.6 - 0.36 * lum)),
    lightAlpha: Math.min(0.3, Math.max(0.12, 0.12 + 0.2 * lum)),
    grain: dark ? "1" : "0",
    grainAlpha: dark ? 0.1 : pale ? 0.2 : 0.17,
    dark,
  };
}

/* ------------------------------------------------------------------ art */

const DISPLAY_STACK =
  "'Archivo Black','Arial Black','Arial Bold',Impact,'Helvetica Neue',Arial,sans-serif";
const BODY_STACK = "Outfit,'Avenir Next','Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * How wide a line sets, in ems. The picture cannot measure type, and the face it gets is
 * whatever the device has, so the width is worked out (in the shared text module, which
 * the print check uses too) and the text is told to fill exactly that.
 */
function textEms(text: string, body: boolean): number {
  return textWidthEm(text, body ? "Outfit" : "Archivo Black");
}

function layerMarkup(layer: DesignLayer, window: PrintWindow, fallbackInk: string): string {
  // A stored row is not always what the type promises: skip anything that is not a layer.
  if (!layer || typeof layer !== "object") return "";
  const cx = window.x + num(layer.x, 0.5, -1, 2) * window.w;
  const cy = window.y + num(layer.y, 0.5, -1, 2) * window.h;
  const scale = num(layer.scale, 1, 0.02, 12);
  const turn = `rotate(${f(num(layer.rotation, 0, -3600, 3600))} ${f(cx)} ${f(cy)})`;
  if (layer.type === "text") {
    const text = cleanText(layer.text);
    if (!text.trim()) return "";
    const body = layer.font === "Outfit";
    const size = Math.max(1.5, window.h * TEXT_EM * scale);
    const maxWidth = window.w * LINE_FIT;
    const ink = escapeXml(inkColor(layer.color, fallbackInk));
    const face = `font-family="${body ? BODY_STACK : DISPLAY_STACK}" font-weight="${body ? 400 : 900}"`;
    const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
    const paint = (fontSize: number) =>
      fx.outline
        ? `fill="none" stroke="${ink}" stroke-width="${f(Math.max(0.3, fontSize * OUTLINE_EM))}" stroke-linejoin="round"`
        : `fill="${ink}"`;
    if (isFlatText(fx)) {
      const length = Math.min(maxWidth, textEms(text, body) * size);
      return `<text x="${f(cx)}" y="${f(cy)}" fill="${ink}" ${face} font-size="${f(size)}" text-anchor="middle" dominant-baseline="central" textLength="${f(Math.max(1, length))}" lengthAdjust="spacingAndGlyphs" transform="${turn}">${escapeXml(text)}</text>`;
    }
    if (Math.abs(fx.arc) < 0.001) {
      // A straight line with spacing or an outline: the same widths and fit as the print file.
      const gaps = fx.tracking * Math.max(0, [...text].length - 1);
      const fitted = fitFontSize(size, Math.max(0.01, textEms(text, body) + gaps), maxWidth);
      return `<text x="${f(cx)}" y="${f(cy)}" ${paint(fitted)} ${face} font-size="${f(fitted)}" letter-spacing="${f(fx.tracking * fitted)}" text-anchor="middle" dominant-baseline="central" transform="${turn}">${escapeXml(text)}</text>`;
    }
    // A curved line: one letter at a time on the same arc the print file and the preview use.
    const cells = arcLayout(text, fx);
    const fitted = fitFontSize(size, lineSpanEm(cells), maxWidth);
    const lifts = cells.map((cell) => cell.lift);
    const middle = (Math.max(0, ...lifts) + Math.min(0, ...lifts)) / 2;
    const letters = cells
      .map((cell) => {
        const x = cx + cell.along * fitted;
        const y = cy + (cell.lift - middle) * fitted;
        return `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f(cell.rotate)} ${f(x)} ${f(y)})">${escapeXml(cell.char)}</text>`;
      })
      .join("");
    return `<g ${paint(fitted)} ${face} font-size="${f(fitted)}" transform="${turn}">${letters}</g>`;
  }
  if (layer.type !== "image") return "";
  const href = pictureHref(layer.src);
  if (!href) return "";
  // The file prints a picture 52% of the area wide at its own proportions. The box is
  // tall so that a portrait picture still fills that width.
  const width = window.w * 0.52 * scale;
  const height = width * 3;
  return `<image href="${href}" x="${f(cx - width / 2)}" y="${f(cy - height / 2)}" width="${f(width)}" height="${f(height)}" preserveAspectRatio="xMidYMid meet" transform="${turn}"/>`;
}

/**
 * Reshapes the drawn print area to a blank's real one. A chest or back area keeps its
 * top edge and its centre line, so the print still rides high. A sleeve area keeps its
 * centre. It never grows more than a quarter taller than the drawn one.
 */
function fitWindow(
  window: PrintWindow,
  area: { widthIn: number; heightIn: number } | undefined,
): PrintWindow {
  const wide = num(area?.widthIn, 0, 0, 1000);
  const tall = num(area?.heightIn, 0, 0, 1000);
  if (!(wide > 0 && tall > 0)) return window;
  const ratio = Math.min(8, Math.max(0.125, wide / tall));
  let w = window.w;
  let h = w / ratio;
  const most = window.h * 1.25;
  if (h > most) {
    h = most;
    w = h * ratio;
  }
  return {
    x: window.x + (window.w - w) / 2,
    y: window.rot === 0 ? window.y : window.y + (window.h - h) / 2,
    w,
    h,
    rot: window.rot,
  };
}

/* --------------------------------------------------------------- painter */

function paint(part: Part, tones: Palette): string {
  switch (part.kind) {
    case "fill":
      return `<path d="${part.d}" fill="${tones[part.tone]}"/>`;
    case "band":
      return `<path d="${part.d}" fill="none" stroke="${tones[part.tone]}" stroke-width="${part.width}" stroke-linejoin="round"${part.width < 8 ? ' stroke-linecap="round"' : ""}/>`;
    case "rib":
      return `<path d="${part.d}" fill="none" stroke="${tones.rib}" stroke-width="${part.width}"/><path d="${part.d}" fill="none" stroke="${tones.ribLine}" stroke-width="${part.width}" stroke-dasharray="1 2.4" opacity=".55"/>`;
    case "seam":
      return `<path d="${part.d}" fill="none" stroke="${tones.seam}" stroke-width="1.1" opacity=".7"/>`;
    case "stitch":
      return `<path d="${part.d}" fill="none" stroke="${tones.stitch}" stroke-width=".9" stroke-dasharray="2.7 1.8" stroke-linecap="round" opacity=".8"/>`;
    case "drop":
      return `<path d="${part.d}" fill="none" stroke="${tones.dark ? "#000" : tones.shade}" stroke-width="${part.width}" opacity="${f(tones.shadeAlpha * 0.9)}" filter="url(#f)"/>`;
  }
}

const paintAll = (parts: Part[], tones: Palette) =>
  parts.map((part) => paint(part, tones)).join("");

function compose(options: {
  shape: GarmentShape;
  view: GarmentView;
  colorHex: string;
  layers: DesignLayer[];
  square: boolean;
  printArea?: { widthIn: number; heightIn: number };
}): string {
  const hex = garmentHex(options.colorHex);
  const tones = palette(hex);
  const drawing: Drawing = drawGarment(options.shape, options.view);
  const window = fitWindow(drawing.window, options.printArea);
  const { camera } = drawing;
  const fallbackInk = tones.trim;

  const art = options.layers
    .slice(0, MAX_LAYERS)
    .map((layer) => layerMarkup(layer, window, fallbackInk))
    .join("");
  const wcx = window.x + window.w / 2;
  const wcy = window.y + window.h / 2;
  const printed = art
    ? `<g transform="rotate(${f(window.rot)} ${f(wcx)} ${f(wcy)})" opacity=".96"><g clip-path="url(#p)">${art}</g></g>`
    : "";

  const view = options.square ? "0 60 480 480" : "0 0 480 600";
  const captionY = options.square ? 526 : 584;
  // The caption moves to the right when the garment lies over the left corner.
  const right = drawing.captionRight === true;
  const markX = right ? 453 : 27;
  const place = camera
    ? ` transform="translate(${f(camera.at?.[0] ?? 240)} ${f(camera.at?.[1] ?? (options.square ? 300 : 296))}) rotate(${f(camera.rot)}) scale(${camera.zoom}) translate(${f(-camera.x)} ${f(-camera.y)})"`
    : "";
  const whole = `x="-200" y="-200" width="880" height="1000"`;
  const bands = drawing.silBands
    .map((band) => `<path d="${band.d}" fill="none" stroke-width="${band.width}"/>`)
    .join("");
  const folds = drawing.folds.join("");
  const lights = drawing.lights.join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="480" height="${options.square ? 480 : 600}">
<defs>
<radialGradient id="b" cx=".5" cy=".47" r=".72"><stop offset="0" stop-color="#3a2d52"/><stop offset=".5" stop-color="#20182c"/><stop offset="1" stop-color="#0b0614"/></radialGradient>
<pattern id="d" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r=".7" fill="#f6f1ff" opacity=".06"/></pattern>
<pattern id="m" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#b7a8d4" stroke-width=".7" opacity=".1"/></pattern>
<pattern id="r" width="9" height="48" patternUnits="userSpaceOnUse"><path d="M0 .5H9M0 12.5H4M0 24.5H6M0 36.5H4" fill="none" stroke="#b7a8d4" stroke-width=".8" opacity=".4"/></pattern>
<linearGradient id="l" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${f(tones.lightAlpha * 0.9)}"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="${tones.shade}" stop-opacity="0"/><stop offset="1" stop-color="${tones.shade}" stop-opacity="${f(tones.shadeAlpha * 0.55)}"/></linearGradient>
<filter id="f" filterUnits="userSpaceOnUse" ${whole}><feGaussianBlur stdDeviation="3.2"/></filter>
<filter id="w" filterUnits="userSpaceOnUse" ${whole}><feGaussianBlur stdDeviation="9"/></filter>
<filter id="g" filterUnits="userSpaceOnUse" ${whole}><feGaussianBlur stdDeviation="15"/></filter>
<filter id="n" filterUnits="userSpaceOnUse" x="0" y="0" width="480" height="600"><feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 ${tones.grain} 0 0 0 0 ${tones.grain} 0 0 0 0 ${tones.grain} 0 0 0 1.5 -.62"/></filter>
<clipPath id="s"><path d="${drawing.sil}"/></clipPath>
<clipPath id="p"><rect x="${f(window.x)}" y="${f(window.y)}" width="${f(window.w)}" height="${f(window.h)}"/></clipPath>
</defs>
<rect width="480" height="600" fill="url(#b)"/>
<rect width="480" height="600" fill="url(#m)"/>
<rect width="480" height="600" fill="url(#d)"/>
<rect width="9" height="600" fill="url(#r)"/>
<path d="M${markX - 7} ${captionY - 3}h14M${markX} ${captionY - 10}v14" stroke="#b7a8d4" stroke-width="1" opacity=".55"/>
<text x="${right ? 438 : 42}" y="${captionY + 1}" fill="#b7a8d4" font-family="${DISPLAY_STACK}" font-weight="900" font-size="9.5" letter-spacing="2.2" opacity=".85"${right ? ' text-anchor="end"' : ""}>PREVIEW / ${drawing.label}</text>
<g${place}>
<g fill="#05020a" stroke="#05020a" stroke-linejoin="round"><g filter="url(#g)" opacity=".7" transform="translate(7 16)"><path d="${drawing.sil}" stroke="none"/>${bands}</g><g filter="url(#f)" opacity=".75" transform="translate(1.5 4)"><path d="${drawing.sil}" stroke="none"/>${bands}</g></g>
${paintAll(drawing.behind, tones)}
<path d="${drawing.sil}" fill="${hex}"/>
<g clip-path="url(#s)">
${paintAll(drawing.under, tones)}
${printed}
<path d="${drawing.sil}" fill="none" stroke="${tones.shade}" stroke-width="30" opacity="${f(tones.shadeAlpha * 0.62)}" filter="url(#w)"/>
<path d="${folds}" fill="none" stroke="${tones.shade}" stroke-width="9" stroke-linecap="round" opacity="${f(tones.shadeAlpha * 0.58)}" filter="url(#f)"/>
<path d="${lights}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="${f(tones.lightAlpha * 0.5)}" filter="url(#f)"/>
<rect width="480" height="600" fill="url(#l)"/>
<rect width="480" height="600" filter="url(#n)" opacity="${tones.grainAlpha}"/>
</g>
${paintAll(drawing.over, tones)}
<path d="${drawing.sil}" fill="none" stroke="${tones.edge}" stroke-width="1" stroke-linejoin="round" opacity="${tones.dark ? ".8" : ".6"}"/>
</g>
</svg>`;
}

/** Lighter than encodeURIComponent, and still decodes with decodeURIComponent. */
function toDataUrl(svg: string): string {
  const packed = encodeURIComponent(svg.replace(/\n/g, ""))
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%2C/g, ",")
    .replace(/%3B/g, ";")
    .replace(/ /g, "%20");
  return `data:image/svg+xml;charset=utf-8,${packed}`;
}

/**
 * The SVG text of a mockup, for anything that wants the markup and not a link.
 * Its gradients, filters and clips have one-letter ids that every mockup shares, so two
 * of these set straight into one page would borrow each other's. Show it in an <img>
 * (garmentMockupSvg) unless there is exactly one on the page.
 */
export function garmentMockupMarkup(input: GarmentMockupInput): string {
  const shape = resolveShape(input?.shape);
  return compose({
    shape,
    view: resolveView(shape, input?.placement),
    colorHex: input?.colorHex,
    layers: Array.isArray(input?.layers) ? input.layers : [],
    square: false,
    printArea: input?.printArea,
  });
}

/**
 * A garment with the art on it, as a data:image/svg+xml link for an <img>.
 * Takes what buildMockupSvg takes and returns what it returns.
 */
export function garmentMockupSvg(input: GarmentMockupInput): string {
  return toDataUrl(garmentMockupMarkup(input));
}

/** A bare garment, square, for catalog cards. */
export function garmentFlatSvg(shape: string, colorHex: string): string {
  const resolved = resolveShape(shape);
  return toDataUrl(compose({ shape: resolved, view: "front", colorHex, layers: [], square: true }));
}
