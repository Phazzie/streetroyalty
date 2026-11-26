export type {
  AopPanel,
  AopTemplate,
  ColorRole,
  Colorway,
  GarmentDesign,
  Paint,
  PanelDesign,
  PanelFace,
  PanelFill,
  PanelKind,
  PanelTarget,
  TrimBand,
} from "./types.ts";
export { COLOR_ROLES, HEX, LABEL_MAX, MAX_ART_SRC, MAX_GARMENT_JSON } from "./types.ts";
export { parseFill, resolvePaint, safeArt } from "./fill.ts";
export {
  AOP_TEMPLATES,
  SET_PARTNER,
  defaultPanels,
  getTemplate,
  setPartner,
  visiblePanels,
} from "./panels.ts";
export {
  HOUSE_COLORWAYS,
  activeColorway,
  addColorway,
  defaultGarment,
  parseColorwayBlob,
  parseColorways,
  parseGarment,
  removeColorway,
  setPanelFill,
  setRoleColor,
  updateColorway,
  withSharedColorways,
} from "./colorways.ts";
export { assessSet, colorwaySignature, type SetPiece } from "./sets.ts";
export {
  STUDIO_PROOF_LONG_EDGE,
  labelAnchor,
  renderGarmentSvg,
  resolveGarment,
  studioProofPixels,
} from "./render.ts";
export {
  BLEED_IN,
  PRINT_DPI,
  coverageProblems,
  pieceOwner,
  printPlacements,
  renderPrintSheet,
  renderPrintSheets,
  unitsPerInch,
  type PrintSheet,
  type SheetOptions,
} from "./print.ts";
