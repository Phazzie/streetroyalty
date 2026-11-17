/** Fit a spoken intent onto a blank the catalog really has. Pure. */
import type { CatalogProduct, DesignLayer } from "../pod/types.ts";
import { MAX_LAYERS, STUDIO_FONTS } from "../studio/validate.ts";
import { colorDistance, contrastInk, mix, nearestColor } from "./colors.ts";
import type { SayBlank, SayIntent, SayLine, SaySize } from "./parse.ts";

export type SayFit = {
  productId: string;
  productName: string;
  variantId: string;
  colorName: string;
  colorHex: string;
  placement: string;
  placementTitle: string;
  layers: DesignLayer[];
  /** Plain sentences about anything that could not be matched exactly. */
  notes: string[];
  title: string;
};

const TYPE_MATCH: Record<SayBlank, RegExp> = {
  tee: /t-?shirt|\btee\b/i,
  hoodie: /hood/i,
  crewneck: /crew|sweatshirt|sweater/i,
  hat: /\bhat\b|\bcap\b|beanie/i,
};

const BLANK_WORD: Record<SayBlank, string> = {
  tee: "tee",
  hoodie: "hoodie",
  crewneck: "crewneck",
  hat: "hat",
};

/** A colour this close is the colour they asked for. */
const SAME_COLOR = 9;

export const LINE_SCALE: Record<SaySize, number> = {
  small: 0.45,
  medium: 0.75,
  big: 1.15,
  huge: 1.8,
};

/** What the catalog list says about a blank. The full blank, with its variants, is loaded after the pick. */
export type ListedBlank = { id: string; name: string; type: string; discontinued?: boolean };

function matches(product: ListedBlank, blank: SayBlank): boolean {
  const label = `${product.type} ${product.name}`;
  if (blank === "crewneck" && TYPE_MATCH.hoodie.test(label)) return false;
  return TYPE_MATCH[blank].test(label);
}

/** The catalog blank for the garment they named, or null when the catalog has none. */
export function pickProduct<T extends ListedBlank>(
  blank: SayBlank,
  catalog: readonly T[],
): T | null {
  const live = catalog.filter((product) => !product.discontinued);
  return live.find((product) => matches(product, blank)) ?? null;
}

function pickPlacement(
  intent: SayIntent,
  product: CatalogProduct,
): { placement: string; title: string; note: string | null } {
  const wanted = intent.placement;
  const hit = product.placements.find((item) =>
    wanted === "sleeve" ? /sleeve/i.test(item.placement) : item.placement === wanted,
  );
  if (hit) {
    return {
      placement: hit.placement,
      title: wanted === "sleeve" ? "Sleeve" : hit.title,
      note: null,
    };
  }
  const fallback =
    product.placements.find((item) => item.placement === "front") ?? product.placements[0];
  const where = [...new Set(product.placements.map((item) => item.title.toLowerCase()))];
  const list =
    where.length > 1 ? `${where.slice(0, -1).join(", ")} or ${where[where.length - 1]}` : where[0];
  return {
    placement: fallback?.placement ?? "front",
    title: fallback?.title ?? "Front",
    note: `This blank does not print on the ${wanted}. It prints on the ${list ?? "front"}, so it went on the ${(fallback?.title ?? "front").toLowerCase()}.`,
  };
}

function font(intent: SayIntent): string {
  return STUDIO_FONTS.includes(intent.font as (typeof STUDIO_FONTS)[number])
    ? intent.font
    : "Archivo Black";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Stack the lines down the middle of the print area. */
export function buildLayers(intent: SayIntent): DesignLayer[] {
  const lines = intent.lines.slice(0, MAX_LAYERS);
  const face = font(intent);
  const scales = lines.map((line) => LINE_SCALE[line.size]);
  // Each line takes room in proportion to its size, and the stack never leaves the print area.
  const weights = scales.map((scale) => 0.1 + scale * 0.12);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const squeeze = total > 0.84 ? 0.84 / total : 1;
  let cursor = 0.48 - (total * squeeze) / 2;
  return lines.map((line, index) => {
    const room = (weights[index] ?? 0.2) * squeeze;
    const y = cursor + room / 2;
    cursor += room;
    return {
      id: `say-${index + 1}`,
      type: "text" as const,
      text: line.text.slice(0, 80),
      font: face,
      color: /^#[0-9a-fA-F]{6}$/.test(line.color) ? line.color : "#f6f1ff",
      x: 0.5,
      y: clamp(Number(y.toFixed(3)), 0.06, 0.94),
      scale: clamp(
        Number(((scales[index] ?? 0.75) * (squeeze < 1 ? Math.max(squeeze, 0.5) : 1)).toFixed(3)),
        0.15,
        3,
      ),
      rotation: clamp(line.tilt, -180, 180),
    };
  });
}

/** A faint stand-in so an empty piece still shows the garment. Never saved, never printed. */
export function ghostLayers(garmentHex: string): DesignLayer[] {
  return [
    {
      id: "say-ghost",
      type: "text",
      text: "YOUR WORDS",
      font: "Archivo Black",
      color: mix(garmentHex, contrastInk(garmentHex), 0.28),
      x: 0.5,
      y: 0.48,
      scale: 0.75,
      rotation: 0,
    },
  ];
}

export function pieceTitle(lines: readonly SayLine[], productName: string): string {
  const first = (lines[0]?.text ?? "").trim();
  const title = first.length >= 2 ? first : `Said ${productName}`;
  return title.slice(0, 80);
}

/** Put the intent on one catalog blank: nearest colour it comes in, a placement it prints, and the layers. */
export function fitIntent(intent: SayIntent, product: CatalogProduct): SayFit {
  const notes: string[] = [];
  const colors =
    product.colors.length > 0
      ? product.colors
      : [
          ...new Map(
            product.variants.map((item) => [item.color, { name: item.color, hex: item.colorHex }]),
          ).values(),
        ];
  const near = nearestColor(intent.garmentColor, colors);
  const color = near?.option ?? { name: "Black", hex: "#141414" };
  if (near && near.distance > SAME_COLOR) {
    notes.push(`Closest this blank comes in: ${color.name}.`);
  }
  const inColor = product.variants.filter(
    (item) => item.color === color.name || colorDistance(item.colorHex, color.hex) < 1,
  );
  const pool = inColor.length > 0 ? inColor : product.variants;
  const stocked = pool.filter((item) => item.inStock);
  const sized = stocked.length > 0 ? stocked : pool;
  const variant =
    sized.find((item) => item.size === "M") ?? sized.find((item) => item.size === "L") ?? sized[0];
  const place = pickPlacement(intent, product);
  if (place.note) notes.push(place.note);
  if (!matches(product, intent.blank)) {
    notes.push(
      `No ${BLANK_WORD[intent.blank]} in the catalog right now. This is the ${product.name}.`,
    );
  }
  if (intent.lines.length > MAX_LAYERS)
    notes.push("Eight lines is the limit. The first eight are on it.");
  return {
    productId: product.id,
    productName: product.name,
    variantId: variant?.id ?? "",
    colorName: color.name,
    colorHex: variant?.colorHex ?? color.hex,
    placement: place.placement,
    placementTitle: place.title,
    layers: buildLayers(intent),
    notes,
    title: pieceTitle(intent.lines, product.name),
  };
}
