/**
 * Printer-agnostic all-over garment model. Template ids such as `aop-hoodie`
 * are the garment identity. Printer catalog ids live in the pod mapping, not here.
 */

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
  /** Studio drawing box in viewBox units. Not a printer template size. */
  box: { x: number; y: number; w: number; h: number };
};

export type AopTemplate = {
  id: string;
  name: string;
  /** Name used when a set titles the partner piece. */
  shortName: string;
  /** Catalog type, such as Hoodie or Joggers. */
  kind: string;
  /** The other all-over template this piece pairs with. */
  partnerId: string | null;
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

export const HEX = /^#[0-9a-fA-F]{6}$/;

/** Longest picture one art panel takes. The same cap as a layer image in `validate.ts`. */
export const MAX_ART_SRC = 1_400_000;
/**
 * Longest saved garment, as JSON. Keeps the drawn mockup, which carries the
 * art panels on its face, under the 2 MB mockup cap in `validate.ts`.
 */
export const MAX_GARMENT_JSON = 1_800_000;
/** Most characters of the label drawn on the flat. */
export const LABEL_MAX = 24;
