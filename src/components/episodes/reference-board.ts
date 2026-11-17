import {
  BOARD_HEIGHT,
  BOARD_SLOTS,
  BOARD_WIDTH,
  boardLayout,
  containRect,
  inkOn,
  samplePalette,
  type BoardCell,
} from "@/lib/episodes/board";
import { characterName, type SheetPiece } from "@/lib/episodes/sheet";
import { refKey } from "@/lib/episodes/types";

/** Draws the wardrobe reference board. Browser only: it needs a canvas and real pictures. */

const PAPER = "#eceae6";
const TILE = "#ffffff";
const INK = "#17101f";
const MUTED = "#4a4058";
const LINE = "#b9b2a6";
const DISPLAY = '"Archivo Black", "Arial Black", sans-serif';
const BODY = 'Outfit, "Avenir Next", "Segoe UI", sans-serif';
const MONO = "ui-monospace, Menlo, Consolas, monospace";

const pictures = new Map<string, Promise<HTMLImageElement | null>>();

/** Loads a picture so it can be drawn and read back. A picture that will not load gives null. */
export function loadPicture(url: string): Promise<HTMLImageElement | null> {
  const known = pictures.get(url);
  if (known) return known;
  const loading = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    // Without this a picture from another site would lock the canvas and block the download.
    if (!url.startsWith("data:")) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  pictures.set(url, loading);
  // A failure is not remembered, so the next draw gets to try again.
  void loading.then((image) => {
    if (!image && pictures.get(url) === loading) pictures.delete(url);
  });
  return loading;
}

function measure(image: HTMLImageElement): string[] {
  try {
    const size = 64;
    const scratch = document.createElement("canvas");
    scratch.width = size;
    scratch.height = size;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(image, 0, 0, size, size);
    return samplePalette(ctx.getImageData(0, 0, size, size).data, size, size, 4);
  } catch {
    return [];
  }
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const last = lines[lines.length - 1];
  if (last !== undefined) {
    let fitted = last;
    while (fitted.length > 1 && ctx.measureText(fitted).width > width) fitted = fitted.slice(0, -1);
    lines[lines.length - 1] = fitted;
  }
  return lines;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: BoardCell,
  piece: SheetPiece,
  image: HTMLImageElement | null,
  palette: string[],
) {
  const { frame, picture, text, swatches, divider } = cell;
  ctx.fillStyle = TILE;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);

  if (image) {
    const inner = { x: picture.x + 12, y: picture.y + 12, w: picture.w - 24, h: picture.h - 24 };
    const box = containRect(inner, image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, box.x, box.y, box.w, box.h);
  } else {
    ctx.fillStyle = piece.baseColor?.hex ?? PAPER;
    ctx.fillRect(picture.x, picture.y, picture.w, picture.h);
    ctx.fillStyle = piece.baseColor?.hex ? inkOn(piece.baseColor.hex) : MUTED;
    ctx.font = `400 22px ${BODY}`;
    ctx.textAlign = "center";
    ctx.fillText(
      piece.imageUrl ? "Picture did not load" : "No picture on record",
      picture.x + picture.w / 2,
      picture.y + picture.h / 2,
    );
    ctx.textAlign = "left";
  }

  // Number, name, garment: written from the top of the text box, and stopped at its floor.
  const floor = text.y + text.h - 8;
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${DISPLAY}`;
  ctx.fillText(
    `${String(cell.index + 1).padStart(2, "0")} · ${piece.source === "shop" ? "THE DROP" : "THE RACK"}`,
    text.x,
    text.y + 40,
  );

  ctx.fillStyle = INK;
  ctx.font = `400 28px ${DISPLAY}`;
  let y = text.y + 80;
  for (const line of wrap(ctx, piece.name.toUpperCase(), text.w, 3)) {
    ctx.fillText(line, text.x, y);
    y += 32;
  }

  ctx.fillStyle = MUTED;
  ctx.font = `400 21px ${BODY}`;
  y += 2;
  const about = wrap(ctx, piece.garment, text.w, 2);
  if (piece.print) about.push(`Print: ${piece.print}`);
  for (const line of about) {
    if (y > floor) break;
    ctx.fillText(line, text.x, y);
    y += 25;
  }

  // Base colour: the one colour the record gives a hex for.
  const left = swatches.x;
  const top = swatches.y;
  const width = swatches.w;
  ctx.fillStyle = MUTED;
  ctx.font = `400 15px ${DISPLAY}`;
  ctx.fillText("BASE COLOUR", left, top + 14);
  const base = piece.baseColor;
  ctx.fillStyle = base?.hex ?? TILE;
  ctx.fillRect(left, top + 24, width, 60);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.setLineDash(base?.hex ? [] : [6, 6]);
  ctx.strokeRect(left + 1, top + 25, width - 2, 58);
  ctx.setLineDash([]);
  ctx.fillStyle = base?.hex ? inkOn(base.hex) : MUTED;
  ctx.font = `600 19px ${BODY}`;
  ctx.fillText(wrap(ctx, base?.name ?? "See picture", width - 20, 1)[0] ?? "", left + 10, top + 49);
  ctx.font = `400 16px ${MONO}`;
  ctx.fillText(base?.hex ?? "no hex on record", left + 10, top + 72);

  if (palette.length > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 15px ${DISPLAY}`;
    ctx.fillText("MEASURED FROM PICTURE", left, top + 112);
    const gap = 8;
    const chip = (width - gap * 3) / 4;
    palette.slice(0, 4).forEach((hex, index) => {
      const x = left + index * (chip + gap);
      ctx.fillStyle = hex;
      ctx.fillRect(x, top + 122, chip, 40);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, top + 123, chip - 2, 38);
      ctx.fillStyle = INK;
      ctx.font = `400 12px ${MONO}`;
      ctx.fillText(hex, x, top + 180);
    });
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(frame.x + 1.5, frame.y + 1.5, frame.w - 3, frame.h - 3);
  ctx.fillStyle = INK;
  ctx.fillRect(divider.x, divider.y, divider.w, divider.h);
}

