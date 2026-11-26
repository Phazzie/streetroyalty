import type {
  AopPanel,
  AopTemplate,
  ColorRole,
  PanelDesign,
  PanelFace,
  PanelKind,
  PanelTarget,
} from "./types.ts";

type Box = AopPanel["box"];

function panel(
  id: string,
  title: string,
  role: ColorRole,
  face: PanelFace,
  d: string,
  box: Box,
  targets: readonly PanelTarget[],
  kind: PanelKind = "piece",
): AopPanel {
  return { id, title, role, face, kind, d, box, targets };
}

/** Whole pieces in one placement. */
function pieces(placement: string, ...ids: string[]): PanelTarget[] {
  return ids.map((piece) => ({ placement, piece }));
}

/** A band along a piece's left or right edge. */
function edgeBand(
  placement: string,
  piece: string,
  edge: "left" | "right",
  offsetIn: number,
  widthIn: number,
): PanelTarget {
  return { placement, piece, band: { edge, offsetIn, widthIn } };
}

/** Side bands are wide enough that a 2 inch print shift still lands the seam in band colour. */
const SIDE_BAND_IN = 2;
/** Piping sits at the band's inner edge, well away from the seam. */
const PIPING_IN = 0.25;
/** On the jacket the piping runs on the front halves, 0.8 in from the side seam. */
const JACKET_PIPING_OFFSET_IN = 0.8;

/*
 * Sides are named as the viewer sees the front of the garment. The front sheet
 * is drawn from the front, so the viewer's left is the sheet's left. The back
 * sheet is drawn from behind, so the same side seam is on the back sheet's right.
 */
const HOODIE_PANELS: AopPanel[] = [
  panel(
    "hood",
    "Hood",
    "body",
    "both",
    "M155 42 C155 14 245 14 245 42 L262 102 L200 120 L138 102 Z",
    { x: 138, y: 14, w: 124, h: 106 },
    pieces("hood", "hood_1", "hood_2", "hood_3", "hood_4"),
  ),
  panel(
    "sleeve_left",
    "Left sleeve",
    "body",
    "both",
    "M150 118 L36 196 L58 228 L164 160 Z",
    { x: 36, y: 118, w: 128, h: 110 },
    pieces("sleeve_left", "sleeve_left"),
  ),
  panel(
    "sleeve_right",
    "Right sleeve",
    "body",
    "both",
    "M250 118 L364 196 L342 228 L236 160 Z",
    { x: 236, y: 118, w: 128, h: 110 },
    pieces("sleeve_right", "sleeve_right"),
  ),
  panel(
    "cuff_left",
    "Left cuff",
    "trim",
    "both",
    "M36 196 L22 222 L54 252 L58 228 Z",
    { x: 22, y: 196, w: 36, h: 56 },
    pieces("sleeve_left", "cuff_left"),
  ),
  panel(
    "cuff_right",
    "Right cuff",
    "trim",
    "both",
    "M364 196 L378 222 L346 252 L342 228 Z",
    { x: 342, y: 196, w: 36, h: 56 },
    pieces("sleeve_right", "cuff_right"),
  ),
  panel(
    "body_front",
    "Body front",
    "body",
    "front",
    "M118 124 H282 V392 H118 Z",
    { x: 118, y: 124, w: 164, h: 268 },
    pieces("front", "body_front"),
  ),
  panel(
    "body_back",
    "Body back",
    "body",
    "back",
    "M118 124 H282 V392 H118 Z",
    { x: 118, y: 124, w: 164, h: 268 },
    pieces("back", "body_back").concat(pieces("label_panel", "label_panel")),
  ),
  panel(
    "side_left",
    "Left side stripe",
    "contrast",
    "both",
    "M118 128 H146 V392 H118 Z",
    { x: 118, y: 128, w: 28, h: 264 },
    [
      edgeBand("front", "body_front", "left", 0, SIDE_BAND_IN),
      edgeBand("back", "body_back", "right", 0, SIDE_BAND_IN),
    ],
    "trim",
  ),
  panel(
    "piping_left",
    "Left piping",
    "trim",
    "both",
    "M146 128 H152 V392 H146 Z",
    { x: 146, y: 128, w: 6, h: 264 },
    [
      edgeBand("front", "body_front", "left", SIDE_BAND_IN, PIPING_IN),
      edgeBand("back", "body_back", "right", SIDE_BAND_IN, PIPING_IN),
    ],
    "trim",
  ),
  panel(
    "side_right",
    "Right side stripe",
    "contrast",
    "both",
    "M254 128 H282 V392 H254 Z",
    { x: 254, y: 128, w: 28, h: 264 },
    [
      edgeBand("front", "body_front", "right", 0, SIDE_BAND_IN),
      edgeBand("back", "body_back", "left", 0, SIDE_BAND_IN),
    ],
    "trim",
  ),
  panel(
    "piping_right",
    "Right piping",
    "trim",
    "both",
    "M248 128 H254 V392 H248 Z",
    { x: 248, y: 128, w: 6, h: 264 },
    [
      edgeBand("front", "body_front", "right", SIDE_BAND_IN, PIPING_IN),
      edgeBand("back", "body_back", "left", SIDE_BAND_IN, PIPING_IN),
    ],
    "trim",
  ),
  panel(
    "pocket",
    "Pocket",
    "contrast",
    "front",
    "M162 300 L174 252 H226 L238 300 Z",
    { x: 162, y: 252, w: 76, h: 48 },
    pieces("pocket", "pocket"),
  ),
  panel(
    "waistband",
    "Waistband",
    "trim",
    "both",
    "M118 392 H282 V426 H118 Z",
    { x: 118, y: 392, w: 164, h: 34 },
    pieces("front", "waistband_front").concat(pieces("back", "waistband_back")),
  ),
  panel(
    "mark",
    "Chest logo",
    "mark",
    "front",
    "M176 150 H224 V186 H176 Z",
    { x: 176, y: 150, w: 48, h: 36 },
    // 4 x 3 inches, centred on the chest, 2.5 inches under the neckline.
    [{ placement: "front", piece: "body_front", box: { x: 1368, y: 474, w: 264, h: 198 } }],
    "mark",
  ),
];

