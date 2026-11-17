import { crownCut } from "@/components/makers/crown-cut";
import type { RackPiece } from "@/lib/social/types";

/**
 * Lime means "tap this" and nothing else, so it never goes on an awning, even for a
 * maker who prints in it. Their pieces still show it; the stripes skip it.
 */
export function isLime(hex: string): boolean {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [red, green, blue] = match.slice(1).map((part) => parseInt(part, 16) / 255);
  if (red == null || green == null || blue == null) return false;
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  const spread = high - low;
  if (spread === 0) return false;
  const light = (high + low) / 2;
  const saturation = spread / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (high === red) hue = ((green - blue) / spread) % 6;
  else if (high === green) hue = (blue - red) / spread + 2;
  else hue = (red - green) / spread + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 60 && hue <= 100 && saturation >= 0.6 && light >= 0.4 && light <= 0.85;
}

/**
 * The colours this maker actually prints with, most used first, as awning stripes.
 * A maker with nothing on the rack yet gets the colour of their crown card and ink.
 */
export function awningColors(pieces: RackPiece[], handle = ""): string[] {
  const counts = new Map<string, number>();
  for (const piece of pieces)
    for (const color of piece.palette)
      if (!isLime(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  const colors = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([color]) => color)
    .slice(0, 5);
  for (const spare of [crownCut(handle).card, "#14081c", "#f5ebdd"]) {
    if (colors.length >= 2) break;
    if (!colors.includes(spare)) colors.push(spare);
  }
  return colors;
}
