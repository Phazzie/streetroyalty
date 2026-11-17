import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StudioShell } from "@/components/studio/shell";
import {
  MAX_SCALE,
  MIN_SCALE,
  PATTERNS,
  clashColors,
  decodeSpec,
  defaultSpec,
  drawPattern,
  encodeSpec,
  fitColors,
  patternDataUrlUnder,
  patternInfo,
  patternTileDataUrl,
  type PatternId,
  type PatternSpec,
} from "@/lib/gfx/patterns";
import { GARMENT_BOX, drawGarment } from "./garment";

/** The studio takes a layer up to 1,400,000 characters. Stay clear of it. */
const STUDIO_LIMIT = 1_300_000;
const SWATCH_MAX = 720;
const GARMENT_MAX = 520;
const THUMB = 120;
/** How many tiles the big swatch shows across at scale 1. */
const TILES_ACROSS = 2.2;

const PRESETS: { name: string; colors: string[] }[] = [
  { name: "Lilac suit", colors: ["#b9a3ee", "#f5ebdd", "#ff6a00", "#17101f"] },
  { name: "Mint suit", colors: ["#a5dccb", "#ffc9a8", "#3d7eff", "#12343a"] },
  { name: "Night drop", colors: ["#0b0614", "#7c5cff", "#ff2d95", "#f6f1ff"] },
  { name: "Paper", colors: ["#f5ebdd", "#17101f", "#ff2d95", "#7c5cff"] },
  { name: "Yard", colors: ["#5b6b3a", "#17101f", "#c9b27a", "#ff6a00"] },
  { name: "Bone", colors: ["#17101f", "#f5ebdd", "#b7a8d4", "#f5ebdd"] },
];

const SLOT_NAMES = ["Ground", "Second", "Third", "Fourth"];

const CSS = `
.plab-strip { scrollbar-width: thin; scroll-snap-type: x proximity; }
.plab-thumb { scroll-snap-align: start; transition: transform 160ms ease; }
.plab-thumb:hover { transform: translateY(-3px) rotate(-1.5deg); }
.plab-thumb[aria-pressed="true"] { box-shadow: 4px 4px 0 var(--color-pipe); transform: translate(-2px, -2px); }
.plab-range { appearance: none; -webkit-appearance: none; width: 100%; height: 2.75rem; background: transparent; cursor: pointer; }
.plab-range::-webkit-slider-runnable-track { height: 0.5rem; border: 2px solid var(--color-ink); background: var(--color-bg); }
.plab-range::-moz-range-track { height: 0.5rem; border: 2px solid var(--color-ink); background: var(--color-bg); }
.plab-range::-webkit-slider-thumb { -webkit-appearance: none; width: 1.75rem; height: 1.75rem; margin-top: -0.75rem; border: 2px solid var(--color-ink); border-radius: 0.35rem; background: var(--color-accent); box-shadow: 3px 3px 0 var(--color-pipe); }
.plab-range::-moz-range-thumb { width: 1.5rem; height: 1.5rem; border: 2px solid var(--color-ink); border-radius: 0.35rem; background: var(--color-accent); box-shadow: 3px 3px 0 var(--color-pipe); }
.plab-range:focus-visible { outline: 2px solid var(--color-fg); outline-offset: 2px; }
.plab-ink { appearance: none; -webkit-appearance: none; width: 3rem; height: 3rem; padding: 0; border: 2px solid var(--color-ink); border-radius: 0.55rem; background: none; cursor: pointer; }
.plab-ink::-webkit-color-swatch-wrapper { padding: 0; }
.plab-ink::-webkit-color-swatch { border: 0; border-radius: 0.35rem; }
.plab-ink::-moz-color-swatch { border: 0; border-radius: 0.35rem; }
.plab-ink:focus-visible { outline: 2px solid var(--color-fg); outline-offset: 2px; }
.plab-stage { background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 16%, transparent) 1px, transparent 1.4px); background-size: 12px 12px; }
@keyframes plab-stamp { 0% { transform: scale(0.955) rotate(-1.2deg); } 60% { transform: scale(1.012) rotate(0.3deg); } 100% { transform: none; } }
@keyframes plab-tumble { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.plab-stamp { animation: plab-stamp 320ms cubic-bezier(0.16, 1, 0.3, 1); }
.plab-tumble { animation: plab-tumble 420ms cubic-bezier(0.16, 1, 0.3, 1); }
@media (prefers-reduced-motion: reduce) {
  .plab-stamp, .plab-tumble { animation: none; }
  .plab-thumb, .plab-thumb:hover { transition: none; transform: none; }
}
`;

function freshSeed(): number {
  const box = new Uint32Array(1);
  globalThis.crypto.getRandomValues(box);
  return box[0]! % 1_000_000;
}

function backing(canvas: HTMLCanvasElement, cap: number, ratio = 1): number {
  const css = canvas.clientWidth || cap;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = Math.max(64, Math.min(cap, Math.round(css * dpr)));
  const height = Math.round(width * ratio);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return width;
}

