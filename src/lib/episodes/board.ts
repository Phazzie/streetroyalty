/**
 * The reference board: one PNG with every piece a character wears, laid out on a
 * fixed grid so the board looks the same every time it is made. The layout and the
 * colour sampling are pure. Drawing happens in the browser (reference-board.tsx).
 */

export const BOARD_WIDTH = 1920;
export const BOARD_HEIGHT = 1080;
export const BOARD_COLUMNS = 3;
/** The grid never grows past six. That is a full outfit and still reads as one reference. */
export const BOARD_SLOTS = BOARD_COLUMNS * 2;

export type Rect = { x: number; y: number; w: number; h: number };

export type BoardCell = {
  index: number;
  frame: Rect;
  /** Where the picture goes, inside the frame. */
  picture: Rect;
  /** Where the number, name and garment are written. */
  text: Rect;
  /** Where the colour swatches go. Always the same size, so swatches compare across boards. */
  swatches: Rect;
  /** The rule between the picture and the words. */
  divider: Rect;
};

export type BoardLayout = {
  width: number;
  height: number;
  rows: 1 | 2;
  header: Rect;
  cells: BoardCell[];
};

const MARGIN = 48;
const HEADER = 132;
const GAP = 24;
const PAD = 20;
export const SWATCH_BLOCK = { w: 229, h: 196 };

/**
 * The grid for a given number of pieces. Two fixed shapes and nothing in between:
 * up to three pieces sit in one row of tall cells, so each picture is as big as
 * the board allows, and four to six sit in two rows. Cells that are not used are
 * still in the list, so a board never reflows.
 */
export function boardLayout(count: number): BoardLayout {
  const rows: 1 | 2 = count > BOARD_COLUMNS ? 2 : 1;
  const top = MARGIN + HEADER;
  const cellW = (BOARD_WIDTH - MARGIN * 2 - GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS;
  const cellH = (BOARD_HEIGHT - top - MARGIN - GAP * (rows - 1)) / rows;
  const cells: BoardCell[] = [];
  for (let index = 0; index < BOARD_COLUMNS * rows; index += 1) {
    const column = index % BOARD_COLUMNS;
    const row = Math.floor(index / BOARD_COLUMNS);
    const frame = {
      x: MARGIN + column * (cellW + GAP),
      y: top + row * (cellH + GAP),
      w: cellW,
      h: cellH,
    };
    if (rows === 1) {
      // One row: the picture on top, the words and swatches side by side beneath it.
      const strip = SWATCH_BLOCK.h + PAD * 2;
      const stripY = frame.y + frame.h - strip;
      cells.push({
        index,
        frame,
        picture: { x: frame.x, y: frame.y, w: frame.w, h: frame.h - strip },
        text: {
          x: frame.x + PAD,
          y: stripY,
          w: frame.w - SWATCH_BLOCK.w - PAD * 3,
          h: strip,
        },
        swatches: {
          x: frame.x + frame.w - SWATCH_BLOCK.w - PAD,
          y: stripY + PAD,
          w: SWATCH_BLOCK.w,
          h: SWATCH_BLOCK.h,
        },
        divider: { x: frame.x, y: stripY - 1, w: frame.w, h: 2 },
      });
      continue;
    }
    // Two rows: the picture on the left, the words above the swatches on the right.
    const captionW = SWATCH_BLOCK.w + PAD * 2;
    const pictureW = frame.w - captionW;
    cells.push({
      index,
      frame,
      picture: { x: frame.x, y: frame.y, w: pictureW, h: frame.h },
      text: {
        x: frame.x + pictureW + PAD,
        y: frame.y,
        w: SWATCH_BLOCK.w,
        h: frame.h - SWATCH_BLOCK.h - PAD,
      },
      swatches: {
        x: frame.x + pictureW + PAD,
        y: frame.y + frame.h - SWATCH_BLOCK.h - PAD,
        w: SWATCH_BLOCK.w,
        h: SWATCH_BLOCK.h,
      },
      divider: { x: frame.x + pictureW - 1, y: frame.y, w: 2, h: frame.h },
    });
  }
  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    rows,
    header: { x: MARGIN, y: MARGIN, w: BOARD_WIDTH - MARGIN * 2, h: HEADER - GAP },
    cells,
  };
}

/** The largest box of the given shape that fits inside a rect, centred. */
export function containRect(box: Rect, width: number, height: number): Rect {
  if (!(width > 0) || !(height > 0)) return { ...box };
  const scale = Math.min(box.w / width, box.h / height);
  const w = width * scale;
  const h = height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * The main colours in a picture, biggest area first, as hex. Pixels are grouped
 * into coarse buckets and each bucket reports its average. The colour in the four
 * corners is treated as the backdrop and left out, and so are see-through pixels.
 */
export function samplePalette(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  count = 4,
): string[] {
  if (!(width > 0) || !(height > 0) || rgba.length < width * height * 4) return [];
  const at = (x: number, y: number): [number, number, number, number] => {
    const offset = (y * width + x) * 4;
    return [rgba[offset] ?? 0, rgba[offset + 1] ?? 0, rgba[offset + 2] ?? 0, rgba[offset + 3] ?? 0];
  };

  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)].filter(
    (pixel) => pixel[3] >= 128,
  );
  const backdrop: [number, number, number] | null =
    corners.length > 0
      ? [
          corners.reduce((sum, pixel) => sum + pixel[0], 0) / corners.length,
          corners.reduce((sum, pixel) => sum + pixel[1], 0) / corners.length,
          corners.reduce((sum, pixel) => sum + pixel[2], 0) / corners.length,
        ]
      : null;

  const pick = (skip: [number, number, number] | null): string[] => {
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = at(x, y);
        if (a < 128) continue;
        if (skip && distance([r, g, b], skip) < 36) continue;
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        bucket.n += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        buckets.set(key, bucket);
      }
    }
    const ranked = [...buckets.values()]
      .map((bucket) => ({
        n: bucket.n,
        rgb: [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n] as [
          number,
          number,
          number,
        ],
      }))
      .sort((a, b) => b.n - a.n);
    const picked: { n: number; rgb: [number, number, number] }[] = [];
    const total = ranked.reduce((sum, bucket) => sum + bucket.n, 0);
    for (const bucket of ranked) {
      if (picked.length >= count) break;
      // A sliver of colour is noise from shading, not part of the garment.
      if (total > 0 && bucket.n / total < 0.015) break;
      if (picked.some((other) => distance(other.rgb, bucket.rgb) < 48)) continue;
      picked.push(bucket);
    }
    return picked.map((bucket) => toHex(bucket.rgb[0], bucket.rgb[1], bucket.rgb[2]));
  };

  const withoutBackdrop = pick(backdrop);
  // A garment that fills the frame is its own corners. Then the whole picture counts.
  return withoutBackdrop.length > 0 ? withoutBackdrop : pick(null);
}

/** Black or cream, whichever reads on the given hex. For labels drawn on a swatch. */
export function inkOn(hex: string): "#17101f" | "#fffaf2" {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "#17101f";
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => parseInt(part ?? "0", 16) / 255);
  const lin = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
  return luminance > 0.36 ? "#17101f" : "#fffaf2";
}

/** A file name for the download: wardrobe-character-a.png. */
export function boardFileName(character: string): string {
  const slug = character
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `wardrobe-${slug || "character"}.png`;
}
