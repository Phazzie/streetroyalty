/**
 * How big a piece's name is set on the front of the tag, in inches of type size.
 *
 * The face is 2 inches wide and the name has to fit whole, so this tries sizes from
 * big to small and takes the first where every word fits on a line and the lines fit
 * in the space between the crown and the maker.
 */

/** Width of the text column on the tag, in inches. */
const COLUMN = 1.56;
/** Height the name may take, in inches. */
const ROOM = 1.02;
/** Average glyph width of the condensed display face, in ems. Measured a little wide on purpose. */
const GLYPH = 0.48;
/** Line height of the display face. */
const LEADING = 0.9;

const SIZES = [0.46, 0.42, 0.38, 0.34, 0.3, 0.27, 0.24, 0.21, 0.18] as const;
export const SMALLEST_TITLE = 0.16;

/** How many lines the words take when a line holds `capacity` letters. */
export function linesFor(words: string[], capacity: number): number {
  let lines = 0;
  let used = 0;
  for (const word of words) {
    if (used > 0 && used + 1 + word.length <= capacity) {
      used += 1 + word.length;
    } else {
      lines += 1;
      used = word.length;
    }
  }
  return lines;
}

export function titleSize(title: string): number {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return SIZES[0];
  const longest = Math.max(...words.map((word) => word.length));
  for (const size of SIZES) {
    const capacity = Math.floor(COLUMN / (GLYPH * size));
    if (longest > capacity) continue;
    if (linesFor(words, capacity) * size * LEADING <= ROOM) return size;
  }
  return SMALLEST_TITLE;
}
