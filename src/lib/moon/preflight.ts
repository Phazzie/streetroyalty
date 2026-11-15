/**
 * Print Check — the preflight panel's brain. Pure functions over layer and
 * print-area facts: effective DPI for placed artwork, bounds, and ink vs
 * garment contrast. The editor feeds it real numbers; publish asks it for
 * a verdict and honors the override rule.
 */
import { contrastRatio } from "../contrast.ts";
import type { DesignLayer, PrintArea } from "../pod/types.ts";

export type CheckLevel = "pass" | "warn" | "fail";

export type PrintCheck = {
  key: string;
  label: string;
  level: CheckLevel;
  detail: string;
};

export type ImageFacts = {
  layerId: string;
  /** Natural pixel size of the artwork, when the editor could read it. */
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

/**
 * Width a layer occupies, as a fraction of the print area. Text follows the
 * print renderer: glyphs average 0.62em at a font size of 0.14 × area height
 * × scale, converted through the area's aspect ratio.
 */
export function layerWidthFraction(layer: DesignLayer, area?: PrintArea): number {
  if (layer.type === "image") return 0.52 * layer.scale;
  const aspect = area ? area.heightIn / Math.max(1, area.widthIn) : 1;
  return Math.min(0.98, layer.scale * layer.text.length * 0.62 * 0.14 * aspect);
}

export function effectiveDpi(facts: ImageFacts, layer: DesignLayer, area: PrintArea): number {
  const placedIn = Math.max(0.5, layerWidthFraction(layer) * area.widthIn);
  return Math.round(facts.widthPx / placedIn);
}

export function runPrintChecks(input: PreflightInput): PrintCheck[] {
  const checks: PrintCheck[] = [];
  const { area, garmentHex } = input;
  const dpi = area.dpi && area.dpi > 0 ? area.dpi : 150;

  // Bounds: layer centers are clamped by the editor, but scale can spill art
  // past the dashed box. Anything past the edge gets clipped at print.
  const spilling = input.layers.filter((layer) => {
    const half = layerWidthFraction(layer, area) / 2;
    return layer.x - half < 0 || layer.x + half > 1 || layer.y - half < 0 || layer.y + half > 1;
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

  // Sharpness: placed size vs the artwork's real pixels.
  const factsById = new Map((input.images ?? []).map((facts) => [facts.layerId, facts]));
  let worst: { dpiNow: number; layer: DesignLayer } | null = null;
  for (const layer of input.layers) {
    if (layer.type !== "image") continue;
    const facts = factsById.get(layer.id);
    if (!facts || facts.widthPx <= 0) continue;
    const now = effectiveDpi(facts, layer, area);
    if (!worst || now < worst.dpiNow) worst = { dpiNow: now, layer };
  }
  if (worst) {
    const level: CheckLevel = worst.dpiNow >= dpi ? "pass" : worst.dpiNow >= dpi * 0.6 ? "warn" : "fail";
    checks.push({
      key: "dpi",
      label: "Sharp enough to print",
      level,
      detail:
        level === "pass"
          ? `Artwork lands at about ${worst.dpiNow} DPI. The area wants ${dpi}.`
          : `Artwork lands at about ${worst.dpiNow} DPI. The area wants ${dpi} — it will print soft.`,
    });
  } else if (input.layers.some((layer) => layer.type === "image")) {
    checks.push({
      key: "dpi",
      label: "Sharp enough to print",
      level: "warn",
      detail: "Could not read the artwork's pixel size. Eyeball the mockup before you publish.",
    });
  }

  // Contrast: the weakest text ink against the garment.
  let weakest: { ratio: number; layer: DesignLayer & { type: "text" } } | null = null;
  for (const layer of input.layers) {
    if (layer.type !== "text") continue;
    const ratio = contrastRatio(layer.color, garmentHex);
    if (!weakest || ratio < weakest.ratio) weakest = { ratio, layer };
  }
  if (weakest) {
    const ratio = Math.round(weakest.ratio * 10) / 10;
    const level: CheckLevel = ratio >= WARN_CONTRAST ? "pass" : ratio >= FAIL_CONTRAST ? "warn" : "fail";
    checks.push({
      key: "contrast",
      label: "Ink reads on the garment",
      level,
      detail:
        level === "pass"
          ? `"${weakest.layer.text}" sits at ${ratio}:1 against the garment. It reads.`
          : `"${weakest.layer.text}" sits at ${ratio}:1 against the garment. From across the street, it disappears.`,
    });
  }

  if (input.layers.length === 0) {
    checks.push({ key: "empty", label: "Something to print", level: "fail", detail: "No layers. A blank blank is just laundry." });
  }
  return checks;
}

export function preflightVerdict(checks: PrintCheck[]): CheckLevel {
  if (checks.some((check) => check.level === "fail")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

/**
 * Publish rule: a pass or a warn can publish. A fail needs the designer to
 * say out loud they know — the override is a deliberate click, not a default.
 */
export function canPublish(verdict: CheckLevel, override: boolean): boolean {
  return verdict !== "fail" || override;
}
