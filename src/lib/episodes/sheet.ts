import type { DesignSummary } from "../studio/models.ts";
import type { StoreProduct } from "../storefront/types.ts";
import { refKey, type WardrobeRef } from "./types.ts";

/**
 * The wardrobe sheet: words that keep one outfit identical from shot to shot in an
 * AI video tool. Everything here is pure, so the same pieces always give the same
 * sheet. It only states what the site has on record for a piece. Where the record
 * stops (the artwork on a rack piece, the exact shade of a trim) it says so and
 * points at the picture instead.
 */

export type SheetPiece = {
  ref: WardrobeRef;
  source: "shop" | "rack";
  name: string;
  /** Lower case garment word: hoodie, jogger, tee. */
  garment: string;
  baseColor: { name: string; hex?: string } | null;
  /** Where the print sits, when the record says. */
  print: string | null;
  panels: string | null;
  piping: string | null;
  /** The label's own line about the piece, quoted as is. */
  quote: string | null;
  imageUrl: string | null;
  /** Path on this site where the piece can be bought. */
  href: string;
};

/**
 * What is on record about how the label's two sets are built (PRODUCT.md, Brand
 * Commitments, and the drop's own descriptions). Trim colours have names but no
 * hex on record, so none is given.
 */
const KNOWN_BUILD: Record<string, { color: string; panels: string; piping: string }> = {
  "lilac-set-hoodie": {
    color: "lilac",
    panels: "Cream panels down both sleeves and both sides",
    piping: "Thin orange piping outlines every panel",
  },
  "lilac-set-jogger": {
    color: "lilac",
    panels: "A cream stripe down the full outer leg, both legs, into a ribbed cuff",
    piping: "Thin orange piping runs along each stripe",
  },
  "mint-set-hoodie": {
    color: "mint",
    panels: "A peach lined hood and a peach stripe down each sleeve",
    piping: "Thin blue piping edges each stripe",
  },
  "mint-set-jogger": {
    color: "mint",
    panels: "A peach stripe down the full outer leg, both legs, into a ribbed cuff",
    piping: "Thin blue piping runs along each stripe",
  },
};

const HEX = /^#[0-9a-f]{6}$/i;

function cleanHex(value: string | undefined | null): string | undefined {
  const hex = String(value ?? "").trim();
  return HEX.test(hex) ? hex.toLowerCase() : undefined;
}

