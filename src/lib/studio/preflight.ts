/**
 * Print check. Pure functions over layers and the print area: effective DPI
 * for placed artwork, whether a layer spills the dashed box, and ink against
 * the garment. Ported from moon/next-level. A fail can still publish if the
 * designer says so out loud.
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

export function effectiveDpi(facts: ImageFacts, layer: DesignLayer, area: PrintArea): number {
  const placedIn = Math.max(0.5, layerWidthFraction(layer) * area.widthIn);
  return Math.round(facts.widthPx / placedIn);
}

export function runPrintChecks(input: PreflightInput): PrintCheck[] {
  const checks: PrintCheck[] = [];
  const { area, garmentHex } = input;
  const dpi = area.dpi && area.dpi > 0 ? area.dpi : 150;

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

  const factsById = new Map((input.images ?? []).map((facts) => [facts.layerId, facts]));
  let worst: { dpiNow: number } | null = null;
  for (const layer of input.layers) {
    if (layer.type !== "image") continue;
    const facts = factsById.get(layer.id);
    if (!facts || facts.widthPx <= 0) continue;
    const now = effectiveDpi(facts, layer, area);
    if (!worst || now < worst.dpiNow) worst = { dpiNow: now };
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
    const level: CheckLevel = ratio >= WARN_CONTRAST ? "pass" : ratio >= FAIL_CONTRAST ? "warn" : "fail";
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
