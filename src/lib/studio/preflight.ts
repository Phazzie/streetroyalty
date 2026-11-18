/**
 * Print check. Pure functions over layers and the print area: effective DPI
 * for placed artwork, whether a layer spills the dashed box, and ink against
 * the garment. Ported from moon/next-level. A fail can still publish if the
 * designer says so out loud.
 */
import { contrastRatio } from "../contrast.ts";
import type { DesignLayer, PrintArea } from "../pod/types.ts";
import {
  arcLayout,
  clampFx,
  fitFontSize,
  isFlatText,
  LINE_FIT,
  lineRiseEm,
  lineSpanEm,
  TEXT_EM,
  textWidthEm,
} from "./textfx.ts";

export type CheckLevel = "pass" | "warn" | "fail";

export type PrintCheck = {
  key: string;
  label: string;
  level: CheckLevel;
  detail: string;
};

export type ImageFacts = {
  layerId: string;
  widthPx: number;
  heightPx: number;
};

export type PreflightInput = {
  layers: DesignLayer[];
  area: PrintArea;
  garmentHex: string;
  images?: ImageFacts[];
};

const FAIL_CONTRAST = 2;
const WARN_CONTRAST = 3.2;

/** Width a layer occupies, as a fraction of the print area. */
export function layerWidthFraction(layer: DesignLayer, area?: PrintArea): number {
  if (layer.type === "image") return 0.52 * layer.scale;
  const aspect = area ? area.heightIn / Math.max(1, area.widthIn) : 1;
  return Math.min(0.98, layer.scale * layer.text.length * 0.62 * 0.14 * aspect);
}

/** Picture width as a share of the print area's width, at scale 1. The print file uses the same share. */
const IMAGE_SHARE = 0.52;
/** How tall a line's ink stands, in ems: capitals and the odd descender, not the whole em box. */
const INK_EM = 0.8;
/** A sliver past the edge is the rounding of a drag, not a clip. */
const EDGE_GRACE = 0.005;

/**
 * How far a layer reaches from its centre, as shares of the print area's width (x) and
 * height (y). It follows the print file: text set at its size and shrunk to fit the
 * width, curves with the room their ends take, pictures at their own proportions, all
 * turned by the layer's rotation.
 */
export function layerReach(
  layer: DesignLayer,
  area: PrintArea,
  image?: ImageFacts,
): { x: number; y: number } {
  const width = Math.max(0.01, area.widthIn);
  const height = Math.max(0.01, area.heightIn);
  let w: number;
  let h: number;
  if (layer.type === "image") {
    w = width * IMAGE_SHARE * layer.scale;
    h = image && image.widthPx > 0 && image.heightPx > 0 ? (w * image.heightPx) / image.widthPx : w;
  } else {
    const size = height * TEXT_EM * layer.scale;
    const room = width * LINE_FIT;
    const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
    if (isFlatText(fx)) {
      // A plain line keeps its height and is squeezed sideways to fit.
      w = Math.min(room, textWidthEm(layer.text, layer.font) * size);
      h = size * INK_EM;
    } else if (Math.abs(fx.arc) < 0.001) {
      const span =
        textWidthEm(layer.text, layer.font) + fx.tracking * Math.max(0, [...layer.text].length - 1);
      const fitted = fitFontSize(size, Math.max(0.01, span), room);
      w = span * fitted;
      h = fitted * INK_EM;
    } else {
      const cells = arcLayout(layer.text, fx);
      const fitted = fitFontSize(size, lineSpanEm(cells), room);
      w = lineSpanEm(cells) * fitted;
      h = (lineRiseEm(cells) - 1.2 + INK_EM) * fitted;
    }
  }
  const turn = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(turn));
  const sin = Math.abs(Math.sin(turn));
  return { x: (w * cos + h * sin) / 2 / width, y: (w * sin + h * cos) / 2 / height };
}

