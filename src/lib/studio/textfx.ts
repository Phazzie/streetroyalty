/** Studio entry for the shared text layout. The geometry lives in `src/lib/text` so the printer mockups do not import the studio. */
export {
  FLAT_TEXT,
  LINE_FIT,
  OUTLINE_EM,
  TEXT_EM,
  TEXT_PRESETS,
  arcLayout,
  clampFx,
  fitFontSize,
  isFlatText,
  lineRiseEm,
  lineSpanEm,
  outlineStyle,
  textWidthEm,
} from "../text/layout.ts";
export type { CharCell, TextFx } from "../text/layout.ts";
