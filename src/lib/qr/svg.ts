import { alignmentPatterns, KIND, type QrMatrix } from "./encode.ts";
import { CROWN_BOX, CROWN_PATH, isCovered, markZone } from "./mark.ts";

/** The light border a camera needs around a code, in modules. The standard asks for four. */
export const QUIET_ZONE = 4;

export type QrSvgOptions = {
  /** "square" is the plain grid. "stitched" draws each run of modules as a thread stitch. */
  style?: "square" | "stitched";
  /** Module colour. Keep it far darker than the ground or cameras give up. */
  dark?: string;
  /** Ground colour, quiet zone included. */
  light?: string;
  /** Put the crown in the middle. On by default. */
  mark?: boolean;
  /** Crown colour. Defaults to the module colour. */
  markColor?: string;
  /** Width and height attributes in pixels. Left off, the svg fills whatever holds it. */
  pixels?: number;
  /** Read out by screen readers. */
  title?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trim(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** Each row's dark modules as runs, skipping whatever `skip` says to leave out. */
function runs(
  matrix: QrMatrix,
  skip: (x: number, y: number) => boolean,
): { x: number; y: number; length: number }[] {
  const result: { x: number; y: number; length: number }[] = [];
  for (let y = 0; y < matrix.size; y += 1) {
    let start = -1;
    for (let x = 0; x <= matrix.size; x += 1) {
      const dark = x < matrix.size && matrix.modules[y * matrix.size + x] === 1 && !skip(x, y);
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) {
        result.push({ x: start, y, length: x - start });
        start = -1;
      }
    }
  }
  return result;
}

/** A ring with square proportions and softened corners, drawn as one even-odd path. */
function ring(x: number, y: number, outer: number, radius: number): string {
  const box = (left: number, top: number, side: number, r: number) =>
    `M${trim(left + r)} ${trim(top)}h${trim(side - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${trim(side - 2 * r)}a${r} ${r} 0 0 1 -${r} ${r}h-${trim(side - 2 * r)}a${r} ${r} 0 0 1 -${r} -${r}v-${trim(side - 2 * r)}a${r} ${r} 0 0 1 ${r} -${r}z`;
  return box(x, y, outer, radius) + box(x + 1, y + 1, outer - 2, Math.max(0.05, radius - 0.35));
}

/**
 * The code as an svg string. One unit is one module, so it stays crisp at any size.
 * The quiet zone is part of the picture; do not crop it.
 */
export function qrSvg(matrix: QrMatrix, options: QrSvgOptions = {}): string {
  const style = options.style ?? "square";
  const dark = options.dark ?? "#000000";
  const light = options.light ?? "#ffffff";
  const mark = options.mark === false ? null : markZone(matrix);
  const side = matrix.size + QUIET_ZONE * 2;
  const q = QUIET_ZONE;

  const parts: string[] = [];
  const sizeAttrs = options.pixels ? ` width="${options.pixels}" height="${options.pixels}"` : "";
  const label = options.title ? ` role="img" aria-label="${escapeXml(options.title)}"` : "";
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"${sizeAttrs}${label}>`,
  );
  if (options.title) parts.push(`<title>${escapeXml(options.title)}</title>`);
  parts.push(`<rect width="${side}" height="${side}" fill="${escapeXml(light)}"/>`);

  if (style === "square") {
    const d = runs(matrix, (x, y) => isCovered(matrix, mark, x, y))
      .map((run) => `M${run.x + q} ${run.y + q}h${run.length}v1h-${run.length}z`)
      .join("");
    parts.push(`<path fill="${escapeXml(dark)}" shape-rendering="crispEdges" d="${d}"/>`);
  } else {
    // Eyes stay solid shapes with true proportions. Everything else is thread.
    const eyes: string[] = [];
    const dots: string[] = [];
    const last = matrix.size - 7;
    for (const [x, y] of [
      [0, 0],
      [last, 0],
      [0, last],
    ] as const) {
      eyes.push(ring(x + q, y + q, 7, 0.9));
      dots.push(
        `<rect x="${x + q + 2}" y="${y + q + 2}" width="3" height="3" rx="0.55" fill="${escapeXml(dark)}"/>`,
      );
    }
    for (const centre of alignmentPatterns(matrix.version)) {
      eyes.push(ring(centre.x - 2 + q, centre.y - 2 + q, 5, 0.5));
      dots.push(
        `<rect x="${centre.x + q}" y="${centre.y + q}" width="1" height="1" rx="0.2" fill="${escapeXml(dark)}"/>`,
      );
    }
    parts.push(`<path fill="${escapeXml(dark)}" fill-rule="evenodd" d="${eyes.join("")}"/>`);
    parts.push(dots.join(""));

    const solid = (x: number, y: number) => {
      const kind = matrix.kinds[y * matrix.size + x];
      return kind === KIND.finder || kind === KIND.alignment || isCovered(matrix, mark, x, y);
    };
    const d = runs(matrix, solid)
      .map((run) => `M${trim(run.x + q + 0.44)} ${run.y + q + 0.5}h${trim(run.length - 0.88)}`)
      .join("");
    parts.push(
      `<path fill="none" stroke="${escapeXml(dark)}" stroke-width="0.88" stroke-linecap="round" d="${d}"/>`,
    );
  }

  if (mark) {
    const scale = mark.crown.width / CROWN_BOX.width;
    const tx = mark.crown.x + q - CROWN_BOX.x * scale;
    const ty = mark.crown.y + q - CROWN_BOX.y * scale;
    parts.push(
      `<path data-mark="crown" fill="${escapeXml(options.markColor ?? dark)}" transform="translate(${trim(tx)} ${trim(ty)}) scale(${trim(scale)})" d="${CROWN_PATH}"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

/** The svg as a data URL, for an img tag or a download link. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