export function effectiveDpi(facts: ImageFacts, layer: DesignLayer, area: PrintArea): number {
  const placedIn = Math.max(0.5, layerWidthFraction(layer) * area.widthIn);
  return Math.round(facts.widthPx / placedIn);
}

export function runPrintChecks(input: PreflightInput): PrintCheck[] {
  const checks: PrintCheck[] = [];
  const { area, garmentHex } = input;
  const dpi = area.dpi && area.dpi > 0 ? area.dpi : 150;

  const facts = new Map((input.images ?? []).map((item) => [item.layerId, item]));
  const spilling = input.layers.filter((layer) => {
    const reach = layerReach(layer, area, facts.get(layer.id));
    return (
      layer.x - reach.x < -EDGE_GRACE ||
      layer.x + reach.x > 1 + EDGE_GRACE ||
      layer.y - reach.y < -EDGE_GRACE ||
      layer.y + reach.y > 1 + EDGE_GRACE
    );
  });
  checks.push({
    key: "bounds",
    label: "Inside the print area",
    level: spilling.length > 0 ? "warn" : "pass",
    detail:
      spilling.length > 0
        ? `${spilling.length} layer${spilling.length === 1 ? "" : "s"} spill${spilling.length === 1 ? "s" : ""} past the dashed box and will clip.`
        : "Every layer sits inside the dashed box.",
  });

  const factsById = facts;
  let worst: { dpiNow: number } | null = null;
  for (const layer of input.layers) {
    if (layer.type !== "image") continue;
    const facts = factsById.get(layer.id);
    if (!facts || facts.widthPx <= 0) continue;
    const now = effectiveDpi(facts, layer, area);
    if (!worst || now < worst.dpiNow) worst = { dpiNow: now };
  }
  if (worst) {
    const level: CheckLevel =
      worst.dpiNow >= dpi ? "pass" : worst.dpiNow >= dpi * 0.6 ? "warn" : "fail";
    checks.push({
      key: "dpi",
      label: "Sharp enough to print",
      level,
      detail:
        level === "pass"
          ? `Artwork lands at about ${worst.dpiNow} DPI. The area wants ${dpi}.`
          : `Artwork lands at about ${worst.dpiNow} DPI. The area wants ${dpi}. It will print soft.`,
    });
  } else if (input.layers.some((layer) => layer.type === "image")) {
    checks.push({
      key: "dpi",
      label: "Sharp enough to print",
      level: "warn",
      detail: "Could not read the artwork's pixel size. Check the mockup before you publish.",
    });
  }

  let weakest: { ratio: number; text: string } | null = null;
  for (const layer of input.layers) {
    if (layer.type !== "text") continue;
    const ratio = contrastRatio(layer.color, garmentHex);
    if (!weakest || ratio < weakest.ratio) weakest = { ratio, text: layer.text };
  }
  if (weakest) {
    const ratio = Math.round(weakest.ratio * 10) / 10;
    const level: CheckLevel =
      ratio >= WARN_CONTRAST ? "pass" : ratio >= FAIL_CONTRAST ? "warn" : "fail";
    checks.push({
      key: "contrast",
      label: "Ink reads on the garment",
      level,
      detail:
        level === "pass"
          ? `"${weakest.text}" sits at ${ratio}:1 against the garment. It reads.`
          : `"${weakest.text}" sits at ${ratio}:1 against the garment. From across the street, it disappears.`,
    });
  }

  if (input.layers.length === 0) {
    checks.push({
      key: "empty",
      label: "Something to print",
      level: "fail",
      detail: "No layers yet.",
    });
  }
  return checks;
}

export function preflightVerdict(checks: PrintCheck[]): CheckLevel {
  if (checks.some((check) => check.level === "fail")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

/** A pass or a warn can publish. A fail needs the designer to say they know. */
export function canPublish(verdict: CheckLevel, override: boolean): boolean {
  return verdict !== "fail" || override;
}
