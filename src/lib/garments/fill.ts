import {
  HEX,
  MAX_ART_SRC,
  type AopPanel,
  type Colorway,
  type Paint,
  type PanelFill,
} from "./types.ts";

export function safeArt(src: string): boolean {
  if (/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(src)) return true;
  return /^https:\/\/[^\s"]+$/.test(src);
}

export function resolvePaint(
  panelDef: AopPanel,
  fill: PanelFill | undefined,
  colorway: Colorway,
): Paint {
  const roleHex = colorway.colors[panelDef.role];
  if (!fill || fill.kind === "role") return { type: "solid", hex: roleHex };
  if (fill.kind === "color" && HEX.test(fill.hex)) return { type: "solid", hex: fill.hex };
  if (fill.kind === "pattern" && HEX.test(fill.hex) && HEX.test(fill.accent)) {
    return { type: "pattern", pattern: fill.pattern, hex: fill.hex, accent: fill.accent };
  }
  if (fill.kind === "art" && safeArt(fill.src)) return { type: "art", src: fill.src };
  return { type: "solid", hex: roleHex };
}

export function parseFill(input: unknown): PanelFill {
  const raw = (input ?? {}) as Record<string, unknown>;
  if (raw.kind === "color" && HEX.test(String(raw.hex ?? "")))
    return { kind: "color", hex: String(raw.hex) };
  if (
    (raw.kind === "pattern" && raw.pattern === "stripe") ||
    (raw.kind === "pattern" && raw.pattern === "checker")
  ) {
    const hex = String(raw.hex ?? "");
    const accent = String(raw.accent ?? "");
    if (HEX.test(hex) && HEX.test(accent))
      return { kind: "pattern", pattern: raw.pattern, hex, accent };
  }
  if (raw.kind === "art") {
    const src = String(raw.src ?? "");
    if (src.length > MAX_ART_SRC)
      throw new Error("That panel picture is too large. Use a smaller one.");
    if (safeArt(src)) return { kind: "art", src };
  }
  return { kind: "role" };
}
