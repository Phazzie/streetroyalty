import { parseFill } from "./fill.ts";
import { defaultPanels, getTemplate } from "./panels.ts";
import {
  COLOR_ROLES,
  HEX,
  MAX_GARMENT_JSON,
  type ColorRole,
  type Colorway,
  type GarmentDesign,
  type PanelFill,
} from "./types.ts";

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

function copyColorway(colorway: Colorway): Colorway {
  return { id: colorway.id, name: colorway.name, colors: { ...colorway.colors } };
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
  if (garment.colorways.some((item) => item.id === id))
    id = `${id}-${garment.colorways.length + 1}`;
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
  const activeColorwayId =
    garment.activeColorwayId === id ? (colorways[0]?.id ?? id) : garment.activeColorwayId;
  return { ...garment, colorways, activeColorwayId };
}

export function setPanelFill(
  garment: GarmentDesign,
  panelId: string,
  fill: PanelFill,
): GarmentDesign {
  const template = getTemplate(garment.templateId);
  if (!template?.panels.some((item) => item.id === panelId))
    throw new Error("That panel is not on this garment.");
  const panels = garment.panels.some((item) => item.id === panelId)
    ? garment.panels.map((item) => (item.id === panelId ? { id: panelId, fill } : item))
    : [...garment.panels, { id: panelId, fill }];
  return { ...garment, panels };
}

function parseColorway(input: unknown, index: number): Colorway {
  const raw = (input ?? {}) as Record<string, unknown>;
  const colors = (raw.colors ?? {}) as Record<string, unknown>;
  const name = String(raw.name ?? "")
    .trim()
    .slice(0, 40);
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

/** Colorways on their own. A set stores them without pinning a garment template. */
export function parseColorways(
  input: unknown,
  activeColorwayId?: string,
): { colorways: Colorway[]; activeColorwayId: string } {
  const colorwaysInput = Array.isArray(input) ? input : [];
  if (colorwaysInput.length === 0) throw new Error("Add a colorway.");
  if (colorwaysInput.length > 8) throw new Error("Eight colorways is the limit.");
  const colorways = colorwaysInput.map(parseColorway);
  const ids = new Set(colorways.map((item) => item.id));
  if (ids.size !== colorways.length) throw new Error("Colorway names have to stay distinct.");
  const active = String(activeColorwayId ?? colorways[0]?.id ?? "");
  return {
    colorways,
    activeColorwayId: ids.has(active) ? active : (colorways[0]?.id ?? ""),
  };
}

export function parseColorwayBlob(json: string): {
  colorways: Colorway[];
  activeColorwayId: string;
} {
  const parsed = JSON.parse(json) as { colorways?: unknown; activeColorwayId?: string };
  return parseColorways(parsed.colorways, parsed.activeColorwayId);
}

export function parseGarment(input: unknown): GarmentDesign {
  const raw = (input ?? {}) as Record<string, unknown>;
  const template = getTemplate(String(raw.templateId ?? ""));
  if (!template) throw new Error("That garment template is not in the studio.");
  const { colorways, activeColorwayId } = parseColorways(
    raw.colorways,
    String(raw.activeColorwayId ?? ""),
  );
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
  const garment: GarmentDesign = {
    templateId: template.id,
    panels,
    colorways,
    activeColorwayId,
  };
  if (JSON.stringify(garment).length > MAX_GARMENT_JSON) {
    throw new Error("The panel pictures are too large together. Use smaller ones, or fewer.");
  }
  return garment;
}

export function withSharedColorways(
  garment: GarmentDesign,
  colorways: Colorway[],
  activeColorwayId: string,
): GarmentDesign {
  const next = colorways.map(copyColorway);
  const active = next.some((item) => item.id === activeColorwayId)
    ? activeColorwayId
    : (next[0]?.id ?? "");
  return { ...garment, colorways: next, activeColorwayId: active };
}
