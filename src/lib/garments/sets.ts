import { getTemplate } from "./panels.ts";
import type { Colorway } from "./types.ts";

export type SetPiece = {
  provider: string;
  templateId: string;
  colorways: Colorway[];
};

export function colorwaySignature(colorways: Colorway[]): string {
  return colorways
    .map(
      (item) =>
        `${item.name}|${item.colors.body}|${item.colors.contrast}|${item.colors.trim}|${item.colors.mark}`,
    )
    .join("\n");
}

/** A set is two different garments, one maker, and the same colorways. */
export function assessSet(
  pieces: SetPiece[],
): { ok: true; provider: string; colorways: Colorway[] } | { ok: false; reason: string } {
  if (pieces.length < 2) return { ok: false, reason: "A set needs at least two pieces." };
  const provider = pieces[0]?.provider ?? "";
  if (!provider || pieces.some((piece) => piece.provider !== provider)) {
    return { ok: false, reason: "Every piece in a set has to come from the same maker." };
  }
  const templates = new Set(pieces.map((piece) => piece.templateId));
  if (templates.size < 2) {
    return { ok: false, reason: "A set pairs different garments, like a hoodie and joggers." };
  }
  if (pieces.some((piece) => !getTemplate(piece.templateId))) {
    return { ok: false, reason: "Sets are for all-over garments." };
  }
  const first = pieces[0]?.colorways ?? [];
  if (first.length === 0) return { ok: false, reason: "Add a colorway before you make a set." };
  const signature = colorwaySignature(first);
  if (pieces.some((piece) => colorwaySignature(piece.colorways) !== signature)) {
    return { ok: false, reason: "The pieces need the same colorways." };
  }
  return { ok: true, provider, colorways: first };
}