/*
 * Each jogger leg is one piece that wraps the whole leg. Its outer side runs
 * down the middle of the piece, so the side stripe is a band down that line.
 */
const JOGGER_PANELS: AopPanel[] = [
  panel(
    "waistband",
    "Waistband",
    "trim",
    "both",
    "M116 36 H284 V78 H116 Z",
    { x: 116, y: 36, w: 168, h: 42 },
    pieces("leg_left", "waistband_left").concat(pieces("leg_right", "waistband_right")),
  ),
  panel(
    "leg_left",
    "Left leg",
    "body",
    "both",
    "M116 78 L196 78 L188 448 L130 448 Z",
    { x: 116, y: 78, w: 80, h: 370 },
    pieces("leg_left", "leg_left"),
  ),
  panel(
    "leg_right",
    "Right leg",
    "body",
    "both",
    "M204 78 L284 78 L270 448 L212 448 Z",
    { x: 204, y: 78, w: 80, h: 370 },
    pieces("leg_right", "leg_right"),
  ),
  panel(
    "stripe_left",
    "Left side stripe",
    "contrast",
    "both",
    "M116 78 L134 78 L146 448 L130 448 Z",
    { x: 116, y: 78, w: 30, h: 370 },
    [
      {
        placement: "leg_left",
        piece: "leg_left",
        band: { line: [1483, 200, 1446, 2560], widthIn: SIDE_BAND_IN },
      },
    ],
    "trim",
  ),
  panel(
    "stripe_right",
    "Right side stripe",
    "contrast",
    "both",
    "M266 78 L284 78 L270 448 L254 448 Z",
    { x: 254, y: 78, w: 30, h: 370 },
    [
      {
        placement: "leg_right",
        piece: "leg_right",
        band: { line: [1518, 200, 1552, 2560], widthIn: SIDE_BAND_IN },
      },
    ],
    "trim",
  ),
  panel(
    "cuff_left",
    "Left cuff",
    "trim",
    "both",
    "M124 448 H192 V492 H124 Z",
    { x: 124, y: 448, w: 68, h: 44 },
    pieces("leg_left", "cuff_left"),
  ),
  panel(
    "cuff_right",
    "Right cuff",
    "trim",
    "both",
    "M208 448 H276 V492 H208 Z",
    { x: 208, y: 448, w: 68, h: 44 },
    pieces("leg_right", "cuff_right"),
  ),
  panel(
    "mark",
    "Thigh logo",
    "mark",
    "front",
    "M138 108 H174 V135 H138 Z",
    { x: 138, y: 108, w: 36, h: 27 },
    // 3 x 2.25 inches on the outer thigh, 5 inches under the waistband.
    [{ placement: "leg_left", piece: "leg_left", box: { x: 1390, y: 560, w: 180, h: 135 } }],
    "mark",
  ),
];

