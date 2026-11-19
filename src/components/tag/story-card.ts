import { encodeQr, loadImage, qrSvg, svgDataUrl } from "@/lib/qr";
import { CROWN_PATH } from "@/lib/qr/mark";

/**
 * The story card: a 1080 by 1920 picture for posting, drawn on a canvas in the browser.
 * The piece's mockup, its name, who made it, and the crown tag hanging off the frame.
 */

export const STORY = { width: 1080, height: 1920 } as const;

export type StoryInput = {
  title: string;
  handle?: string;
  detail: string;
  mockupUrl: string | null;
  url: string;
};

const NIGHT = "#0b0614";
const CREAM = "#f5ebdd";
const INK = "#17101f";
const PINK = "#ff2d95";
const MUTED = "#d5cbe8";
const DISPLAY = '"Archivo", "Arial Narrow", sans-serif';
const LABEL = '"Archivo Black", "Arial Black", sans-serif';
const BODY = '"Outfit", "Avenir Next", sans-serif';

function crown(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  const scale = width / 28;
  context.save();
  context.translate(x - 2 * scale, y - 1 * scale);
  context.scale(scale, scale);
  context.fillStyle = color;
  context.fill(new Path2D(CROWN_PATH));
  context.restore();
}

/** Break words into at most `maxLines` lines that fit `width` at the current font. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The biggest size, from `start` down to `floor`, at which the text fits the box. */
function fit(
  context: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  box: { width: number; lines: number },
  start: number,
  floor: number,
): { size: number; lines: string[] } {
  for (let size = start; size > floor; size -= 6) {
    context.font = font(size);
    const lines = wrap(context, text, box.width);
    const widest = Math.max(...lines.map((line) => context.measureText(line).width));
    if (lines.length <= box.lines && widest <= box.width) return { size, lines };
  }
  context.font = font(floor);
  return { size: floor, lines: wrap(context, text, box.width).slice(0, box.lines) };
}

async function fonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`italic 900 100px ${DISPLAY}`),
      document.fonts.load(`40px ${LABEL}`),
      document.fonts.load(`600 40px ${BODY}`),
    ]);
  } catch {
    // The card still draws in the fallback faces.
  }
}

/**
 * How wide and tall a picture really is. An svg that only carries a viewBox reports
 * a made-up size to the canvas, so read the viewBox instead.
 */
function trueSize(picture: HTMLImageElement, url: string): { width: number; height: number } {
  if (url.startsWith("data:image/svg+xml")) {
    try {
      const comma = url.indexOf(",");
      const body = url.slice(comma + 1);
      const text = url.slice(0, comma).includes(";base64") ? atob(body) : decodeURIComponent(body);
      const box = /viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
      const width = Number(box?.[1]);
      const height = Number(box?.[2]);
      if (width > 0 && height > 0) return { width, height };
    } catch {
      // Fall through to what the browser says.
    }
  }
  return { width: picture.naturalWidth, height: picture.naturalHeight };
}

async function mockup(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await loadImage(url, !url.startsWith("data:"));
  } catch {
    return null;
  }
}

/**
 * Draw the card. Resolves with whether the mockup made it in: a picture hosted
 * somewhere that does not allow copying cannot be drawn, and the card says so
 * with a crown in its place.
 */
