import type { AopPanel, AopTemplate, ColorRole, PanelDesign, PanelFace } from "./types.ts";

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
  panel(
    "hood",
    "Hood",
    "body",
    "both",
    "M155 42 C155 14 245 14 245 42 L262 102 L200 120 L138 102 Z",
    {
      x: 138,
      y: 14,
      w: 124,
      h: 106,
    },
  ),
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
  panel(
    "stripe_left",
    "Left side stripe",
    "contrast",
    "both",
    "M104 78 L128 78 L142 448 L116 448 Z",
    {
      x: 104,
      y: 78,
      w: 38,
      h: 370,
    },
  ),
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
  panel(
    "stripe_right",
    "Right side stripe",
    "contrast",
    "both",
    "M272 78 L296 78 L284 448 L258 448 Z",
    {
      x: 258,
      y: 78,
      w: 38,
      h: 370,
    },
  ),
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
    shortName: "Hoodie",
    kind: "Hoodie",
    partnerId: "aop-joggers",
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: HOODIE_PANELS,
  },
  "aop-joggers": {
    id: "aop-joggers",
    name: "AOP Joggers",
    shortName: "Joggers",
    kind: "Joggers",
    partnerId: "aop-hoodie",
    viewBox: "0 0 400 520",
    viewWidth: 400,
    viewHeight: 520,
    panels: JOGGER_PANELS,
  },
  "aop-track-jacket": {
    id: "aop-track-jacket",
    name: "AOP Track Jacket",
    shortName: "Track jacket",
    kind: "Jacket",
    partnerId: "aop-joggers",
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: JACKET_PANELS,
  },
};

export function getTemplate(templateId: string): AopTemplate | null {
  return AOP_TEMPLATES[templateId] ?? null;
}

/** The other all-over garment this one pairs with. Null when the template is unknown or unpaired. */
export function setPartner(templateId: string): string | null {
  return getTemplate(templateId)?.partnerId ?? null;
}

/** Which blank a piece pairs with when a designer builds a set. Derived from the templates. */
export const SET_PARTNER: Record<string, string> = Object.fromEntries(
  Object.values(AOP_TEMPLATES).flatMap((template) =>
    template.partnerId ? [[template.id, template.partnerId]] : [],
  ),
);

export function defaultPanels(templateId: string): PanelDesign[] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.panels.map((item) => ({ id: item.id, fill: { kind: "role" as const } }));
}

export function visiblePanels(template: AopTemplate, face: "front" | "back"): AopPanel[] {
  return template.panels.filter((item) => item.face === face || item.face === "both");
}
