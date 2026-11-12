function channel(value: number): number {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const raw = hex.replace("#", "");
    const red = channel(Number.parseInt(raw.slice(0, 2), 16));
    const green = channel(Number.parseInt(raw.slice(2, 4), 16));
    const blue = channel(Number.parseInt(raw.slice(4, 6), 16));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Pairs that must stay at WCAG AA for body text. Hex values match src/styles.css. */
export const THEME_PAIRS = [
  ["#f6f1ff", "#161022"],
  ["#d5cbe8", "#161022"],
  ["#b7a8d4", "#161022"],
  ["#d6ff3c", "#14081c"],
  ["#ff2d95", "#14081c"],
  ["#3d7eff", "#14081c"],
  ["#ff6a00", "#14081c"],
  ["#c084fc", "#14081c"],
  ["#ff2d95", "#0b0614"],
  ["#d5cbe8", "#3a2d52"],
] as const;