export type BoardResult = {
  /** Colours measured from each picture, by piece key. */
  palettes: Record<string, string[]>;
  /** Names of pieces whose picture could not be loaded. */
  withoutPicture: string[];
};

/**
 * Loads every picture, then paints the whole board in one go. If stale() turns
 * true while pictures load (the outfit changed again), nothing is painted.
 */
export async function drawBoard(
  canvas: HTMLCanvasElement,
  input: { character: string; pieces: SheetPiece[] },
  stale: () => boolean = () => false,
): Promise<BoardResult | null> {
  const shown = input.pieces.slice(0, BOARD_SLOTS);
  const layout = boardLayout(shown.length);
  const pieces = shown;
  const [images] = await Promise.all([
    Promise.all(pieces.map((piece) => (piece.imageUrl ? loadPicture(piece.imageUrl) : null))),
    document.fonts
      ? Promise.all([
          document.fonts.load(`400 28px "Archivo Black"`),
          document.fonts.load(`400 21px Outfit`),
          document.fonts.load(`600 19px Outfit`),
        ]).catch(() => undefined)
      : undefined,
  ]);
  if (stale()) return null;

  canvas.width = BOARD_WIDTH;
  canvas.height = BOARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const who = characterName(input.character);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const { header } = layout;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${DISPLAY}`;
  ctx.fillText("WARDROBE REFERENCE", header.x, header.y + 22);
  ctx.fillStyle = INK;
  let size = 68;
  ctx.font = `400 ${size}px ${DISPLAY}`;
  while (size > 30 && ctx.measureText(who.toUpperCase()).width > header.w * 0.6) {
    size -= 4;
    ctx.font = `400 ${size}px ${DISPLAY}`;
  }
  ctx.fillText(who.toUpperCase(), header.x - 2, header.y + header.h - 14);

  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.font = `400 22px ${DISPLAY}`;
  ctx.fillText("STREET ROYALTY", header.x + header.w, header.y + 22);
  ctx.fillStyle = MUTED;
  ctx.font = `400 26px ${BODY}`;
  ctx.fillText(
    `${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"}. The same outfit in every shot.`,
    header.x + header.w,
    header.y + header.h - 16,
  );
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.fillRect(header.x, header.y + header.h, header.w, 4);

  const palettes: Record<string, string[]> = {};
  const withoutPicture: string[] = [];
  for (const cell of layout.cells) {
    const piece = pieces[cell.index];
    if (!piece) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(cell.frame.x + 1, cell.frame.y + 1, cell.frame.w - 2, cell.frame.h - 2);
      ctx.setLineDash([]);
      continue;
    }
    const image = images[cell.index] ?? null;
    const palette = image ? measure(image) : [];
    palettes[refKey(piece.ref)] = palette;
    if (!image) withoutPicture.push(piece.name);
    drawCell(ctx, cell, piece, image, palette);
  }
  return { palettes, withoutPicture };
}

/** The board as a PNG file. Null when the browser will not hand the pixels over. */
export function boardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}
