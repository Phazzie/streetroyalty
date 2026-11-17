import { crownCut } from "@/components/makers/crown-cut";
import type { RackPiece } from "@/lib/social/types";

/**
 * The colours this maker actually prints with, most used first, as awning stripes.
 * A maker with nothing on the rack yet gets the colour of their crown card and ink.
 */
export function awningColors(pieces: RackPiece[], handle = ""): string[] {
  const counts = new Map<string, number>();
  for (const piece of pieces)
    for (const color of piece.palette) counts.set(color, (counts.get(color) ?? 0) + 1);
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
