/**
 * Thin re-export. The garment domain (types, panel geometry, colorways, sets,
 * rendering) lives in `src/lib/garments` and does not know about a printer.
 * Printful facts and the template ↔ catalog mapping live in `src/lib/pod`.
 * `garment-bridge.ts` is the only studio module that joins the two.
 *
 * This file stays so the existing studio importers do not have to move in
 * the same change. New code should import the domain or the bridge directly.
 */
export { AOP_DPI, AOP_ORDER_CLOSED } from "../pod/aop-printful.ts";
export {
  AOP_TEMPLATES,
  COLOR_ROLES,
  HOUSE_COLORWAYS,
  LABEL_MAX,
  MAX_ART_SRC,
  MAX_GARMENT_JSON,
  SET_PARTNER,
  STUDIO_PROOF_LONG_EDGE,
  activeColorway,
  addColorway,
  assessSet,
  colorwaySignature,
  defaultGarment,
  defaultPanels,
  getTemplate,
  parseColorwayBlob,
  parseColorways,
  parseGarment,
  removeColorway,
  renderGarmentSvg,
  resolveGarment,
  resolvePaint,
  setPanelFill,
  setPartner,
  setRoleColor,
  studioProofPixels,
  updateColorway,
  visiblePanels,
  withSharedColorways,
} from "../garments/index.ts";
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
  SetPiece,
} from "../garments/index.ts";
export {
  aopFieldsFor,
  activePrinter,
  canOrderProduct,
  canonicalTemplateId,
  catalogIdFor,
  catalogLookupId,
  isAopProduct,
  isPlacementBound,
  resolveTemplateId,
  materialLine,
  panelExportPlan,
  parseStoredGarment,
  printfulCard,
  productForTemplate,
  templateForProduct,
  variantForPrinter,
  variantIdFor,
  variantsForTemplate,
} from "./garment-bridge.ts";
export type { PanelExportPlan, PrintfulCard, PrinterId } from "./garment-bridge.ts";
