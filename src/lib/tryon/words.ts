/**
 * The pure half of try-on: what to ask the picture maker for, what a request
 * looks like, and what to say when a picture does not come back. No browser and
 * no server in here, so every line of it can be tested.
 */

/** generateLook drops any picture longer than this, so nothing longer is ever sent. */
export const MAX_IMAGE_CHARS = 1_400_000;

/** The clothing reference is drawn at this size: two wide by two and a half tall, like a hang tag. */
export const REFERENCE_SIZE = { width: 768, height: 960 } as const;

export type TryOnPiece = {
  productType: string;
  colorName: string;
  placement: string;
};

export type TryOnRequest = {
  mode: "look";
  spoken: string;
  characterImages: string[];
  clothingImages: string[];
};

/** Why a try-on did not come back. "offline" is the browser never reaching the server. */
export type TryOnFail = "off" | "limit" | "missed" | "offline";

export function usableImage(value: unknown): value is string {
  return (
    typeof value === "string" && value.startsWith("data:image/") && value.length <= MAX_IMAGE_CHARS
  );
}

function plain(value: string, fallback: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9 /&-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean || fallback;
}

function garment(
  productType: string,
): "cap" | "pullover hoodie" | "crewneck sweatshirt" | "t-shirt" {
  const type = productType.toLowerCase();
  if (type.includes("hat") || type.includes("cap") || type.includes("beanie")) return "cap";
  if (type.includes("hood")) return "pullover hoodie";
  if (type.includes("crew") || type.includes("sweat")) return "crewneck sweatshirt";
  return "t-shirt";
}

/**
 * What the person is dressed in. With a reference the mockup carries the print,
 * so the words only pin the garment to it. Without one the print cannot be
 * described honestly, so the words stop at cut and colour.
 */
export function tryOnWords(piece: TryOnPiece, hasReference: boolean): string {
  const kind = garment(piece.productType);
  const tone = plain(piece.colorName, "black");
  const where = plain(piece.placement.replaceAll("_", " "), "front");
  const rest =
    kind === "cap"
      ? "a plain black t-shirt, plain black trousers and white sneakers"
      : "plain black trousers and white sneakers";
  if (!hasReference) return `a plain ${tone} ${kind} with no print, ${rest}`;
  if (kind === "cap") {
    return `the exact ${tone} cap shown in the clothing reference, with the same graphic on the front panel, ${rest}`;
  }
  return `the exact ${tone} ${kind} shown in the clothing reference, with the same print in the same place on the ${where}, same colours and same size, ${rest}`;
}

/** The lab's face slots, best first. Two is as many as the picture maker uses. */
const SLOT_ORDER = ["front", "side", "threequarter"];

export function pickFaces(refs: readonly { id: string; dataUrl?: string }[]): string[] {
  return SLOT_ORDER.map((slot) => refs.find((ref) => ref.id === slot)?.dataUrl)
    .filter(usableImage)
    .slice(0, 2);
}

/**
 * The exact body sent to generateLook. Null when there is nobody to dress,
 * because the server would turn that away and the visitor would wait for nothing.
 */
export function buildTryOn(input: {
  piece: TryOnPiece;
  faces: readonly string[];
  reference: string | null;
}): TryOnRequest | null {
  const characterImages = input.faces.filter(usableImage).slice(0, 2);
  if (characterImages.length === 0) return null;
  const clothingImages = usableImage(input.reference) ? [input.reference] : [];
  return {
    mode: "look",
    spoken: tryOnWords(input.piece, clothingImages.length > 0),
    characterImages,
    clothingImages,
  };
}

/** generateLook answers "unavailable", "limit" or "missed". Anything else is treated as a miss. */
export function failKind(kind: unknown): TryOnFail {
  if (kind === "unavailable") return "off";
  if (kind === "limit") return "limit";
  return "missed";
}

export function failSentence(kind: TryOnFail): string {
  if (kind === "off") return "Try-on is switched off for now.";
  if (kind === "limit") {
    return "That is today's pictures used up. The fitting room opens again tomorrow.";
  }
  if (kind === "offline") {
    return "The fitting room could not be reached, so nothing was made. Check your signal and try again.";
  }
  return "That one did not come out. The picture maker turned it down or dropped it. Try again, or lock a different face in the lab.";
}

/** Said before any picture is made. Pictures cost money, so the ask names the cost and the allowance. */
export function askSentence(perDay: number | null, exact: boolean): string {
  const allowance =
    perDay && perDay > 0
      ? ` Each visitor gets ${perDay} generated ${perDay === 1 ? "picture" : "pictures"} a day.`
      : "";
  const loose = exact
    ? ""
    : " The print could not be read from here, so this one shows the cut and colour only.";
  return `This makes one generated picture, and pictures cost money.${allowance}${loose}`;
}

/** Where a picture of any shape sits inside the reference frame: whole, centred, never stretched up past its own size times four. */
export function containBox(
  source: { width: number; height: number },
  frame: { width: number; height: number } = REFERENCE_SIZE,
  pad = 24,
): { x: number; y: number; width: number; height: number } {
  const sw = source.width > 0 ? source.width : frame.width;
  const sh = source.height > 0 ? source.height : frame.height;
  const room = {
    width: Math.max(1, frame.width - pad * 2),
    height: Math.max(1, frame.height - pad * 2),
  };
  const scale = Math.min(room.width / sw, room.height / sh, 4);
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);
  return {
    x: Math.round((frame.width - width) / 2),
    y: Math.round((frame.height - height) / 2),
    width,
    height,
  };
}
