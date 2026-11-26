import type { ReactNode } from "react";
import type { DesignLayer, PrintArea } from "@/lib/pod/types";
import { FONTS, fontShorthand } from "@/lib/studio/fonts";
import { TEXT_PRESETS } from "@/lib/studio/textfx";

/** Inks that read on cloth and that DTG prints true. */
export const INK_SWATCHES = [
  { name: "Lime", hex: "#d6ff3c" },
  { name: "Hot pink", hex: "#ff2d95" },
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#111111" },
  { name: "Cream", hex: "#f5ebdd" },
  { name: "Lilac", hex: "#b9a3ee" },
  { name: "Mint", hex: "#a5dccb" },
  { name: "Cyan", hex: "#3df0ff" },
  { name: "Orange", hex: "#ff6a00" },
  { name: "Red", hex: "#e3262f" },
  { name: "Gold", hex: "#d4a017" },
  { name: "Royal", hex: "#2b3fd6" },
] as const;

export type AlignKind = "left" | "centre" | "right" | "top" | "middle" | "bottom" | "fit";

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-display text-[0.68rem] tracking-[0.14em] text-muted uppercase">
      {children}
    </label>
  );
}

function Swatches({
  value,
  onPick,
  label,
  none,
}: {
  value: string | undefined;
  onPick: (hex: string | undefined) => void;
  label: string;
  none?: boolean;
}) {
  const custom = value && !INK_SWATCHES.some((item) => item.hex === value.toLowerCase());
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {none ? (
        <button
          type="button"
          aria-label="No outline"
          aria-pressed={!value}
          onClick={() => onPick(undefined)}
          className={`relative size-9 overflow-hidden border-2 bg-surface ${!value ? "border-accent" : "border-line"}`}
        >
          <span className="absolute top-1/2 left-1/2 h-0.5 w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-pink" />
        </button>
      ) : null}
      {INK_SWATCHES.map((item) => (
        <button
          key={item.hex}
          type="button"
          aria-label={item.name}
          aria-pressed={value?.toLowerCase() === item.hex}
          onClick={() => onPick(item.hex)}
          className={`size-9 border-2 ${value?.toLowerCase() === item.hex ? "border-accent ring-2 ring-accent/40" : "border-line"}`}
          style={{ background: item.hex }}
        />
      ))}
      <label
        className={`relative size-9 cursor-pointer border-2 ${custom ? "border-accent" : "border-line"}`}
        style={{
          background: custom
            ? value
            : "conic-gradient(#ff2d95, #ffb020, #d6ff3c, #3df0ff, #7c5cff, #ff2d95)",
        }}
        title="Any colour"
      >
        <span className="sr-only">Any colour</span>
        <input
          type="color"
          value={value ?? "#ffffff"}
          onChange={(event) => onPick(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <input
          type="number"
          aria-label={`${label} value`}
          value={unit === "%" ? Math.round(value * 100) : Math.round(value * 100) / 100}
          min={unit === "%" ? min * 100 : min}
          max={unit === "%" ? max * 100 : max}
          step={unit === "%" ? 1 : step}
          onChange={(event) => {
            const raw = Number(event.target.value);
            if (!Number.isFinite(raw)) return;
            const next = unit === "%" ? raw / 100 : raw;
            onChange(Math.min(max, Math.max(min, next)));
          }}
          className="h-8 w-16 border-2 border-line bg-cream px-1 text-right text-sm text-fg"
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

const ALIGN: { kind: AlignKind; label: string; icon: string }[] = [
  { kind: "left", label: "Align left", icon: "M3 2v12M6 5h8M6 11h5" },
  { kind: "centre", label: "Centre across", icon: "M8 2v12M3 5h10M5 11h6" },
  { kind: "right", label: "Align right", icon: "M13 2v12M2 5h8M5 11h5" },
  { kind: "top", label: "Align top", icon: "M2 3h12M5 6v8M11 6v5" },
  { kind: "middle", label: "Centre up and down", icon: "M2 8h12M5 3v10M11 5v6" },
  { kind: "bottom", label: "Align bottom", icon: "M2 13h12M5 2v8M11 5v5" },
  { kind: "fit", label: "Fill the width", icon: "M2 8h12M2 8l3-3M2 8l3 3M14 8l-3-3M14 8l-3 3" },
];

/** Everything for the picked layer: what it says or shows, how it sits, and its order. */
export function LayerInspector({
  layer,
  area,
  dpi,
  sharpUpTo,
  onPatch,
  onAlign,
  onDuplicate,
  onDrop,
  textField,
  lineHelper,
  imageTools,
  full,
}: {
  layer: DesignLayer;
  area: PrintArea;
  /** For a picture: the DPI it prints at now. */
  dpi?: number;
  /** For a picture: the largest scale that still prints sharp. */
  sharpUpTo?: number;
  onPatch: (patch: Partial<DesignLayer>) => void;
  onAlign: (kind: AlignKind) => void;
  onDuplicate: () => void;
  onDrop: () => void;
  textField?: ReactNode;
  lineHelper?: ReactNode;
  imageTools?: ReactNode;
  full: boolean;
}) {
  const want = area.dpi || 150;
  const printedIn = layer.type === "image" ? 0.52 * layer.scale * area.widthIn : 0;
  return (
    <div className="flex flex-col gap-4">
      {layer.type === "text" ? (
        <>
          {textField}
          {lineHelper}
          <div className="flex flex-col gap-2">
            <Label>Font</Label>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Font">
              {FONTS.map((font) => {
                const on = layer.font === font.name;
                return (
                  <button
                    key={font.name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={font.name}
                    onClick={() => onPatch({ font: font.name })}
                    className={`flex min-h-12 flex-col items-start justify-center overflow-hidden border-2 px-2 py-1 text-left ${on ? "border-accent bg-cream" : "border-line bg-surface hover:border-ink"}`}
                  >
                    <span
                      className="block w-full truncate text-lg leading-tight"
                      style={{ font: fontShorthand(font.name, 18) }}
                    >
                      {(layer.text || "Crown").slice(0, 14)}
                    </span>
                    <span className="text-[0.65rem] text-muted">{font.vibe}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Ink</Label>
            <Swatches value={layer.color} label="Ink" onPick={(hex) => hex && onPatch({ color: hex })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Sticker outline</Label>
            <Swatches
              value={layer.outline ? undefined : layer.stroke}
              none
              label="Sticker outline"
              onPick={(hex) => onPatch({ stroke: hex, ...(hex ? { outline: false } : {}) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Shape</Label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="chip"
                  title={preset.note}
                  onClick={() => onPatch(preset.fx)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <Slider
              id="layer-arc"
              label="Arc"
              value={layer.arc ?? 0}
              min={-120}
              max={120}
              step={1}
              unit="°"
              onChange={(arc) => onPatch({ arc })}
            />
            <Slider
              id="layer-tracking"
              label="Letter spacing"
              value={layer.tracking ?? 0}
              min={-0.05}
              max={0.6}
              step={0.01}
              unit=""
              onChange={(tracking) => onPatch({ tracking })}
            />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={Boolean(layer.outline)}
                onChange={(event) =>
                  onPatch({ outline: event.target.checked, ...(event.target.checked ? { stroke: undefined } : {}) })
                }
              />
              Outline only (no fill)
            </label>
          </div>
        </>
      ) : (
        <>
          {dpi != null ? (
            <div
              role="status"
              className={`border-2 p-3 text-sm ${dpi >= want ? "border-lime" : dpi >= want * 0.6 ? "border-amber" : "border-pink"}`}
            >
              <p className="font-display text-xs tracking-wider uppercase">
                {dpi >= want ? "Prints sharp" : dpi >= want * 0.6 ? "A little soft" : "Will print blurry"} · {dpi} DPI
              </p>
              <p className="mt-1 text-muted">
                {printedIn.toFixed(1)}" wide on the piece. The printer wants {want} DPI.
                {sharpUpTo != null && dpi < want
                  ? ` It stays sharp up to ${Math.round(sharpUpTo * 100)}% size, or upload a bigger picture.`
                  : sharpUpTo != null
                    ? ` Sharp up to ${Math.round(Math.min(3, sharpUpTo) * 100)}% size.`
                    : ""}
              </p>
            </div>
          ) : null}
          {imageTools}
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label>Place it</Label>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Align">
          {ALIGN.map((item) => (
            <button
              key={item.kind}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => onAlign(item.kind)}
              className="flex h-11 items-center justify-center border-2 border-line bg-surface hover:border-ink"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ))}
        </div>
        <Slider
          id="layer-scale"
          label="Size"
          value={layer.scale}
          min={0.15}
          max={3}
          step={0.01}
          unit="%"
          onChange={(scale) => onPatch({ scale })}
        />
        <Slider
          id="layer-rotate"
          label="Turn"
          value={layer.rotation}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(rotation) => onPatch({ rotation })}
        />
        <div className="flex flex-wrap gap-1.5">
          {[-15, 0, 15, 90].map((angle) => (
            <button key={angle} type="button" className="chip" onClick={() => onPatch({ rotation: angle })}>
              {angle}°
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="chip justify-center" disabled={full} onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className="chip justify-center" onClick={onDrop}>
          Delete layer
        </button>
      </div>
    </div>
  );
}
