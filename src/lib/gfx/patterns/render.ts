import {
  DEFAULT_TILE_PX,
  clamp,
  defaultSpec,
  encodeSpec,
  normalizeSpec,
  type PatternSpec,
} from "./core.ts";
import { PAINTERS, type Ctx2D } from "./draw.ts";

/** Canvas glue for the painters: one tile, a filled area, and data URLs. */

export type DrawOptions = {
  /**
   * Pixel size of one tile at scale 1. The default is 256. To print what a preview
   * showed, multiply the preview's unit by print pixels over preview pixels.
   */
  unit?: number;
  /**
   * For live previews while a slider is moving. The tile is drawn once at a round
   * size and stretched to fit, so a change of scale costs almost nothing. A little
   * soft. Leave it off for anything that gets printed or saved.
   */
  draft?: boolean;
};

const MIN_TILE = 8;
const MAX_TILE = 4096;
/** Tiles above this edge are drawn fresh each time instead of being kept. */
const CACHE_EDGE = 1024;
const CACHE_SIZE = 32;

type Surface = HTMLCanvasElement | OffscreenCanvas;

const tiles = new Map<string, Surface>();

function surface(width: number, height: number): { canvas: Surface; ctx: Ctx2D } {
  const canvas: Surface =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as Ctx2D | null;
  if (!ctx) throw new Error("This browser cannot draw patterns.");
  return { canvas, ctx };
}

/** The tile edge, in pixels, that a spec draws with for a given unit. */
export function tileSize(spec: PatternSpec, unit: number = DEFAULT_TILE_PX): number {
  const scale = normalizeSpec(spec)?.scale ?? 1;
  return clamp(Math.round(unit * scale), MIN_TILE, MAX_TILE);
}

/** One seamless tile at 0,0. Opposite edges match, so it can be repeated in both directions. */
export function drawPatternTile(ctx: Ctx2D, spec: PatternSpec, tilePx: number): void {
  const clean = normalizeSpec(spec) ?? defaultSpec();
  const t = clamp(Math.round(tilePx), MIN_TILE, MAX_TILE);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, t, t);
  ctx.clip();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  PAINTERS[clean.id](ctx, t, clean.colors, clean.seed);
  ctx.restore();
}

function tileFor(spec: PatternSpec, t: number): Surface {
  const key = `${encodeSpec({ ...spec, scale: 1, rotation: 0 })}@${t}`;
  const kept = tiles.get(key);
  if (kept) {
    tiles.delete(key);
    tiles.set(key, kept);
    return kept;
  }
  const { canvas, ctx } = surface(t, t);
  drawPatternTile(ctx, spec, t);
  if (t <= CACHE_EDGE) {
    tiles.set(key, canvas);
    if (tiles.size > CACHE_SIZE) {
      const oldest = tiles.keys().next().value;
      if (oldest !== undefined) tiles.delete(oldest);
    }
  }
  return canvas;
}

/**
 * Fill 0,0 to widthPx,heightPx with the pattern, repeated, at the spec's scale
 * and rotation. The repeat turns about the middle of the area.
 */
export function drawPattern(
  ctx: Ctx2D,
  spec: PatternSpec,
  widthPx: number,
  heightPx: number,
  options: DrawOptions = {},
): void {
  // a size that is not a number draws nothing instead of poisoning the canvas
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) return;
  const clean = normalizeSpec(spec) ?? defaultSpec();
  const width = Math.max(1, widthPx);
  const height = Math.max(1, heightPx);
  const t = tileSize(clean, options.unit ?? DEFAULT_TILE_PX);
  const drawn = options.draft ? draftEdge(t) : t;
  const zoom = t / drawn;
  const fill = ctx.createPattern(tileFor(clean, drawn), "repeat");
  if (!fill) return;
  const reach = (Math.hypot(width, height) / 2 + 2) / zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(((clean.rotation ?? 0) * Math.PI) / 180);
  ctx.scale(zoom, zoom);
  ctx.fillStyle = fill;
  ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
  ctx.restore();
}

/** The round tile size a draft is drawn at: the next power of two, from 64 to 512. */
export function draftEdge(tilePx: number): number {
  return clamp(2 ** Math.ceil(Math.log2(Math.max(1, tilePx))), 64, 512);
}

function page(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document === "undefined")
    throw new Error("Pattern pictures can only be made in a browser.");
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw patterns.");
  return { canvas, ctx };
}

/** The filled area as a data URL. Browser only. */
export function patternDataUrl(
  spec: PatternSpec,
  widthPx: number,
  heightPx: number,
  mime: string = "image/png",
  options: DrawOptions & { quality?: number } = {},
): string {
  const { canvas, ctx } = page(widthPx, heightPx);
  drawPattern(ctx, spec, canvas.width, canvas.height, options);
  return canvas.toDataURL(mime, options.quality);
}

/** One tile as a data URL, ready to repeat. Browser only. */
export function patternTileDataUrl(
  spec: PatternSpec,
  tilePx: number,
  mime: string = "image/png",
): string {
  const { canvas, ctx } = page(tilePx, tilePx);
  drawPatternTile(ctx, spec, canvas.width);
  return canvas.toDataURL(mime);
}

export type FittedPicture = { dataUrl: string; width: number; height: number; mime: string };

/**
 * The filled area as the sharpest data URL that stays under maxChars: WebP first,
 * easing off quality and then size, and PNG where the browser has no WebP.
 */
export function patternDataUrlUnder(
  spec: PatternSpec,
  widthPx: number,
  heightPx: number,
  maxChars: number,
  options: DrawOptions = {},
): FittedPicture {
  let shrink = 1;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const width = Math.max(64, Math.round(widthPx * shrink));
    const height = Math.max(64, Math.round(heightPx * shrink));
    const unit = (options.unit ?? DEFAULT_TILE_PX) * shrink;
    const { canvas, ctx } = page(width, height);
    drawPattern(ctx, spec, width, height, { unit });
    for (const quality of [0.95, 0.88, 0.78]) {
      const webp = canvas.toDataURL("image/webp", quality);
      if (webp.startsWith("data:image/webp") && webp.length <= maxChars) {
        return { dataUrl: webp, width, height, mime: "image/webp" };
      }
      if (!webp.startsWith("data:image/webp")) break;
    }
    const png = canvas.toDataURL("image/png");
    if (png.length <= maxChars) return { dataUrl: png, width, height, mime: "image/png" };
    shrink *= 0.82;
  }
  throw new Error("That pattern is too heavy to send. Make it bigger on the tile and try again.");
}
