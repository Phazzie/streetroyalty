import { garmentFlatSvg } from "../gfx/garments/index.ts";
import { HOUSE_BLANKS } from "../pod/house-blanks.ts";
import type { SheetProduct } from "./sheet.ts";

/**
 * The blanks the studio prints on, for the wardrobe sheet. Each one is a real
 * Printful product in its real colours, so a cast member only ever wears
 * something the shop can make. Buying happens through the studio and the rack.
 */
export const LABEL_PIECES: SheetProduct[] = HOUSE_BLANKS.map((blank) => ({
  slug: blank.id,
  name: blank.name,
  kind: blank.type,
  blurb: `${blank.model}. ${blank.description}`,
  colors: blank.colors.map((color) => ({ name: color.name, swatch: color.hex })),
  images: [{ url: garmentFlatSvg(blank.shape, blank.colors[0]?.hex ?? "#111111") }],
}));
