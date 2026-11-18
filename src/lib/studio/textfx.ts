/**
 * Curved text for the studio. Geometry is pure so the editor preview, the
 * print file, and the tests all use the same math. Ported from the
 * moon/next-level text tool; flat text (no arc, no outline, no tracking)
 * stays on the old single-line path.
 */

export type TextFx = {
  /** Arc bend in degrees across the whole line. Negative arches, positive smiles. */
  arc: number;
  outline: boolean;
  /** Letter spacing as a fraction of font size. */
  tracking: number;
};

export const FLAT_TEXT: TextFx = { arc: 0, outline: false, tracking: 0 };

/**
 * One set of rules for how a text layer sits in the print area, shared by the print
 * file, the mockup and the print check so the three agree.
 */
/** Font size as a share of the print area's height, at scale 1. */
export const TEXT_EM = 0.14;
/** The widest a line may print, as a share of the print area's width. Wider lines shrink to fit. */
export const LINE_FIT = 0.92;
/** Outline thickness as a share of the font size. The studio preview uses the same share. */
export const OUTLINE_EM = 0.08;

export const TEXT_PRESETS: { name: string; fx: TextFx; note: string }[] = [
  {
    name: "Block party",
    fx: { arc: 0, outline: false, tracking: 0.02 },
    note: "Flat, loud, centered.",
  },
  {
    name: "Archbishop",
    fx: { arc: -38, outline: false, tracking: 0.06 },
    note: "Classic arch over the chest.",
  },
  {
    name: "Undertow",
    fx: { arc: 34, outline: false, tracking: 0.04 },
    note: "Smiles up from the hem.",
  },
  { name: "Hollow crown", fx: { arc: -18, outline: true, tracking: 0.1 }, note: "Outline only." },
  {
    name: "Marquee",
    fx: { arc: 0, outline: true, tracking: 0.22 },
    note: "Spaced out like a theater sign.",
  },
  {
    name: "Tight corner",
    fx: { arc: 0, outline: false, tracking: -0.02 },
    note: "Packed shoulder to shoulder.",
  },
];

export function clampFx(input: Partial<TextFx> | undefined): TextFx {
  const arc = Number(input?.arc ?? 0);
  const tracking = Number(input?.tracking ?? 0);
  return {
    arc: Number.isFinite(arc) ? Math.min(120, Math.max(-120, arc)) : 0,
    outline: Boolean(input?.outline),
    tracking: Number.isFinite(tracking) ? Math.min(0.6, Math.max(-0.05, tracking)) : 0,
  };
}

export function isFlatText(fx: TextFx): boolean {
  return fx.arc === 0 && !fx.outline && fx.tracking === 0;
}

export type CharCell = {
  char: string;
  /** Offset along the line from center, in font-size units. */
  along: number;
  /** Rotation for this character, degrees. */
  rotate: number;
  /** Vertical lift from the baseline curve, in font-size units (down is positive). */
  lift: number;
};

/**
 * Lay a line of text along an arc. The bend is spread across the line;
 * each character sits on a circle whose radius comes from the bend and the
 * line's width. A flat arc returns one cell per character with no rotation.
 */
export function arcLayout(text: string, fx: TextFx): CharCell[] {
  const chars = [...text];
  if (chars.length === 0) return [];
  const step = 0.62 + Math.max(0, fx.tracking);
  const width = chars.length * step;
  const center = (chars.length - 1) / 2;
  const bend = (fx.arc * Math.PI) / 180;
  if (Math.abs(bend) < 0.001 || chars.length === 1) {
    return chars.map((char, index) => ({
      char,
      along: (index - center) * step,
      rotate: 0,
      lift: 0,
    }));
  }
  const radius = width / (2 * Math.sin(Math.abs(bend) / 2));
  const perChar = bend / chars.length;
  return chars.map((char, index) => {
    const offset = index - center;
    const angle = offset * perChar;
    return {
      char,
      // Left to right whichever way the line bends. Taking the sign from the bend put
      // an arch's first letter on the right, so arched words read backwards.
      along: Math.sin(offset * Math.abs(perChar)) * radius,
      rotate: -(angle * 180) / Math.PI,
      lift: -(1 - Math.cos(angle)) * radius * Math.sign(bend),
    };
  });
}

/**
 * How wide a line sets, in ems, without a font to measure. Used where nothing can
 * measure type (the mockup picture, the print check), so they agree with each other.
 */
export function textWidthEm(text: string, font: string): number {
  let ems = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === " ") ems += 0.3;
    else if ("iIl1.,:;'!|".includes(char)) ems += 0.36;
    else if ("MWmw@".includes(char)) ems += 0.92;
    else if (code >= 0x2e80) ems += 1;
    else if (char >= "A" && char <= "Z") ems += 0.74;
    else if (char >= "a" && char <= "z") ems += 0.63;
    else if (char >= "0" && char <= "9") ems += 0.66;
    else ems += 0.6;
  }
  return ems * (font === "Outfit" ? 0.8 : 1);
}

/** How far a laid-out line reaches, in ems: from the left edge of its first letter to the right edge of its last. */
export function lineSpanEm(cells: CharCell[]): number {
  if (cells.length === 0) return 0;
  const alongs = cells.map((cell) => cell.along);
  return Math.max(...alongs) - Math.min(...alongs) + 1;
}

/** How tall a laid-out line stands, in ems, counting how far a curve lifts its ends. */
export function lineRiseEm(cells: CharCell[]): number {
  if (cells.length === 0) return 0;
  const lifts = cells.map((cell) => cell.lift);
  return Math.max(0, ...lifts) - Math.min(0, ...lifts) + 1.2;
}

/** The font size that keeps a line of the given width (in ems) inside maxWidth. Never larger than asked. */
export function fitFontSize(size: number, spanEm: number, maxWidth: number): number {
  if (!(spanEm > 0) || !(size > 0)) return size;
  return Math.min(size, maxWidth / spanEm);
}

/** CSS for an outlined text layer (fill knocked out, stroke carries it). */
export function outlineStyle(color: string): { WebkitTextStroke: string; color: string } {
  return { WebkitTextStroke: `${OUTLINE_EM}em ${color}`, color: "transparent" };
}