function words(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Names, colours and blurbs come from the shop and from what makers typed. They end
 * up inside a block that gets pasted into another tool, so each is kept to one line
 * and a sane length. A title cannot add lines to the block or bury the rest of it.
 */
function oneLine(value: string | null | undefined, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

const MAX_PIECE_NAME = 80;
const MAX_COLOR_NAME = 40;
const MAX_GARMENT = 60;
const MAX_QUOTE = 200;

export function sheetPieceFromProduct(product: StoreProduct): SheetPiece {
  const color = product.colors[0];
  const known = KNOWN_BUILD[product.slug];
  const matches = Boolean(known && color && color.name.toLowerCase().includes(known.color));
  return {
    ref: { kind: "shop", slug: product.slug },
    source: "shop",
    name: oneLine(product.name, MAX_PIECE_NAME) || "Untitled piece",
    garment: oneLine(words(product.kind), MAX_GARMENT).toLowerCase() || "piece",
    baseColor:
      color && oneLine(color.name, MAX_COLOR_NAME)
        ? { name: oneLine(color.name, MAX_COLOR_NAME), hex: cleanHex(color.swatch) }
        : null,
    print: null,
    panels: matches && known ? known.panels : null,
    piping: matches && known ? known.piping : null,
    quote: oneLine(product.blurb, MAX_QUOTE) || null,
    imageUrl: product.images[0]?.url ?? null,
    href: `/shop/${product.slug}`,
  };
}

type RackFields = Pick<
  DesignSummary,
  "slug" | "title" | "productName" | "productType" | "colorName" | "colorHex" | "placement"
> & { mockupUrl: string | null };

export function sheetPieceFromDesign(design: RackFields): SheetPiece {
  const type = oneLine(words(design.productType), MAX_GARMENT).toLowerCase();
  const blank = oneLine(design.productName, MAX_GARMENT);
  const colorName = oneLine(design.colorName, MAX_COLOR_NAME);
  return {
    ref: { kind: "rack", slug: design.slug },
    source: "rack",
    name: oneLine(design.title, MAX_PIECE_NAME) || blank || "Untitled piece",
    garment:
      blank && type && !blank.toLowerCase().includes(type)
        ? `${blank} (${type})`
        : blank || type || "piece",
    baseColor: colorName ? { name: colorName, hex: cleanHex(design.colorHex) } : null,
    print: oneLine(words(design.placement), MAX_COLOR_NAME).toLowerCase() || null,
    panels: null,
    piping: null,
    quote: null,
    imageUrl: design.mockupUrl,
    href: `/rack/${design.slug}`,
  };
}

export type MissingPiece = { ref: WardrobeRef; missing: true };

/** Looks each ref up in what the site has right now. A piece that is gone stays in the list, marked missing. */
export function resolveRefs(
  refs: WardrobeRef[],
  have: { products: StoreProduct[]; rack: RackFields[] },
): (SheetPiece | MissingPiece)[] {
  return refs.map((ref) => {
    if (ref.kind === "shop") {
      const product = have.products.find((item) => item.slug === ref.slug);
      return product ? sheetPieceFromProduct(product) : { ref, missing: true };
    }
    const design = have.rack.find((item) => item.slug === ref.slug);
    return design ? sheetPieceFromDesign(design) : { ref, missing: true };
  });
}

export function isMissing(piece: SheetPiece | MissingPiece): piece is MissingPiece {
  return "missing" in piece;
}

function colorPhrase(color: { name: string; hex?: string }): string {
  return color.hex ? `${color.name} (${color.hex})` : color.name;
}

function sentence(value: string): string {
  const text = value.trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** One piece in plain English, as precise as the record allows and no further. */
export function describePiece(piece: SheetPiece): string {
  const parts: string[] = [`${piece.name}, a ${piece.garment}.`];
  parts.push(
    piece.baseColor
      ? `Base colour: ${colorPhrase(piece.baseColor)}.`
      : "Base colour: as in the reference picture.",
  );
  if (piece.panels) parts.push(sentence(piece.panels));
  if (piece.piping) parts.push(sentence(piece.piping));
  if (piece.source === "rack") {
    parts.push(
      piece.print
        ? `Custom print on the ${piece.print}. Copy the print from the reference picture exactly: same artwork, same words, same size, same place.`
        : "Custom print. Copy it from the reference picture exactly.",
    );
  } else if (!piece.panels && !piece.piping) {
    parts.push("Any logo, stitching or trim: exactly as in the reference picture.");
  }
  if (piece.quote) parts.push(`In the label's words: "${piece.quote.replace(/"/g, "'")}"`);
  // Colours measured from the picture stay on the board. In the words they would put a
  // second, shaded hex next to the one on record and invite the drift this is here to stop.
  return parts.join(" ");
}

export type WardrobeSheet = {
  character: string;
  /** The wardrobe block: one numbered line per piece. */
  block: string;
  continuity: string;
  checklist: string[];
  /** Block, continuity and checklist in one text, ready to paste. */
  text: string;
};

/** A list in a sentence. A name with a comma in it ("Crown Tee, Cream") switches the list to semicolons. */
export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const commas = items.some((item) => item.includes(","));
  if (items.length === 2 && !commas) return `${items[0]} and ${items[1]}`;
  const joiner = commas ? "; " : ", ";
  const and = commas ? "; and " : " and ";
  return `${items.slice(0, -1).join(joiner)}${and}${items[items.length - 1]}`;
}

export function characterName(raw: string): string {
  return oneLine(raw, 40) || "The character";
}

export function buildWardrobeSheet(input: {
  character: string;
  pieces: SheetPiece[];
}): WardrobeSheet {
  const who = characterName(input.character);
  const seen = new Set<string>();
  const pieces = input.pieces.filter((piece) => {
    const key = refKey(piece.ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (pieces.length === 0) {
    return { character: who, block: "", continuity: "", checklist: [], text: "" };
  }

  const count = pieces.length === 1 ? "one piece" : `${pieces.length} pieces`;
  const block = [
    `WARDROBE: ${who.toUpperCase()}`,
    `${who} wears ${count}. The same ${pieces.length === 1 ? "one" : pieces.length} in every shot.`,
    "",
    ...pieces.map((piece, index) => `${index + 1}. ${describePiece(piece)}`),
  ].join("\n");

  const named = list(pieces.map((piece) => piece.name));
  const colors = pieces
    .filter((piece) => piece.baseColor)
    .map((piece) => `${piece.name} stays ${colorPhrase(piece.baseColor as { name: string })}`);
  const trims = pieces.some((piece) => piece.panels || piece.piping);
  const prints = pieces.some((piece) => piece.source === "rack");
  const continuity = [
    `CONTINUITY`,
    [
      `${who} wears exactly this outfit in every shot: ${named}.`,
      "Nothing is added, removed or swapped unless the scene says so.",
      colors.length > 0 ? `No colour drift: ${list(colors)}.` : "No colour drift between shots.",
      "Lighting may change how a colour reads. The garment itself does not change colour.",
      trims
        ? "Panels, stripes and piping stay the same width, in the same place, on both sides."
        : "",
      prints
        ? "Prints stay the same artwork, the same size and the same place, and are never mirrored or redrawn."
        : "",
      "No logo changes: no new logos, words, labels or brand marks, and none taken away.",
      "Same fit in every shot: the same sleeve length, hem, rise and looseness. Do not tighten, crop or lengthen anything.",
      "Match the attached reference board. If the words and the board disagree, the board wins.",
    ]
      .filter(Boolean)
      .join(" "),
  ].join("\n");

  const checklist: string[] = [
    "The reference board is attached to this shot.",
    "The wardrobe block is pasted in, word for word.",
  ];
  for (const piece of pieces) {
    checklist.push(
      piece.baseColor
        ? `${piece.name} is on screen and still ${colorPhrase(piece.baseColor)}.`
        : `${piece.name} is on screen and matches its picture.`,
    );
    if (piece.panels || piece.piping) {
      checklist.push(
        `${piece.name}: panels and piping are where the board shows them, both sides.`,
      );
    }
    if (piece.source === "rack") {
      checklist.push(
        `${piece.name}: the print is ${piece.print ? `on the ${piece.print}` : "in place"}, readable, not mirrored, not redrawn.`,
      );
    }
  }
  checklist.push(
    "No new logos, words or brand marks anywhere on the clothes.",
    "Same fit as the last shot: sleeves, hem, hood up or down.",
    "Checked against the shot before and the shot after.",
  );

  const text = [
    block,
    "",
    continuity,
    "",
    "CHECK EVERY SHOT",
    ...checklist.map((item) => `[ ] ${item}`),
  ].join("\n");

  return { character: who, block, continuity, checklist, text };
}