export async function drawStoryCard(
  canvas: HTMLCanvasElement,
  input: StoryInput,
): Promise<{ mockup: boolean }> {
  canvas.width = STORY.width;
  canvas.height = STORY.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the card.");

  const matrix = encodeQr(input.url);
  const [picture, code] = await Promise.all([
    mockup(input.mockupUrl),
    loadImage(
      svgDataUrl(qrSvg(matrix, { style: "stitched", dark: INK, light: "#fffaf2", pixels: 720 })),
    ),
    fonts(),
  ]);

  // Night, with the site's grain.
  context.fillStyle = NIGHT;
  context.fillRect(0, 0, STORY.width, STORY.height);
  context.fillStyle = "rgb(255 255 255 / 7%)";
  for (let y = 7; y < STORY.height; y += 14) {
    for (let x = 7; x < STORY.width; x += 14) context.fillRect(x, y, 2, 2);
  }

  // Masthead.
  crown(context, 80, 92, 104, CREAM);
  context.fillStyle = CREAM;
  context.textBaseline = "alphabetic";
  context.font = `italic 900 96px ${DISPLAY}`;
  context.fillText("STREET ROYALTY", 212, 168);
  context.font = `26px ${LABEL}`;
  context.fillStyle = MUTED;
  context.textAlign = "right";
  context.fillText("THE RACK", 1000, 164);
  context.textAlign = "left";

  // The piece, in a frame with the hard pink shadow.
  const frame = { x: 80, y: 232, width: 920, height: 1000 };
  context.fillStyle = PINK;
  context.fillRect(frame.x + 20, frame.y + 20, frame.width, frame.height);
  context.fillStyle = "#20182c";
  context.fillRect(frame.x, frame.y, frame.width, frame.height);
  let drewMockup = false;
  const natural = picture && input.mockupUrl ? trueSize(picture, input.mockupUrl) : null;
  if (picture && natural && natural.width > 0 && natural.height > 0) {
    const scale = Math.max(frame.width / natural.width, frame.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    context.save();
    context.beginPath();
    context.rect(frame.x, frame.y, frame.width, frame.height);
    context.clip();
    context.drawImage(
      picture,
      frame.x + (frame.width - width) / 2,
      frame.y + (frame.height - height) / 2,
      width,
      height,
    );
    context.restore();
    drewMockup = true;
  } else {
    crown(context, frame.x + 210, frame.y + 300, 500, "#3a2d52");
  }
  context.lineWidth = 8;
  context.strokeStyle = CREAM;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);

  // Name and maker.
  context.fillStyle = CREAM;
  const title = fit(
    context,
    input.title.toUpperCase(),
    (size) => `italic 900 ${size}px ${DISPLAY}`,
    { width: 540, lines: 2 },
    132,
    66,
  );
  let baseline = 1296 + title.size * 0.8;
  for (const line of title.lines) {
    context.fillText(line, 80, baseline);
    baseline += title.size * 0.9;
  }
  baseline -= title.size * 0.9;
  if (input.handle) {
    baseline += 58;
    context.font = `38px ${LABEL}`;
    context.fillStyle = MUTED;
    context.fillText(`made by @${input.handle}`, 80, baseline);
  }
  baseline += 46;
  context.font = `600 30px ${BODY}`;
  context.fillStyle = "#b7a8d4";
  context.fillText(input.detail, 80, baseline);

  // A strip of tape across the bottom, off the square, with the instructions printed on it.
  context.save();
  context.translate(STORY.width / 2, 1716);
  context.rotate(-0.17);
  context.fillStyle = PINK;
  context.fillRect(-900, -52, 1800, 104);
  context.fillStyle = "#14081c";
  context.fillRect(-900, -52, 1800, 6);
  context.fillRect(-900, 46, 1800, 6);
  context.font = `italic 900 68px ${DISPLAY}`;
  context.textBaseline = "middle";
  const words = "SCAN THE FIT.   SEE WHO MADE IT.   REMIX IT.   ";
  const step = context.measureText(words).width;
  for (let x = -560; x < 900; x += step) context.fillText(words, x, 3);
  context.textBaseline = "alphabetic";
  context.restore();

  // The tag, hanging off the corner of the frame by its string.
  const tag = { width: 392, height: 520, hole: { x: 196, y: 50 } };
  const pin = { x: 846, y: 1330 };
  context.strokeStyle = CREAM;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(frame.x + frame.width - 90, frame.y + frame.height);
  context.quadraticCurveTo(pin.x + 60, pin.y - 60, pin.x, pin.y);
  context.stroke();

  context.save();
  context.translate(pin.x, pin.y);
  context.rotate(0.085);
  context.translate(-tag.hole.x, -tag.hole.y);
  const outline = (inset: number) => {
    const cut = 52;
    context.beginPath();
    context.moveTo(cut, inset);
    context.lineTo(tag.width - cut, inset);
    context.lineTo(tag.width - inset, cut);
    context.lineTo(tag.width - inset, tag.height - inset);
    context.lineTo(inset, tag.height - inset);
    context.lineTo(inset, cut);
    context.closePath();
  };
  context.save();
  context.translate(16, 16);
  outline(0);
  context.fillStyle = PINK;
  context.fill();
  context.restore();
  outline(0);
  context.fillStyle = CREAM;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = INK;
  context.stroke();
  outline(16);
  context.setLineDash([14, 9]);
  context.lineWidth = 3;
  context.stroke();
  context.setLineDash([]);
  // Hole and eyelet.
  context.beginPath();
  context.arc(tag.hole.x, tag.hole.y, 20, 0, Math.PI * 2);
  context.fillStyle = PINK;
  context.fill();
  context.lineWidth = 4;
  context.stroke();
  context.beginPath();
  context.arc(tag.hole.x, tag.hole.y, 11, 0, Math.PI * 2);
  context.fillStyle = NIGHT;
  context.fill();
  // The code.
  const side = 336;
  const left = (tag.width - side) / 2;
  context.imageSmoothingEnabled = true;
  context.drawImage(code, left, 96, side, side);
  context.lineWidth = 4;
  context.strokeRect(left, 96, side, side);
  context.fillStyle = INK;
  context.textAlign = "center";
  context.font = `italic 900 54px ${DISPLAY}`;
  context.fillText("SCAN THE FIT.", tag.width / 2, 490);
  context.restore();
  context.textAlign = "left";

  return { mockup: drewMockup };
}
