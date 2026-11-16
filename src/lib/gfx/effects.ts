/**
 * Print effects that work on raw RGBA pixels, so they can be tested without a
 * browser. Each one returns a new buffer and leaves the input alone.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function blank(source: Pixels): Pixels {
  return {
    data: new Uint8ClampedArray(source.data.length),
    width: source.width,
    height: source.height,
  };
}

function distance(data: Uint8ClampedArray, at: number, color: Rgb): number {
  const r = data[at] - color[0];
  const g = data[at + 1] - color[1];
  const b = data[at + 2] - color[2];
  return Math.sqrt(r * r + g * g + b * b);
}

/** 0 is white, 1 is black. Transparent pixels count as white. */
function darkness(data: Uint8ClampedArray, at: number): number {
  const light = (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
  return (1 - light) * (data[at + 3] / 255);
}

function clearCorners(source: Pixels): boolean {
  const { data, width, height } = source;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let alpha = 0;
  for (const index of corners) alpha += data[index * 4 + 3];
  return alpha / corners.length < 128;
}

/** The backdrop colour, read from the four corners. */
export function cornerColor(source: Pixels): Rgb {
  const { data, width, height } = source;
  const reach = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 8)));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const [cx, cy] of [
    [0, 0],
    [width - reach, 0],
    [0, height - reach],
    [width - reach, height - reach],
  ]) {
    for (let y = cy; y < cy + reach; y += 1) {
      for (let x = cx; x < cx + reach; x += 1) {
        const at = (y * width + x) * 4;
        r += data[at];
        g += data[at + 1];
        b += data[at + 2];
        count += 1;
      }
    }
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

/**
 * Removes the backdrop by flooding in from the edges. Only backdrop that
 * touches the border goes, so a white eye inside a black face stays white.
 */
export function knockout(
  source: Pixels,
  options: { color?: Rgb; tolerance?: number; feather?: number } = {},
): Pixels {
  const { data, width, height } = source;
  const color = options.color ?? cornerColor(source);
  const tolerance = options.tolerance ?? 42;
  const feather = options.feather ?? 36;
  const out = blank(source);
  out.data.set(data);
  const total = width * height;
  const gone = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // A picture that is already cut out has clear corners. Its backdrop is the clear area alone,
  // so nothing solid may be matched by colour, or dark art would be eaten as "black backdrop".
  const alreadyCut = !options.color && clearCorners(source);

  const visit = (index: number) => {
    if (gone[index]) return;
    const at = index * 4;
    if (data[at + 3] > 8 && (alreadyCut || distance(data, at, color) > tolerance)) return;
    gone[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }

  for (let index = 0; index < total; index += 1) {
    const at = index * 4;
    if (gone[index]) {
      out.data[at + 3] = 0;
      continue;
    }
    // Soften the rim: a kept pixel next to removed backdrop fades by how close it is to the backdrop colour.
    const x = index % width;
    const y = (index - x) / width;
    if (alreadyCut) continue;
    const rim =
      (x > 0 && gone[index - 1]) ||
      (x < width - 1 && gone[index + 1]) ||
      (y > 0 && gone[index - width]) ||
      (y < height - 1 && gone[index + width]);
    if (!rim) continue;
    const away = distance(data, at, color) - tolerance;
    const keep = Math.min(1, Math.max(0.15, away / feather));
    out.data[at + 3] = Math.round(data[at + 3] * keep);
  }
  return out;
}

/**
 * One ink, like a single screen. Dark areas print, light areas are bare cloth.
 * `invert` prints the light areas instead, for art drawn light on dark.
 */
export function oneColor(
  source: Pixels,
  ink: Rgb,
  options: { invert?: boolean; contrast?: number } = {},
): Pixels {
  const { data } = source;
  const contrast = options.contrast ?? 1.35;
  const out = blank(source);
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3] / 255;
    const dark = darkness(data, at);
    const amount = options.invert ? alpha - dark : dark;
    const curved = Math.min(1, Math.max(0, (amount - 0.5) * contrast + 0.5));
    out.data[at] = ink[0];
    out.data[at + 1] = ink[1];
    out.data[at + 2] = ink[2];
    out.data[at + 3] = Math.round(curved * 255);
  }
  return out;
}

/**
 * Rebuilds the picture out of round dots on a turned grid. Darker areas get
 * bigger dots, the way a one-colour press fakes a photograph.
 */
export function halftone(
  source: Pixels,
  ink: Rgb,
  options: { cell?: number; angle?: number; invert?: boolean } = {},
): Pixels {
  const { data, width, height } = source;
  const cell = Math.max(3, options.cell ?? Math.round(Math.max(width, height) / 90));
  const angle = ((options.angle ?? 22) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out = blank(source);
  const sample = (px: number, py: number): number => {
    const x = Math.min(width - 1, Math.max(0, Math.round(px)));
    const y = Math.min(height - 1, Math.max(0, Math.round(py)));
    const at = (y * width + x) * 4;
    const dark = darkness(data, at);
    return options.invert ? data[at + 3] / 255 - dark : dark;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Turn the pixel into grid space, find its cell centre, and turn the centre back.
      const gx = x * cos + y * sin;
      const gy = -x * sin + y * cos;
      const cx = (Math.floor(gx / cell) + 0.5) * cell;
      const cy = (Math.floor(gy / cell) + 0.5) * cell;
      const sx = cx * cos - cy * sin;
      const sy = cx * sin + cy * cos;
      const tone = Math.min(1, Math.max(0, sample(sx, sy)));
      if (tone <= 0.03) continue;
      // A dot of radius r covers pi*r^2 of a cell*cell square, so ink matches tone at r = cell*sqrt(tone/pi).
      // The extra term swells the darkest dots until they close the gaps at the cell corners.
      const radius = Math.sqrt(tone) * cell * (0.564 + 0.15 * tone * tone);
      const reach = Math.hypot(gx - cx, gy - cy);
      const edge = Math.min(1, Math.max(0, radius - reach + 0.5));
      if (edge <= 0) continue;
      const at = (y * width + x) * 4;
      out.data[at] = ink[0];
      out.data[at + 1] = ink[1];
      out.data[at + 2] = ink[2];
      out.data[at + 3] = Math.round(edge * 255);
    }
  }
  return out;
}

/** Share of pixels that would take ink, 0..1. */
export function coverage(source: Pixels): number {
  let sum = 0;
  for (let at = 3; at < source.data.length; at += 4) sum += source.data[at];
  return sum / 255 / (source.width * source.height);
}

/**
 * True when the picture sits on a dark, solid backdrop. Then the light marks are
 * the drawing and should take the ink. A transparent or light backdrop means
 * the dark marks are the drawing.
 */
export function darkBackdrop(source: Pixels): boolean {
  if (clearCorners(source)) return false;
  const [r, g, b] = cornerColor(source);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}

/**
 * Whether the light marks should take the ink. On a solid backdrop that is
 * decided by the backdrop: dark ground, light drawing. On a clear backdrop there
 * is only the drawing to go by, so pale art (a white logo) prints as itself.
 */
export function inkLightMarks(source: Pixels): boolean {
  if (!clearCorners(source)) return darkBackdrop(source);
  const { data } = source;
  let dark = 0;
  let weight = 0;
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3] / 255;
    if (alpha < 0.1) continue;
    const light = (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
    dark += (1 - light) * alpha;
    weight += alpha;
  }
  return weight > 0 && dark / weight < 0.35;
}
