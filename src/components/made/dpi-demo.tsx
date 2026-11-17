import { useEffect, useId, useRef, useState } from "react";
import {
  dotsPerInch,
  HOUSE_TEE_WIDTH_IN,
  pixelsWanted,
  sharpness,
  STUDIO_DPI,
  type Sharpness,
} from "@/lib/made/dpi";

const VERDICT: Record<Sharpness, { title: string; body: string }> = {
  sharp: { title: "Prints sharp", body: "That is enough squares. Edges come out clean." },
  soft: {
    title: "Prints soft",
    body: "Not quite enough. Small words and thin lines will look fuzzy.",
  },
  blurry: { title: "Prints blurry", body: "Too small for this size. You will see the squares." },
};

/** A stand-in picture with big shapes, small words and thin lines, so the loss shows. */
function drawArt(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ff2d95";
  ctx.beginPath();
  const crown: [number, number][] = [
    [0.06, 0.7],
    [0.06, 0.24],
    [0.15, 0.46],
    [0.23, 0.16],
    [0.31, 0.46],
    [0.4, 0.24],
    [0.4, 0.7],
  ];
  crown.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * width, y * height);
    else ctx.lineTo(x * width, y * height);
  });
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#17101f";
  ctx.textBaseline = "alphabetic";
  ctx.font = `italic 900 ${height * 0.3}px Archivo, "Arial Narrow", Arial, sans-serif`;
  ctx.fillText("ROYAL", width * 0.45, height * 0.56, width * 0.5);
  ctx.font = `600 ${height * 0.085}px Outfit, Arial, sans-serif`;
  ctx.fillText("made to order, one at a time", width * 0.45, height * 0.7, width * 0.5);
  ctx.lineWidth = Math.max(0.5, height * 0.008);
  ctx.strokeStyle = "#17101f";
  for (let line = 0; line < 5; line += 1) {
    const y = height * (0.8 + line * 0.035);
    ctx.beginPath();
    ctx.moveTo(width * 0.06, y);
    ctx.lineTo(width * 0.95, y);
    ctx.stroke();
  }
}

/**
 * Drag to change how big your picture is and watch a patch of the print get sharp or
 * blocky. A screen preview, not a print, and it says so.
 */
export function DpiDemo() {
  const id = useId();
  const [width, setWidth] = useState(300);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dpi = dotsPerInch(width, HOUSE_TEE_WIDTH_IN);
  const state = sharpness(dpi);
  const wanted = pixelsWanted(HOUSE_TEE_WIDTH_IN);

  useEffect(() => {
    const target = canvas.current;
    const ctx = target?.getContext("2d");
    if (!target || !ctx) return;
    // The window shows one patch of the print. Fewer dots an inch means fewer squares in it.
    const across = Math.max(
      6,
      Math.min(target.width, Math.round((target.width * dpi) / STUDIO_DPI)),
    );
    const down = Math.max(3, Math.round(across / 2));
    const small = document.createElement("canvas");
    small.width = across;
    small.height = down;
    const smallCtx = small.getContext("2d");
    if (!smallCtx) return;
    drawArt(smallCtx, across, down);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(small, 0, 0, target.width, target.height);
  }, [dpi]);

  return (
    <div className="flex flex-col border-2 border-ink bg-surface md:flex-row">
      <div className="border-b-2 border-ink md:w-1/2 md:border-r-2 md:border-b-0">
        <canvas
          ref={canvas}
          width={720}
          height={360}
          role="img"
          aria-label={`A patch of a print made from a picture ${width} pixels wide. ${VERDICT[state].title}.`}
          className="block aspect-[2/1] w-full"
        />
        <p className="border-t-2 border-ink px-4 py-2 text-xs text-subtle">
          A patch of the print, blown up. This is a preview on your screen, not a print.
        </p>
      </div>
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <h3 className="display text-4xl">Try it</h3>
        <p className="eyebrow mt-1.5 text-subtle">Small picture, big print</p>
        <label htmlFor={id} className="mt-4 block font-bold">
          How wide is your picture
        </label>
        <input
          id={id}
          type="range"
          min={150}
          max={2400}
          step={50}
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          aria-valuetext={`${width} squares wide`}
          className="h-11 w-full"
          style={{ accentColor: "var(--color-fg)" }}
        />
        <p className="tabular-nums">
          <span className="font-display text-2xl">{width.toLocaleString("en-US")}</span> squares
          wide. A square is one pixel.
        </p>
        <div role="status" className="mt-4 border-2 border-ink bg-bg px-3 py-2">
          <p className="font-display text-sm tracking-wider uppercase">{VERDICT[state].title}</p>
          <p className="text-sm">
            Across a {HOUSE_TEE_WIDTH_IN} inch print that is {dpi} squares an inch. The studio
            prints at {STUDIO_DPI}. {VERDICT[state].body}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted">
          For a full {HOUSE_TEE_WIDTH_IN} inch print, start with a picture at least{" "}
          {wanted.toLocaleString("en-US")} squares wide. Making a small picture bigger on a computer
          does not add detail.
        </p>
      </div>
    </div>
  );
}