const JACKET_PANELS: AopPanel[] = [
  panel(
    "collar",
    "Collar",
    "trim",
    "both",
    "M150 40 H250 L236 92 H164 Z",
    { x: 150, y: 40, w: 100, h: 52 },
    pieces("front", "collar_front_sheet")
      .concat(pieces("back", "collar_back_sheet"))
      .concat(pieces("details", "collar_details_sheet")),
  ),
  panel(
    "sleeve_left",
    "Left sleeve",
    "body",
    "both",
    "M150 108 L36 188 L58 220 L164 150 Z",
    { x: 36, y: 108, w: 128, h: 112 },
    pieces("sleeve_left", "sleeve_left"),
  ),
  panel(
    "sleeve_right",
    "Right sleeve",
    "body",
    "both",
    "M250 108 L364 188 L342 220 L236 150 Z",
    { x: 236, y: 108, w: 128, h: 112 },
    pieces("sleeve_right", "sleeve_right"),
  ),
  panel(
    "cuff_left",
    "Left cuff",
    "trim",
    "both",
    "M36 188 L22 214 L54 244 L58 220 Z",
    { x: 22, y: 188, w: 36, h: 56 },
    pieces("sleeve_left", "cuff_left"),
  ),
  panel(
    "cuff_right",
    "Right cuff",
    "trim",
    "both",
    "M364 188 L378 214 L346 244 L342 220 Z",
    { x: 342, y: 188, w: 36, h: 56 },
    pieces("sleeve_right", "cuff_right"),
  ),
  panel(
    "side_left",
    "Left side panel",
    "contrast",
    "both",
    "M118 112 H146 V392 H118 Z",
    { x: 118, y: 112, w: 28, h: 280 },
    pieces("front", "side_a"),
  ),

  panel(
    "body_front",
    "Body front",
    "body",
    "front",
    "M146 100 H254 V392 H146 Z",
    { x: 146, y: 100, w: 108, h: 292 },
    pieces("front", "front_a", "front_b").concat(pieces("details", "zip_facing_a", "zip_facing_b")),
  ),
  panel(
    "body_back",
    "Body back",
    "body",
    "back",
    "M146 100 H254 V392 H146 Z",
    { x: 146, y: 100, w: 108, h: 292 },
    pieces("back", "body_back"),
  ),

  panel(
    "side_right",
    "Right side panel",
    "contrast",
    "both",
    "M254 112 H282 V392 H254 Z",
    { x: 254, y: 112, w: 28, h: 280 },
    pieces("front", "side_b"),
  ),
  panel(
    "piping_left",
    "Left piping",
    "trim",
    "front",
    "M150 112 H156 V392 H150 Z",
    { x: 150, y: 112, w: 6, h: 280 },
    [edgeBand("front", "front_a", "left", JACKET_PIPING_OFFSET_IN, PIPING_IN)],
    "trim",
  ),
  panel(
    "piping_right",
    "Right piping",
    "trim",
    "front",
    "M244 112 H250 V392 H244 Z",
    { x: 244, y: 112, w: 6, h: 280 },
    [edgeBand("front", "front_b", "right", JACKET_PIPING_OFFSET_IN, PIPING_IN)],
    "trim",
  ),
  panel(
    "pocket",
    "Pocket bags",
    "contrast",
    "front",
    "M162 250 H190 V300 H162 Z",
    { x: 162, y: 250, w: 28, h: 50 },
    pieces("pocket", "pocket_bag_1", "pocket_bag_2", "pocket_bag_3", "pocket_bag_4"),
  ),
  panel(
    "hem",
    "Hem",
    "trim",
    "both",
    "M118 392 H282 V426 H118 Z",
    { x: 118, y: 392, w: 164, h: 34 },
    pieces("front", "hem_front_a", "hem_front_b").concat(pieces("back", "hem_back")),
  ),
  panel(
    "mark",
    "Chest logo",
    "mark",
    "front",
    "M212 140 H244 V164 H212 Z",
    { x: 212, y: 140, w: 32, h: 24 },
    // 3.5 x 2.6 inches on the wearer's left chest, clear of the zip.
    [{ placement: "front", piece: "front_b", box: { x: 1880, y: 830, w: 219, h: 164 } }],
    "mark",
  ),
];

export const AOP_TEMPLATES: Record<string, AopTemplate> = {
  "aop-hoodie": {
    id: "aop-hoodie",
    name: "All-Over Hoodie",
    shortName: "Hoodie",
    kind: "Hoodie",
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: HOODIE_PANELS,
  },
  "aop-joggers": {
    id: "aop-joggers",
    name: "All-Over Joggers",
    shortName: "Joggers",
    kind: "Joggers",
    viewBox: "0 0 400 520",
    viewWidth: 400,
    viewHeight: 520,
    panels: JOGGER_PANELS,
  },
  "aop-track-jacket": {
    id: "aop-track-jacket",
    name: "All-Over Track Jacket",
    shortName: "Track jacket",
    kind: "Jacket",
    viewBox: "0 0 400 460",
    viewWidth: 400,
    viewHeight: 460,
    panels: JACKET_PANELS,
  },
};

export function getTemplate(templateId: string): AopTemplate | null {
  return AOP_TEMPLATES[templateId] ?? null;
}

export function defaultPanels(templateId: string): PanelDesign[] {
  const template = getTemplate(templateId);
  if (!template) return [];
  return template.panels.map((item) => ({ id: item.id, fill: { kind: "role" as const } }));
}

export function visiblePanels(template: AopTemplate, face: "front" | "back"): AopPanel[] {
  return template.panels.filter((item) => item.face === face || item.face === "both");
}