function replay(element: HTMLElement | null, name: string): void {
  if (!element) return;
  element.classList.remove(name);
  // reading the box restarts the keyframes
  void element.offsetWidth;
  element.classList.add(name);
}

function Dice() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="8.5" cy="8.5" r="1.7" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.7" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.7" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function PatternLab({
  encoded,
  onEncoded,
}: {
  /** The spec from the address bar, if there is one. */
  encoded?: string;
  onEncoded: (text: string) => void;
}) {
  const navigate = useNavigate();
  const [spec, setSpec] = useState<PatternSpec>(
    () => decodeSpec(encoded) ?? defaultSpec("bandana", 77),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState(0);
  const swatch = useRef<HTMLCanvasElement>(null);
  const garment = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dice = useRef<HTMLSpanElement>(null);
  const thumbs = useRef(new Map<PatternId, HTMLCanvasElement>());
  const lastSent = useRef(encoded ?? "");
  const text = encodeSpec(spec);
  const info = patternInfo(spec.id);
  const rotation = spec.rotation ?? 0;

  // Keep the address bar in step, without a history entry for every slider tick.
  useEffect(() => {
    if (text === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = text;
      onEncoded(text);
    }, 260);
    return () => clearTimeout(timer);
  }, [text, onEncoded]);

  // Back, forward, or a pasted link.
  useEffect(() => {
    if (!encoded || encoded === lastSent.current) return;
    const next = decodeSpec(encoded);
    if (!next) return;
    lastSent.current = encoded;
    setSpec(next);
  }, [encoded]);

  useEffect(() => {
    const canvas = swatch.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(() => setSize(canvas.clientWidth));
    watcher.observe(canvas);
    return () => watcher.disconnect();
  }, []);

  // The swatch and the tee, once per frame at most: a fast draft while things move, then a sharp one.
  useEffect(() => {
    const paint = (draft: boolean) => {
      const big = swatch.current;
      const bigCtx = big?.getContext("2d");
      if (big && bigCtx) {
        const width = backing(big, SWATCH_MAX);
        drawPattern(bigCtx, spec, width, width, { unit: width / TILES_ACROSS, draft });
      }
      const tee = garment.current;
      const teeCtx = tee?.getContext("2d");
      if (tee && teeCtx) {
        const width = backing(tee, GARMENT_MAX, GARMENT_BOX.height / GARMENT_BOX.width);
        drawGarment(teeCtx, spec, width, "#f6f1ff", draft);
      }
    };
    const frame = requestAnimationFrame(() => paint(true));
    const settle = setTimeout(() => paint(false), 160);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [spec, size]);

  // The strip only changes with the seed, or the colours of the pattern in use.
  const activeColors = spec.colors.join("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      for (const pattern of PATTERNS) {
        const canvas = thumbs.current.get(pattern.id);
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) continue;
        if (canvas.width !== THUMB) canvas.width = THUMB;
        if (canvas.height !== THUMB) canvas.height = THUMB;
        const colors = pattern.id === spec.id ? spec.colors : pattern.defaultColors;
        drawPattern(ctx, { id: pattern.id, seed: spec.seed, colors, scale: 1 }, THUMB, THUMB, {
          unit: THUMB,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeColors stands in for spec.colors
  }, [spec.seed, spec.id, activeColors]);

  const change = useCallback((patch: Partial<PatternSpec>) => {
    setNote("");
    setSpec((current) => ({ ...current, ...patch }));
  }, []);

  const pick = (id: PatternId) => {
    setNote("");
    setSpec((current) => {
      const untouched = current.colors.join() === patternInfo(current.id).defaultColors.join();
      const colors = untouched ? [...patternInfo(id).defaultColors] : fitColors(id, current.colors);
      return { ...current, id, colors };
    });
    replay(stage.current, "plab-stamp");
  };

  const roll = () => {
    change({ seed: freshSeed() });
    replay(stage.current, "plab-stamp");
    replay(dice.current, "plab-tumble");
  };

  const clash = () => {
    change({ colors: clashColors(freshSeed(), info.colorSlots) });
    replay(stage.current, "plab-stamp");
  };

  const setColor = (slot: number, color: string) => {
    setNote("");
    setSpec((current) => ({
      ...current,
      colors: current.colors.map((old, index) => (index === slot ? color : old)),
    }));
  };

  const send = () => {
    setBusy(true);
    setNote("");
    // let the button repaint before the heavy draw
    requestAnimationFrame(() => {
      try {
        const picture = patternDataUrlUnder(spec, 1800, 1800, STUDIO_LIMIT, {
          unit: 1800 / TILES_ACROSS,
        });
        sessionStorage.setItem("sr-print-art", picture.dataUrl);
      } catch {
        setBusy(false);
        setNote("This phone could not hold that pattern. Make the pattern bigger and try again.");
        return;
      }
      void navigate({ to: "/studio" });
    });
  };

  const download = () => {
    try {
      const link = document.createElement("a");
      link.href = patternTileDataUrl(spec, 1024);
      link.download = `street-royalty-${spec.id}-${spec.seed}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setNote("Tile saved. It repeats edge to edge.");
    } catch {
      setNote("The tile could not be saved on this device.");
    }
  };

  const copy = async () => {
    const url = `${location.origin}/patterns?p=${text}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied. It opens this exact pattern.");
    } catch {
      setNote(`Copy this link: ${url}`);
    }
  };

  return (
    <StudioShell current="/studio">
      <style>{CSS}</style>
      <p className="tag">Pattern lab</p>
      <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
        Make the cloth first.
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Twelve patterns, drawn fresh every time. Roll one, clash the colours, then send it to the
        studio.
      </p>

      <div
        className="plab-strip mt-5 -mx-4 flex gap-3 overflow-x-auto px-4 pt-2 pb-3"
        role="group"
        aria-label="Pick a pattern"
      >
        {PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            aria-pressed={pattern.id === spec.id}
            onClick={() => pick(pattern.id)}
            className="plab-thumb w-[5.25rem] shrink-0 border-2 border-ink bg-surface p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            <canvas
              ref={(node) => {
                if (node) thumbs.current.set(pattern.id, node);
                else thumbs.current.delete(pattern.id);
              }}
              width={THUMB}
              height={THUMB}
              className="block aspect-square w-full bg-bg"
              aria-hidden="true"
            />
            <span className="mt-1 block truncate font-display text-[0.62rem] tracking-wide uppercase">
              {pattern.name}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_22rem]">
        <div ref={stage} className="order-1 min-w-0 self-start border-2 border-ink bg-surface p-2">
          <canvas
            ref={swatch}
            className="block aspect-square w-full bg-bg"
            role="img"
            aria-label={`${info.name} pattern, roll ${spec.seed}`}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="font-display text-sm uppercase">
              {info.name} <span className="text-muted">No. {spec.seed}</span>
            </p>
            <p className="text-sm text-muted">Preview</p>
          </div>
        </div>

        <div className="plab-stage order-3 flex min-w-0 flex-col self-start border-2 border-ink bg-surface p-2 sm:order-2">
          <canvas
            ref={garment}
            className="m-auto block w-full max-w-[20rem]"
            style={{ aspectRatio: `${GARMENT_BOX.width} / ${GARMENT_BOX.height}` }}
            role="img"
            aria-label="The pattern on a tee shape"
          />
          <p className="mt-2 text-sm text-muted">
            On a tee shape. A sketch, not the printed piece.
          </p>
        </div>

        <div className="order-2 min-w-0 space-y-4 sm:order-3 sm:col-span-2 lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="lg" onClick={roll}>
              <span ref={dice} className="inline-flex">
                <Dice />
              </span>
              Roll it
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={clash}
              className="bg-pink text-[#14081c] hover:bg-pink"
            >
              Clash it
            </Button>
          </div>

          <section className="border-2 border-ink bg-surface p-4" aria-label="Size and turn">
            <label className="block">
              <span className="flex items-baseline justify-between font-display text-sm tracking-wide uppercase">
                Size <span className="text-muted">{spec.scale.toFixed(2)}x</span>
              </span>
              <input
                type="range"
                className="plab-range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.05}
                value={spec.scale}
                onChange={(event) => change({ scale: Number(event.target.value) })}
              />
            </label>
            <label className="mt-1 block">
              <span className="flex items-baseline justify-between font-display text-sm tracking-wide uppercase">
                Turn <span className="text-muted">{rotation} degrees</span>
              </span>
              <input
                type="range"
                className="plab-range"
                min={0}
                max={359}
                step={1}
                value={rotation}
                onChange={(event) => change({ rotation: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="border-2 border-ink bg-surface p-4" aria-labelledby="plab-colours">
            <h2 id="plab-colours" className="font-display text-sm tracking-wide uppercase">
              Colours
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {spec.colors.map((color, slot) => (
                <label key={slot} className="flex flex-col items-center gap-1 text-xs text-muted">
                  <input
                    type="color"
                    className="plab-ink"
                    value={color}
                    onChange={(event) => setColor(slot, event.target.value)}
                    aria-label={`${SLOT_NAMES[slot] ?? `Colour ${slot + 1}`} colour`}
                  />
                  {SLOT_NAMES[slot] ?? slot + 1}
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="chip gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
                  onClick={() => change({ colors: preset.colors.slice(0, info.colorSlots) })}
                >
                  <span className="flex" aria-hidden="true">
                    {preset.colors.slice(0, 3).map((color, index) => (
                      <span
                        key={index}
                        className="-ml-1 h-4 w-4 rounded-full border border-ink first:ml-0"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                className="chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
                onClick={() => change({ colors: [...info.defaultColors] })}
              >
                Reset
              </button>
            </div>
          </section>

          <div className="grid gap-3">
            <Button size="lg" onClick={send} disabled={busy}>
              {busy ? "Sending it" : "Send to the studio"}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={download}>
                Download tile
              </Button>
              <Button variant="ghost" onClick={() => void copy()}>
                Copy link
              </Button>
            </div>
            <p role="status" className="min-h-6 text-sm break-words text-muted">
              {note}
            </p>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
