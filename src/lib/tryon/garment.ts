/**
 * What a piece is, how it is worn and where its print sits, in words the picture maker
 * reads. Pure, and shared by the studio's "On a person" and the rack's fitting room, so a
 * paid picture is never spent on the wrong garment.
 */
import { colorName } from "../say/colors.ts";
import { resolveGarment, type GarmentDesign, type Paint } from "../studio/garments.ts";

export type Wear = "top" | "legs" | "head" | "carried" | "unknown";

export type PieceKind = {
  /** The garment's name, never "t-shirt" unless it is one. */
  noun: string;
  /** Said as a pair, so it takes no "a". */
  plural: boolean;
  wear: Wear;
  /** Long sleeves carry a print down the arm, not a patch on it. */
  longSleeve: boolean;
};

function kind(noun: string, wear: Wear, extra: Partial<PieceKind> = {}): PieceKind {
  return { noun, plural: false, wear, longSleeve: false, ...extra };
}

/** Reads a product type the way the catalogs write it: "T-Shirt", "Joggers", "Tote", "Long-Sleeve". */
function kindFromWords(words: string): PieceKind | null {
  const text = words.toLowerCase();
  if (/\btote|\bbag\b/.test(text)) return kind("canvas tote bag", "carried");
  if (/beanie/.test(text)) return kind("beanie", "head");
  if (/\bhat\b|\bcap\b|snapback|trucker/.test(text)) return kind("cap", "head");
  if (/jogger|sweatpant|track ?pant/.test(text)) return kind("joggers", "legs", { plural: true });
  if (/shorts/.test(text)) return kind("shorts", "legs", { plural: true });
  if (/legging/.test(text)) return kind("leggings", "legs", { plural: true });
  if (/\bpants\b|trouser/.test(text)) return kind("trousers", "legs", { plural: true });
  if (/jacket|windbreaker|bomber/.test(text)) {
    return kind(/track/.test(text) ? "zip-up track jacket" : "jacket", "top", { longSleeve: true });
  }
  if (/hood/.test(text)) {
    return kind(/zip/.test(text) ? "zip-up hoodie" : "pullover hoodie", "top", {
      longSleeve: true,
    });
  }
  if (/long[ -]?sleeve/.test(text)) return kind("long-sleeve top", "top", { longSleeve: true });
  // Before the tee: "sweatshirt" ends in the letters of "tshirt".
  if (/crew|sweat/.test(text)) return kind("crewneck sweatshirt", "top", { longSleeve: true });
  if (/t-?shirt|\btee\b/.test(text)) return kind("t-shirt", "top");
  return null;
}

/** The type decides. The product's name only helps when the type is unknown, or to tell a track jacket. */
export function pieceKind(productType: string, productName = ""): PieceKind {
  const fromType = kindFromWords(productType);
  if (fromType?.noun === "jacket" && /track/i.test(productName)) {
    return { ...fromType, noun: "zip-up track jacket" };
  }
  return fromType ?? kindFromWords(productName) ?? kind("piece", "unknown");
}

/** A word from a catalog or a maker, cut down to plain lowercase so it cannot steer the prompt. */
export function plain(value: string, fallback: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9 /&-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean || fallback;
}

/** Where the print sits on the body, said the way a person would point at it. */
export function printSpot(piece: PieceKind, placement: string): string {
  const spot = plain(placement.replaceAll("_", " "), "front");
  const side = /left/.test(spot) ? "left" : /right/.test(spot) ? "right" : "";
  if (piece.wear === "legs") {
    if (spot === "front") return "on the front of the upper thigh";
    if (spot === "back") return "across the back, just under the waistband";
    return `on the ${spot}`;
  }
  if (piece.wear === "head") return spot === "front" ? "on the front panel" : `on the ${spot}`;
  if (piece.wear === "carried") {
    if (spot === "front" || spot === "back") return `on the ${spot} of the bag`;
    return `on the ${spot}`;
  }
  if (piece.wear === "top") {
    if (spot === "front") return "on the front";
    if (spot === "back") return "across the back";
    if (/sleeve/.test(spot) && side) {
      return piece.longSleeve ? `down the ${side} sleeve` : `on the ${side} sleeve`;
    }
  }
  return `on the ${spot}`;
}

