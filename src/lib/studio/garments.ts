/**
 * All-over garments: panel templates, colorways, matched sets, and the flat
 * preview. Printful's real template pixel sizes are not in here. Those stay
 * null in `aop-printful.ts` until the catalog API is read.
 */
import {
  AOP_DPI,
  AOP_MATERIAL,
  PRINTFUL_AOP,
  panelPrintTarget,
  type PanelPrintTarget,
} from "../pod/aop-printful.ts";

export { AOP_MATERIAL, AOP_DPI };

export const COLOR_ROLES = ["body", "contrast", "trim", "mark"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export type Colorway = {
  id: string;
  name: string;
  colors: Record<ColorRole, string>;
};

export type PanelFill =
  | { kind: "role" }
  | { kind: "color"; hex: string }
  | { kind: "pattern"; pattern: "stripe" | "checker"; hex: string; accent: string }
  | { kind: "art"; src: string };

export type PanelFace = "front" | "back" | "both";

export type AopPanel = {
  id: string;
  title: string;
  role: ColorRole;
  face: PanelFace;
  d: string;
  /** Studio drawing box in viewBox units. Not a Printful print size. */
  box: { x: number; y: number; w: number; h: number };
};

export type AopTemplate = {
  id: string;
  name: string;
  printful: (typeof PRINTFUL_AOP)[keyof typeof PRINTFUL_AOP];
  viewBox: string;
  viewWidth: number;
  viewHeight: number;
  panels: AopPanel[];
};

export type PanelDesign = {
  id: string;
  fill: PanelFill;
};

export type GarmentDesign = {
  templateId: string;
  panels: PanelDesign[];
  colorways: Colorway[];
  activeColorwayId: string;
};

export type Paint =
  | { type: "solid"; hex: string }
  | { type: "pattern"; pattern: "stripe" | "checker"; hex: string; accent: string }
  | { type: "art"; src: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

export const HOUSE_COLORWAYS: Colorway[] = [
  {
    id: "lilac-cream",
    name: "Lilac / cream",
    colors: { body: "#c4a6e0", contrast: "#f3e6d0", trim: "#ff6a00", mark: "#1a1024" },
  },
  {
    id: "lilac-white",
    name: "Lilac / white",
    colors: { body: "#c4a6e0", contrast: "#f4f0e6", trim: "#f4f0e6", mark: "#1a1024" },
  },
  {
    id: "black-gold",
    name: "Black / gold",
    colors: { body: "#141414", contrast: "#c6a15b", trim: "#c6a15b", mark: "#f6f1ff" },
  },
];

/** Which blank a piece pairs with when a designer builds a set. */
export const SET_PARTNER: Record<string, string> = {
  "aop-hoodie": "aop-joggers",
  "aop-joggers": "aop-hoodie",
  "aop-track-jacket": "aop-joggers",
};

function panel(
  id: string,
  title: string,
  role: ColorRole,
  face: PanelFace,
  d: string,
  box: AopPanel["box"],
): AopPanel {
  return { id, title, role, face, d, box };
}

const HOODIE_PANELS: AopPanel[] = [
  panel("hood", "Hood", "body", "both", "M155 42 C155 14 245 14 245 42 L262 102 L200 120 L138 102 Z", {
    x: 138,
    y: 14,
    w: 124,
    h: 106,
  }),
  panel("sleeve_left", "Left sleeve", "body", "both", "M150 118 L36 196 L58 228 L164 160 Z", {
    x: 36,
    y: 118,
    w: 128,
    h: 110,
  }),
  panel("sleeve_right", "Right sleeve", "body", "both", "M250 118 L364 196 L342 228 L236 160 Z", {
    x: 236,
    y: 118,
    w: 128,
    h: 110,
  }),
  panel("cuff_left", "Left cuff", "trim", "both", "M36 196 L22 222 L54 252 L58 228 Z", {
    x: 22,
    y: 196,
    w: 36,
    h: 56,
  }),
  panel("cuff_right", "Right cuff", "trim", "both", "M364 196 L378 222 L346 252 L342 228 Z", {
    x: 342,
    y: 196,
    w: 36,
    h: 56,
  }),
  panel("side_left", "Left side panel", "contrast", "both", "M118 128 H146 V392 H118 Z", {
    x: 118,
    y: 128,
    w: 28,
    h: 264,
  }),
  panel("piping_left", "Left piping", "trim", "both", "M146 128 H156 V392 H146 Z", {
    x: 146,
    y: 128,
    w: 10,
    h: 264,
  }),
  panel("body_front", "Body front", "body", "front", "M156 124 H244 V392 H156 Z", {
    x: 156,
    y: 124,
    w: 88,
    h: 268,
  }),
  panel("body_back", "Body back", "body", "back", "M156 124 H244 V392 H156 Z", {
    x: 156,
    y: 124,
    w: 88,
    h: 268,
  }),
  panel("piping_right", "Right piping", "trim", "both", "M244 128 H254 V392 H244 Z", {
    x: 244,
    y: 128,
    w: 10,
    h: 264,
  }),
  panel("side_right", "Right side panel", "contrast", "both", "M254 128 H282 V392 H254 Z", {
    x: 254,
    y: 128,
    w: 28,
    h: 264,
  }),
  panel("pocket", "Pocket", "contrast", "front", "M174 236 H226 V312 H174 Z", {
    x: 174,
    y: 236,
    w: 52,
    h: 76,
  }),
  panel("waistband", "Waistband", "trim", "both", "M118 392 H282 V426 H118 Z", {
    x: 118,
    y: 392,
    w: 164,
    h: 34,
  }),
  panel("mark", "Chest logo", "mark", "front", "M184 156 H216 V182 H184 Z", {
    x: 184,
    y: 156,
    w: 32,
    h: 26,
  }),
];

const JOGGER_PANELS: AopPanel[] = [
  panel("waistband", "Waistband", "trim", "both", "M116 36 H284 V78 H116 Z", {
    x: 116,
    y: 36,
    w: 168,
    h: 42,
  }),
  panel("stripe_left", "Left side stripe", "contrast", "both", "M104 78 L128 78 L142 448 L116 448 Z", {
    x: 104,
    y: 78,
    w: 38,
    h: 370,
  }),
  panel("leg_left", "Left leg", "body", "front", "M128 78 L196 78 L188 448 L142 448 Z", {
    x: 128,
    y: 78,
    w: 68,
    h: 370,
  }),
  panel("leg_right", "Right leg", "body", "front", "M204 78 L272 78 L258 448 L212 448 Z", {
    x: 204,
    y: 78,
    w: 68,
    h: 370,
  }),
  panel("stripe_right", "Right side stripe", "contrast", "both", "M272 78 L296 78 L284 448 L258 448 Z", {
    x: 258,
    y: 78,
    w: 38,
    h: 370,
  }),
  panel("body_back", "Seat and back", "body", "back", "M128 78 H272 V448 H142 Z", {
    x: 128,
    y: 78,
    w: 144,
    h: 370,
  }),
  panel("pocket", "Pocket", "contrast", "front", "M140 100 H178 V152 H140 Z", {
    x: 140,
    y: 100,
    w: 38,
    h: 52,
  }),
  panel("cuff_left", "Left cuff", "trim", "both", "M116 448 H188 V492 H116 Z", {
    x: 116,
    y: 448,
    w: 72,
    h: 44,
  }),
  panel("cuff_right", "Right cuff", "trim", "both", "M212 448 H284 V492 H212 Z", {
    x: 212,
    y: 448,
    w: 72,
    h: 44,
  }),
];

const JACKET_PANELS: AopPanel[] = [
  panel("collar", "Collar", "trim", "both", "M150 40 H250 L236 92 H164 Z", {
    x: 150,
    y: 40,
    w: 100,
    h: 52,
  }),
  panel("sleeve_left", "Left sleeve", "body", "both", "M150 108 L36 188 L58 220 L164 150 Z", {
    x: 36,
    y: 108,
    w: 128,
    h: 112,
  }),
  panel("sleeve_right", "Right sleeve", "body", "both", "M250 108 L364 188 L342 220 L236 150 Z", {
    x: 236,
    y: 108,
    w: 128,
    h: 112,
  }),
  panel("cuff_left", "Left cuff", "trim", "both", "M36 188 L22 214 L54 244 L58 220 Z", {
    x: 22,
    y: 188,
    w: 36,
    h: 56,
  }),
  panel("cuff_right", "Right cuff", "trim", "both", "M364 188 L378 214 L346 244 L342 220 Z", {
    x: 342,
    y: 188,
    w: 36,
    h: 56,
  }),
  panel("side_left", "Left side panel", "contrast", "both", "M118 112 H146 V392 H118 Z", {
    x: 118,
    y: 112,
    w: 28,
    h: 280,
  }),
  panel("piping_left", "Left piping", "trim", "both", "M146 112 H156 V392 H146 Z", {
    x: 146,
    y: 112,
    w: 10,
    h: 280,
  }),
  panel("body_front", "Body front", "body", "front", "M156 100 H244 V392 H156 Z", {
    x: 156,
    y: 100,
    w: 88,
    h: 292,
  }),
  panel("body_back", "Body back", "body", "back", "M156 100 H244 V392 H156 Z", {
    x: 156,
    y: 100,
    w: 88,
    h: 292,
  }),
  panel("piping_right", "Right piping", "trim", "both", "M244 112 H254 V392 H244 Z", {
    x: 244,
    y: 112,
    w: 10,
    h: 280,
  }),
  panel("side_right", "Right side panel", "contrast", "both", "M254 112 H282 V392 H254 Z", {
    x: 254,
    y: 112,
    w: 28,
    h: 280,
  }),
  panel("pocket", "Pocket", "contrast", "front", "M168 240 H214 V300 H168 Z", {
    x: 168,
    y: 240,
    w: 46,
    h: 60,
  }),
  panel("hem", "Hem", "trim", "both", "M118 392 H282 V426 H118 Z", {
    x: 118,
    y: 392,
    w: 164,
    h: 34,
  }),
  panel("mark", "Chest logo", "mark", "front", "M184 140 H216 V166 H184 Z", {
    x: 184,
    y: 140,
    w: 32,
    h: 26,
  }),
];

export const AOP_TEMPLATES: Record<string, AopTemplate> = {
  "aop-hoodie": {
    id: "aop-hoodie",
    name: "AOP Hoodie",
    printful: PRINTFUL_AOP.hoodie,
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: HOODIE_PANELS,
  },
  "aop-joggers": {
    id: "aop-joggers",
    name: "AOP Joggers",
    printful: PRINTFUL_AOP.joggers,
    viewBox: "0 0 400 520",
    viewWidth: 400,
    viewHeight: 520,
    panels: JOGGER_PANELS,
  },
  "aop-track-jacket": {
    id: "aop-track-jacket",
    name: "AOP Track Jacket",
    printful: PRINTFUL_AOP.jacket,
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: JACKET_PANELS,
  },
};

export function getTemplate(templateId: string): AopTemplate | null {
  return AOP_TEMPLATES[templateId] ?? null;
}

export function isAopProduct(productId: string): boolean {
  return Boolean(AOP_TEMPLATES[productId]);
}

export function variantIdFor(templateId: string, size = "m"): string {
  return `${templateId}-printed-${size.toLowerCase()}`;
}

function copyColorway(colorway: Colorway): Colorway {
  return { id: colorway.id, name: colorway.name, colors: { ...colorway.colors } };
}

export function defaultPanels(templateId: string): PanelDesign[] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.panels.map((item) => ({ id: item.id, fill: { kind: "role" as const } }));
}

export function defaultGarment(templateId: string): GarmentDesign {
  const colorways = HOUSE_COLORWAYS.map(copyColorway);
  return {
    templateId,
    panels: defaultPanels(templateId),
    colorways,
    activeColorwayId: colorways[0]?.id ?? "lilac-cream",
  };
}

export function activeColorway(garment: GarmentDesign): Colorway {
  return (
    garment.colorways.find((item) => item.id === garment.activeColorwayId) ??
    garment.colorways[0] ??
    HOUSE_COLORWAYS[0]!
  );
}

export function visiblePanels(template: AopTemplate, face: "front" | "back"): AopPanel[] {
  return template.panels.filter((item) => item.face === face || item.face === "both");
}

function safeArt(src: string): boolean {
  if (/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(src)) return true;
  return /^https:\/\/[^\s"]+$/.test(src);
}

export function resolvePaint(panelDef: AopPanel, fill: PanelFill | undefined, colorway: Colorway): Paint {
  const roleHex = colorway.colors[panelDef.role];
  if (!fill || fill.kind === "role") return { type: "solid", hex: roleHex };
  if (fill.kind === "color" && HEX.test(fill.hex)) return { type: "solid", hex: fill.hex };
  if (fill.kind === "pattern" && HEX.test(fill.hex) && HEX.test(fill.accent)) {
    return { type: "pattern", pattern: fill.pattern, hex: fill.hex, accent: fill.accent };
  }
  if (fill.kind === "art" && safeArt(fill.src)) return { type: "art", src: fill.src };
  return { type: "solid", hex: roleHex };
}

export function resolveGarment(garment: GarmentDesign, face: "front" | "back" = "front") {
  const template = getTemplate(garment.templateId);
  if (!template) throw new Error("That garment template is not in the studio.");
  const colorway = activeColorway(garment);
  const fills = new Map(garment.panels.map((item) => [item.id, item.fill]));
  return {
    template,
    colorway,
    panels: visiblePanels(template, face).map((item) => ({
      panel: item,
      paint: resolvePaint(item, fills.get(item.id), colorway),
    })),
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function paintAttrs(panelId: string, paint: Paint): { fill: string; extra: string } {
  if (paint.type === "solid") return { fill: paint.hex, extra: "" };
  if (paint.type === "art") {
    return { fill: "#f4f0e6", extra: "" };
  }
  return { fill: `url(#pat-${panelId})`, extra: "" };
}

function patternDef(panelId: string, paint: Paint): string {
  if (paint.type !== "pattern") return "";
  if (paint.pattern === "checker") {
    return `<pattern id="pat-${panelId}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${paint.hex}"/><rect width="6" height="6" fill="${paint.accent}"/><rect x="6" y="6" width="6" height="6" fill="${paint.accent}"/></pattern>`;
  }
  return `<pattern id="pat-${panelId}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${paint.hex}"/><rect width="4" height="10" fill="${paint.accent}"/></pattern>`;
}

/** Flat technical drawing of the whole garment, as a mockup the sandbox can store. */
export function renderGarmentSvg(input: {
  templateId: string;
  garment?: GarmentDesign;
  face?: "front" | "back";
  label?: string;
}): string {
  const garment = input.garment ?? defaultGarment(input.templateId);
  const face = input.face ?? "front";
  const resolved = resolveGarment({ ...garment, templateId: input.templateId }, face);
  const defs = resolved.panels.map(({ panel: item, paint }) => patternDef(item.id, paint)).join("");
  const art = resolved.panels
    .filter(({ paint }) => paint.type === "art")
    .map(({ panel: item, paint }) => {
      if (paint.type !== "art") return "";
      const href = paint.src.startsWith("data:") ? paint.src.replaceAll('"', "") : escapeXml(paint.src);
      return `<clipPath id="clip-${item.id}"><path d="${item.d}"/></clipPath><image href="${href}" x="${item.box.x}" y="${item.box.y}" width="${item.box.w}" height="${item.box.h}" clip-path="url(#clip-${item.id})" preserveAspectRatio="xMidYMid slice"/>`;
    })
    .join("");
  const shapes = resolved.panels
    .map(({ panel: item, paint }) => {
      const attrs = paintAttrs(item.id, paint);
      return `<path data-panel="${item.id}" d="${item.d}" fill="${attrs.fill}" stroke="#141018" stroke-width="1.5"/>`;
    })
    .join("");
  const label = input.label
    ? `<text x="200" y="172" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="14" fill="${escapeXml(resolved.colorway.colors.mark)}">${escapeXml(input.label).slice(0, 24)}</text>`
    : "";
  const { template } = resolved;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${template.viewBox}">
  <rect width="${template.viewWidth}" height="${template.viewHeight}" fill="#120a1c"/>
  <defs>${defs}</defs>
  ${shapes}
  ${art}
  ${label}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Longest side of a studio proof. This is not a Printful template size. */
export const STUDIO_PROOF_LONG_EDGE = 900;

export function studioProofPixels(layoutW: number, layoutH: number): { widthPx: number; heightPx: number } {
  const long = Math.max(layoutW, layoutH, 1);
  const scale = STUDIO_PROOF_LONG_EDGE / long;
  return {
    widthPx: Math.max(1, Math.round(layoutW * scale)),
    heightPx: Math.max(1, Math.round(layoutH * scale)),
  };
}

export type PanelExportPlan = {
  panelId: string;
  title: string;
  printful: PanelPrintTarget;
  proof: { widthPx: number; heightPx: number; note: string };
};

export function panelExportPlan(templateId: string): PanelExportPlan[] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.panels.map((item) => ({
    panelId: item.id,
    title: item.title,
    printful: panelPrintTarget(template.printful.catalogProductId, item.id),
    proof: {
      ...studioProofPixels(item.box.w, item.box.h),
      note: "Studio proof at a fixed long edge. Not a Printful print file until the template pixel size is confirmed.",
    },
  }));
}

function colorwayId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "colorway";
}

export function setRoleColor(colorway: Colorway, role: ColorRole, hex: string): Colorway {
  if (!HEX.test(hex)) return colorway;
  return { ...colorway, colors: { ...colorway.colors, [role]: hex } };
}

export function addColorway(garment: GarmentDesign, name: string): GarmentDesign {
  const trimmed = name.trim().slice(0, 40);
  if (trimmed.length < 2) throw new Error("Name the colorway.");
  if (garment.colorways.length >= 8) throw new Error("Eight colorways is the limit.");
  const source = activeColorway(garment);
  let id = colorwayId(trimmed);
  if (garment.colorways.some((item) => item.id === id)) id = `${id}-${garment.colorways.length + 1}`;
  const next = copyColorway({ ...source, id, name: trimmed });
  return { ...garment, colorways: [...garment.colorways, next], activeColorwayId: next.id };
}

export function updateColorway(garment: GarmentDesign, next: Colorway): GarmentDesign {
  if (!garment.colorways.some((item) => item.id === next.id)) return garment;
  return {
    ...garment,
    colorways: garment.colorways.map((item) => (item.id === next.id ? copyColorway(next) : item)),
  };
}

export function removeColorway(garment: GarmentDesign, id: string): GarmentDesign {
  if (garment.colorways.length <= 1) throw new Error("Keep at least one colorway.");
  const colorways = garment.colorways.filter((item) => item.id !== id);
  const activeColorwayId = garment.activeColorwayId === id ? (colorways[0]?.id ?? id) : garment.activeColorwayId;
  return { ...garment, colorways, activeColorwayId };
}

export function setPanelFill(garment: GarmentDesign, panelId: string, fill: PanelFill): GarmentDesign {
  const template = getTemplate(garment.templateId);
  if (!template?.panels.some((item) => item.id === panelId)) throw new Error("That panel is not on this garment.");
  const panels = garment.panels.some((item) => item.id === panelId)
    ? garment.panels.map((item) => (item.id === panelId ? { id: panelId, fill } : item))
    : [...garment.panels, { id: panelId, fill }];
  return { ...garment, panels };
}

function parseFill(input: unknown): PanelFill {
  const raw = (input ?? {}) as Record<string, unknown>;
  if (raw.kind === "color" && HEX.test(String(raw.hex ?? ""))) return { kind: "color", hex: String(raw.hex) };
  if (
    (raw.kind === "pattern" && raw.pattern === "stripe") ||
    (raw.kind === "pattern" && raw.pattern === "checker")
  ) {
    const hex = String(raw.hex ?? "");
    const accent = String(raw.accent ?? "");
    if (HEX.test(hex) && HEX.test(accent)) return { kind: "pattern", pattern: raw.pattern, hex, accent };
  }
  if (raw.kind === "art" && safeArt(String(raw.src ?? ""))) return { kind: "art", src: String(raw.src) };
  return { kind: "role" };
}

function parseColorway(input: unknown, index: number): Colorway {
  const raw = (input ?? {}) as Record<string, unknown>;
  const colors = (raw.colors ?? {}) as Record<string, unknown>;
  const name = String(raw.name ?? "").trim().slice(0, 40);
  if (name.length < 2) throw new Error("Name the colorway.");
  const parsed = {} as Record<ColorRole, string>;
  for (const role of COLOR_ROLES) {
    const hex = String(colors[role] ?? "");
    if (!HEX.test(hex)) throw new Error(`The ${role} color needs a hex value.`);
    parsed[role] = hex;
  }
  const id = String(raw.id ?? colorwayId(name)).slice(0, 40) || `colorway-${index}`;
  return { id, name, colors: parsed };
}

export function parseGarment(input: unknown): GarmentDesign {
  const raw = (input ?? {}) as Record<string, unknown>;
  const template = getTemplate(String(raw.templateId ?? ""));
  if (!template) throw new Error("That garment template is not in the studio.");
  const colorwaysInput = Array.isArray(raw.colorways) ? raw.colorways : [];
  if (colorwaysInput.length === 0) throw new Error("Add a colorway.");
  if (colorwaysInput.length > 8) throw new Error("Eight colorways is the limit.");
  const colorways = colorwaysInput.map(parseColorway);
  const ids = new Set(colorways.map((item) => item.id));
  if (ids.size !== colorways.length) throw new Error("Colorway names have to stay distinct.");
  const active = String(raw.activeColorwayId ?? colorways[0]?.id ?? "");
  const panelsInput = Array.isArray(raw.panels) ? raw.panels : [];
  const byId = new Map<string, PanelFill>();
  for (const entry of panelsInput) {
    const item = (entry ?? {}) as Record<string, unknown>;
    const id = String(item.id ?? "");
    if (!template.panels.some((panelDef) => panelDef.id === id)) continue;
    byId.set(id, parseFill(item.fill));
  }
  const panels = template.panels.map((panelDef) => ({
    id: panelDef.id,
    fill: byId.get(panelDef.id) ?? { kind: "role" as const },
  }));
  return {
    templateId: template.id,
    panels,
    colorways,
    activeColorwayId: ids.has(active) ? active : (colorways[0]?.id ?? ""),
  };
}

export function parseColorwayBlob(json: string): { colorways: Colorway[]; activeColorwayId: string } {
  const parsed = JSON.parse(json) as { colorways?: unknown; activeColorwayId?: string };
  const probe = parseGarment({
    templateId: "aop-hoodie",
    colorways: parsed.colorways,
    activeColorwayId: parsed.activeColorwayId,
    panels: [],
  });
  return { colorways: probe.colorways, activeColorwayId: probe.activeColorwayId };
}

export function parseStoredGarment(input: string | null | undefined): GarmentDesign | null {
  if (!input) return null;
  try {
    return parseGarment(JSON.parse(input));
  } catch {
    return null;
  }
}

export type SetPiece = {
  provider: string;
  templateId: string;
  colorways: Colorway[];
};

export function colorwaySignature(colorways: Colorway[]): string {
  return colorways
    .map(
      (item) =>
        `${item.name}|${item.colors.body}|${item.colors.contrast}|${item.colors.trim}|${item.colors.mark}`,
    )
    .join("\n");
}

/** A set is two different garments, one maker, and the same colorways. */
export function assessSet(
  pieces: SetPiece[],
): { ok: true; provider: string; colorways: Colorway[] } | { ok: false; reason: string } {
  if (pieces.length < 2) return { ok: false, reason: "A set needs at least two pieces." };
  const provider = pieces[0]?.provider ?? "";
  if (!provider || pieces.some((piece) => piece.provider !== provider)) {
    return { ok: false, reason: "Every piece in a set has to come from the same maker." };
  }
  const templates = new Set(pieces.map((piece) => piece.templateId));
  if (templates.size < 2) {
    return { ok: false, reason: "A set pairs different garments, like a hoodie and joggers." };
  }
  if (pieces.some((piece) => !isAopProduct(piece.templateId))) {
    return { ok: false, reason: "Sets are for all-over garments." };
  }
  const first = pieces[0]?.colorways ?? [];
  if (first.length === 0) return { ok: false, reason: "Add a colorway before you make a set." };
  const signature = colorwaySignature(first);
  if (pieces.some((piece) => colorwaySignature(piece.colorways) !== signature)) {
    return { ok: false, reason: "The pieces need the same colorways." };
  }
  return { ok: true, provider, colorways: first };
}

export function withSharedColorways(garment: GarmentDesign, colorways: Colorway[], activeColorwayId: string): GarmentDesign {
  const next = colorways.map(copyColorway);
  const active = next.some((item) => item.id === activeColorwayId) ? activeColorwayId : (next[0]?.id ?? "");
  return { ...garment, colorways: next, activeColorwayId: active };
}
