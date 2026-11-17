/**
 * The pattern engine: seamless, seeded patterns drawn in code at any pixel size.
 * No image files, no network, no key. Import everything from "@/lib/gfx/patterns".
 *
 *   type PatternId   = "chain-link" | "barbed-wire" | "bandana" | "flames" | "checker"
 *                    | "warp-checker" | "tiger" | "crowns" | "drip" | "camo" | "halftone" | "razor"
 *   type PatternSpec = { id: PatternId; seed: number; colors: string[]; scale: number; rotation?: number }
 *       seed      any whole number from 0 to 4294967295; the same seed always draws the same thing
 *       colors    #rrggbb, slot 0 is the ground; missing or bad slots fall back to the pattern's defaults
 *       scale     1 is the default tile size, 0.25 to 4
 *       rotation  degrees, 0 to 359
 *
 *   PATTERNS: { id, name, colorSlots, defaultColors }[]   what there is to pick from
 *   defaultSpec(id?, seed?)                               a spec with the pattern's own colours
 *
 *   drawPatternTile(ctx, spec, tilePx)                    one seamless tile at 0,0
 *   drawPattern(ctx, spec, widthPx, heightPx, options?)   fills 0,0..width,height by repeating the tile,
 *                                                         honouring scale and rotation. To fill a garment
 *                                                         panel: ctx.save(), clip to the panel, translate
 *                                                         to its corner, drawPattern, ctx.restore().
 *       unit is the pixel size of one tile at scale 1 (default 256). A preview and a print
 *       file match when unit grows with the canvas: unit = 256 * printWidth / previewWidth.
 *       draft: true is for live previews while something is being dragged: fast, a little soft.
 *       Never use it for a print file.
 *   patternDataUrl(spec, widthPx, heightPx, mime?)        browser only
 *   patternTileDataUrl(spec, tilePx, mime?)               browser only
 *   patternDataUrlUnder(spec, w, h, maxChars)             browser only, shrinks until it fits
 *
 *   encodeSpec(spec): string                              URL-safe text, e.g. flames.9ix.0b0614-ff2d1f-ff8a00-ffe14a.100.0
 *   decodeSpec(text): PatternSpec | null                  null for anything that is not a spec
 *
 * ctx is a CanvasRenderingContext2D or an OffscreenCanvasRenderingContext2D. The same
 * spec and size always draw the same pixels; nothing here calls Math.random.
 */
export * from "./core.ts";
export { type Ctx2D } from "./draw.ts";
export * from "./render.ts";
