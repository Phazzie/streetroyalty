import type { Category, Reaction } from "@/lib/types";

export const LOCK_LINE =
  "Keep the person's face, hair, body proportions, and lighting identical to the character references. Apply only the clothing described. Do not alter identity.";

function quote(value: string): string {
  return value.replaceAll('"', "'").replace(/\s+/g, " ").trim();
}

export function piecePrompt(spoken: string, category: Category): string {
  return [
    `Isolated product photograph of one ${category.toLowerCase()} item alone on a plain light gray seamless background.`,
    "Whole item in frame, realistic fabric, true color, sharp detail, studio light.",
    `Exact item, unchanged: "${quote(spoken)}".`,
  ].join(" ");
}

export function lookPrompt(
  spoken: string,
  characterCount: number,
  totalImages: number,
): string {
  const clothing = Math.max(0, totalImages - characterCount);
  const who =
    characterCount <= 0
      ? "The reference images are the clothes."
      : characterCount >= totalImages
        ? "The reference images are the same person."
        : characterCount === 1
          ? "The first image is the person. The remaining images are the exact clothes."
          : `The first ${characterCount} images are the person. The remaining images are the exact clothes.`;
  return [
    LOCK_LINE,
    "Full-body fashion photograph, head to shoes, standing, simple dark studio, realistic, no text.",
    who,
    clothing > 0
      ? "Match the clothing references for fabric, cut, hardware, color, and fit."
      : "Match the clothing exactly as described.",
    `Dress them in exactly this: "${quote(spoken)}".`,
  ].join(" ");
}

export function tweakPrompt(baseSpoken: string, change: string): string {
  return [
    LOCK_LINE,
    "The first image is the current photograph. Any later images are the same person. Keep the face.",
    "Full-body fashion photograph, head to shoes, standing, simple dark studio, realistic, no text.",
    `Already dressed in: "${quote(baseSpoken)}".`,
    `Change only this: "${quote(change)}".`,
  ].join(" ");
}

const CROWD: Record<Reaction, string> = {
  cheer: "Judges cheer, loud, on their feet.",
  boo: "Judges boo, loud and messy.",
  both: "Judges split. Some cheer, some boo. Both are loud.",
};

export function videoPrompt(reaction: Reaction, spoken: string, hasFace: boolean): string {
  const outfit = quote(spoken);
  const outfitLine = outfit ? ` Outfit, exact: "${outfit}".` : "";
  const crowd = CROWD[reaction];
  if (hasFace) {
    return `Use the first image as the person and the outfit. Use the second image as the face lock. The same person walks a short dark runway toward the camera, steady stride, one spotlight.${outfitLine} ${crowd} Realistic live action, no on-screen text.`;
  }
  return `The person in the still walks a short dark runway toward the camera, same face, same outfit, steady stride, one spotlight.${outfitLine} ${crowd} Realistic live action, no on-screen text.`;
}