/** The rest of the outfit: plain, so the piece is the only thing that speaks. */
export function outfitRest(piece: PieceKind): string {
  if (piece.wear === "legs") return "a plain black top and white sneakers";
  if (piece.wear === "head" || piece.wear === "carried") {
    return "a plain black top, plain black trousers and white sneakers";
  }
  if (piece.wear === "unknown") return "the rest of the outfit plain black, white sneakers";
  return "plain black trousers and white sneakers";
}

/** "a black t-shirt", "black joggers", "a canvas tote bag": a colour and a noun with the right article. */
export function named(piece: PieceKind, tone: string): string {
  const words = tone ? `${tone} ${piece.noun}` : piece.noun;
  if (piece.plural) return words;
  return /^[aeiou]/.test(words) ? `an ${words}` : `a ${words}`;
}

export function howWorn(piece: PieceKind): string {
  if (piece.wear === "legs") return " worn on the legs";
  if (piece.wear === "carried") return " carried on the shoulder";
  if (piece.wear === "head") return " worn on the head";
  return "";
}

/**
 * The studio's words for a placement piece, read beside a picture of the print on the
 * garment's colour.
 */
export function placementWords(input: {
  productType: string;
  productName?: string;
  colorName: string;
  placement: string;
}): string {
  const piece = pieceKind(input.productType, input.productName);
  const tone = plain(input.colorName, "black");
  const spot = printSpot(piece, input.placement);
  const rest = outfitRest(piece);
  if (piece.wear === "unknown") {
    return `the exact ${tone} piece from the clothing reference, worn or carried the way it is made to be, with the same graphic ${spot}, ${rest}`;
  }
  return `${named(piece, tone)}${howWorn(piece)}, printed with the exact graphic from the clothing reference ${spot}, same colours, same size and same placement, ${rest}`;
}

function paintWords(paint: Paint): string {
  if (paint.type === "solid") return colorName(paint.hex);
  if (paint.type === "pattern") {
    const pattern = paint.pattern === "checker" ? "check" : "stripe";
    return `${colorName(paint.hex)} and ${colorName(paint.accent)} ${pattern}`;
  }
  return "printed art";
}

/** "Left sleeve" and "Right sleeve" are the sleeves; "Body front" and "Body back" are the body. */
function panelNouns(title: string): string[] {
  const lower = title.toLowerCase();
  if (/^body (front|back)$/.test(lower)) return ["body"];
  // "Seat and back" is two places, said apart so the list still reads.
  if (lower.includes(" and ")) return lower.split(" and ");
  const pair = /^(left|right) (.+)$/.exec(lower);
  if (!pair) return [lower];
  const noun = pair[2] ?? lower;
  return [/(s|ing)$/.test(noun) ? noun : `${noun}s`];
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Every panel of an all-over piece in the colours of its active colourway, front and back,
 * grouped by colour: "lavender hood, sleeves and body; bone side panels and pocket".
 */
export function panelColorWords(garment: GarmentDesign): string {
  const groups = new Map<string, string[]>();
  for (const face of ["front", "back"] as const) {
    for (const { panel, paint } of resolveGarment(garment, face).panels) {
      const colour = paintWords(paint);
      const nouns = groups.get(colour) ?? [];
      for (const noun of panelNouns(panel.title)) if (!nouns.includes(noun)) nouns.push(noun);
      groups.set(colour, nouns);
    }
  }
  return [...groups.entries()].map(([colour, nouns]) => `${colour} ${list(nouns)}`).join("; ");
}

/** The studio's words for an all-over piece, read beside a picture of the whole garment. */
export function allOverWords(input: {
  productType: string;
  productName?: string;
  garment: GarmentDesign;
}): string {
  const piece = pieceKind(input.productType, input.productName);
  const noun = piece.wear === "unknown" ? "garment" : piece.noun;
  const what = named({ ...piece, noun: `all-over printed ${noun}` }, "");
  const rest = outfitRest(piece);
  return `${what}${howWorn(piece)}, made exactly like the clothing reference, which shows its front and back: ${panelColorWords(input.garment)}. Same panels, same colours, same small logo in the same spot, ${rest}`;
}
