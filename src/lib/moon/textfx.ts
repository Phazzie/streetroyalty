/**
 * Text power for the studio: curved text geometry, outline, tracking, and
 * display presets. Geometry is pure so the editor preview, the print file,
 * and the tests all use the same math.
 */

export type TextFx = {
  /** Arc bend in degrees across the whole line. Negative arcs smile, positive frown. */
  arc: number;
  outline: boolean;
  /** Letter spacing as a fraction of font size (0.1 = airy, -0.02 = tight). */
  tracking: number;
};

export const FLAT_TEXT: TextFx = { arc: 0, outline: false, tracking: 0 };

export const TEXT_PRESETS: { name: string; fx: TextFx; note: string }[] = [
  { name: "Block party", fx: { arc: 0, outline: false, tracking: 0.02 }, note: "Flat, loud, centered." },
  { name: "Archbishop", fx: { arc: -38, outline: false, tracking: 0.06 }, note: "Classic arch over the chest." },
  { name: "Undertow", fx: { arc: 34, outline: false, tracking: 0.04 }, note: "Smiles up from the hem." },
  { name: "Hollow crown", fx: { arc: -18, outline: true, tracking: 0.1 }, note: "Outline only. All frame, no fill." },
  { name: "Marquee", fx: { arc: 0, outline: true, tracking: 0.22 }, note: "Spaced out like a theater sign." },
  { name: "Tight corner", fx: { arc: 0, outline: false, tracking: -0.02 }, note: "Packed shoulder to shoulder." },
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

export type CharCell = {
  char: string;
  /** Offset along the line from center, in font-size units. */
  along: number;
  /** Rotation for this character, degrees. */
  rotate: number;
  /** Vertical lift from the baseline curve, in font-size units (up is negative). */
  lift: number;
};

/**
 * Lay a line of text along an arc. The arc's total bend is spread evenly;
 * each character sits on a circle whose radius comes from the bend and the
 * line's width, so short lines curve gently and long lines stay readable.
 * A flat arc returns one cell per character with no rotation or lift.
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
  // Radius (in font-size units) for a chord of `width` subtending `bend`.
  const radius = width / (2 * Math.sin(Math.abs(bend) / 2));
  const perChar = bend / chars.length;
  return chars.map((char, index) => {
    const offset = index - center;
    const angle = offset * perChar;
    return {
      char,
      along: Math.sin(angle) * radius,
      // CSS rotation is clockwise-positive: on an arch (negative bend) the
      // right-hand characters tip clockwise, on a smile they tip back.
      rotate: -(angle * 180) / Math.PI,
      // Positive lift pushes a character down. Arch: edges drop. Smile: edges rise.
      lift: -(1 - Math.cos(angle)) * radius * Math.sign(bend),
    };
  });
}

/** CSS for an outlined text layer (fill knocked out, stroke carries it). */
export function outlineStyle(color: string): { WebkitTextStroke: string; color: string } {
  return { WebkitTextStroke: `2px ${color}`, color: "transparent" };
}
