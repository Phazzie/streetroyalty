import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignLayer, PrintArea } from "@/lib/pod/types";
import { garmentStage } from "@/lib/gfx/garments";
import { loadLayerFonts, measureLayer, paintLayers } from "@/components/studio/print-file";

export type StageView = "garment" | "flat";

type Point = { x: number; y: number };

type Gesture =
  | { kind: "move"; id: string; start: Point; from: Point; moved: boolean }
  | { kind: "scale"; id: string; centre: Point; startDist: number; from: number }
  | { kind: "rotate"; id: string; centre: Point; startAngle: number; from: number }
  | {
      kind: "pinch";
      id: string;
      startDist: number;
      startAngle: number;
      from: { scale: number; rotation: number };
    };

/** Pull to the middle when a layer's centre comes this close to it, as a share of the area. */
const SNAP = 0.02;
const MIN_SCALE = 0.15;
const MAX_SCALE = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function snapAngle(degrees: number, fine: boolean): number {
  let angle = ((((degrees + 180) % 360) + 360) % 360) - 180;
  const step = fine ? 15 : 45;
  const nearest = Math.round(angle / step) * step;
  if (fine || Math.abs(angle - nearest) < 4) angle = nearest;
  return angle === -180 ? 180 : Math.round(angle);
}

/**
 * The studio's work surface: the bare garment, its print area, and a live canvas painted
 * by the same code that writes the print file. Layers move by dragging, resize from a
 * corner, turn from the knob, and pinch with two fingers.
 */
export function DesignStage({
  layers,
  selected,
  area,
  colorHex,
  productType,
  placement,
  view,
  softIds,
  onSelect,
  onPatch,
  onOpen,
}: {
  layers: DesignLayer[];
  selected: string;
  area: PrintArea;
  colorHex: string;
  productType: string;
  placement: string;
  view: StageView;
  /** Pictures that will print soft at their size. */
  softIds?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<DesignLayer>) => void;
  /** Double click or double tap on a layer. */
  onOpen?: (id: string) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fontTick, setFontTick] = useState(0);
  const [imageTick, setImageTick] = useState(0);
  const [guides, setGuides] = useState({ x: false, y: false });
  const images = useRef(new Map<string, HTMLImageElement>());
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const latest = useRef(layers);
  latest.current = layers;

  const garment = view === "garment";
  const stage = useMemo(
    () =>
      garment
        ? garmentStage({
            shape: productType,
            colorHex,
            placement,
            printArea: { widthIn: area.widthIn, heightIn: area.heightIn },
          })
        : null,
    [area.heightIn, area.widthIn, colorHex, garment, placement, productType],
  );
  const turn = stage?.box.rot ?? 0;
  const aspect = garment ? 480 / 600 : area.widthIn / Math.max(0.1, area.heightIn);

  // The area's size on screen, before any turn.
  useEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    const read = () => setSize({ w: node.offsetWidth, h: node.offsetHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [garment]);

  // Pictures, loaded once per source.
  useEffect(() => {
    for (const layer of layers) {
      if (layer.type !== "image" || images.current.has(layer.src)) continue;
      const image = new Image();
      image.onload = () => setImageTick((tick) => tick + 1);
      image.src = layer.src;
      images.current.set(layer.src, image);
    }
  }, [layers]);

  const fontKey = [...new Set(layers.flatMap((layer) => (layer.type === "text" ? [layer.font] : [])))]
    .sort()
    .join("|");
  useEffect(() => {
    let live = true;
    void loadLayerFonts(latest.current).then(() => {
      if (live) setFontTick((tick) => tick + 1);
    });
    return () => {
      live = false;
    };
  }, [fontKey]);

  const ready = (layer: DesignLayer) => {
    if (layer.type !== "image") return null;
    const image = images.current.get(layer.src);
    return image && image.complete && image.naturalWidth > 0 ? image : null;
  };

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.round(size.w * ratio);
    const height = Math.round(size.h * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintLayers(ctx, width, height, layers, layers.map(ready));
     
  }, [layers, size, fontTick, imageTick]);

  // Where each layer's ink sits, in pixels of the area on screen.
  const boxes = useMemo(() => {
    if (size.w === 0 || typeof document === "undefined") return new Map<string, { w: number; h: number }>();
    const ctx = document.createElement("canvas").getContext("2d");
    const out = new Map<string, { w: number; h: number }>();
    if (!ctx) return out;
    for (const layer of layers) {
      const image = ready(layer);
      out.set(
        layer.id,
        measureLayer(ctx, size.w, size.h, layer, image ? { width: image.naturalWidth, height: image.naturalHeight } : null),
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, size, fontTick, imageTick]);

  /** A screen point in the area's own pixels, measured from its top left corner, turn undone. */
  function toLocal(clientX: number, clientY: number): Point {
    const node = areaRef.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = (-turn * Math.PI) / 180;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return {
      x: dx * Math.cos(angle) - dy * Math.sin(angle) + node.offsetWidth / 2,
      y: dx * Math.sin(angle) + dy * Math.cos(angle) + node.offsetHeight / 2,
    };
  }

  const layerById = (id: string) => latest.current.find((layer) => layer.id === id);
  const centreOf = (layer: DesignLayer): Point => ({ x: layer.x * size.w, y: layer.y * size.h });

  function pairOf(): [Point, Point] | null {
    const all = [...pointers.current.values()];
    return all.length >= 2 ? [all[0]!, all[1]!] : null;
  }

  function startPinch(id: string) {
    const layer = layerById(id);
    const pair = pairOf();
    if (!layer || !pair) return;
    const [a, b] = pair;
    gesture.current = {
      kind: "pinch",
      id,
      startDist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startAngle: Math.atan2(b.y - a.y, b.x - a.x),
      from: { scale: layer.scale, rotation: layer.rotation },
    };
  }

  function track(event: React.PointerEvent) {
    pointers.current.set(event.pointerId, toLocal(event.clientX, event.clientY));
    const move = (ev: PointerEvent) => {
      if (!pointers.current.has(ev.pointerId)) return;
      pointers.current.set(ev.pointerId, toLocal(ev.clientX, ev.clientY));
      step(ev);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      pointers.current.delete(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (pointers.current.size === 0) {
        gesture.current = null;
        setGuides({ x: false, y: false });
      } else if (gesture.current?.kind === "pinch") {
        // One finger left: carry on as a drag from where it is.
        const rest = [...pointers.current.values()][0]!;
        const layer = layerById(gesture.current.id);
        if (layer) {
          gesture.current = {
            kind: "move",
            id: layer.id,
            start: rest,
            from: { x: layer.x, y: layer.y },
            moved: true,
          };
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function step(ev: PointerEvent) {
    const now = gesture.current;
    if (!now || size.w === 0) return;
    if (now.kind === "move") {
      const point = pointers.current.values().next().value as Point | undefined;
      if (!point) return;
      const dx = point.x - now.start.x;
      const dy = point.y - now.start.y;
      if (!now.moved && Math.hypot(dx, dy) < 3) return;
      now.moved = true;
      let x = clamp(now.from.x + dx / size.w, 0, 1);
      let y = clamp(now.from.y + dy / size.h, 0, 1);
      const snapX = !ev.altKey && Math.abs(x - 0.5) < SNAP;
      const snapY = !ev.altKey && Math.abs(y - 0.5) < SNAP;
      if (snapX) x = 0.5;
      if (snapY) y = 0.5;
      setGuides((g) => (g.x === snapX && g.y === snapY ? g : { x: snapX, y: snapY }));
      onPatch(now.id, { x, y });
      return;
    }
    if (now.kind === "pinch") {
      const pair = pairOf();
      if (!pair) return;
      const [a, b] = pair;
      const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      onPatch(now.id, {
        scale: clamp(now.from.scale * (dist / now.startDist), MIN_SCALE, MAX_SCALE),
        rotation: snapAngle(now.from.rotation + ((angle - now.startAngle) * 180) / Math.PI, false),
      });
      return;
    }
    const point = pointers.current.get(ev.pointerId);
    if (!point) return;
    if (now.kind === "scale") {
      const dist = Math.hypot(point.x - now.centre.x, point.y - now.centre.y);
      const scale = clamp(now.from * (dist / now.startDist), MIN_SCALE, MAX_SCALE);
      onPatch(now.id, { scale: Math.round(scale * 100) / 100 });
      return;
    }
    const angle = Math.atan2(point.y - now.centre.y, point.x - now.centre.x);
    const rotation = now.from + ((angle - now.startAngle) * 180) / Math.PI;
    onPatch(now.id, { rotation: snapAngle(rotation, ev.shiftKey) });
  }

  function onLayerDown(event: React.PointerEvent, id: string) {
    event.stopPropagation();
    event.preventDefault();
    onSelect(id);
    track(event);
    if (pointers.current.size >= 2) {
      startPinch(gesture.current?.id ?? id);
      return;
    }
    const layer = layerById(id);
    if (!layer) return;
    gesture.current = {
      kind: "move",
      id,
      start: pointers.current.get(event.pointerId)!,
      from: { x: layer.x, y: layer.y },
      moved: false,
    };
  }

  function onHandleDown(event: React.PointerEvent, id: string, kind: "scale" | "rotate") {
    event.stopPropagation();
    event.preventDefault();
    const layer = layerById(id);
    if (!layer) return;
    track(event);
    const point = pointers.current.get(event.pointerId)!;
    const centre = centreOf(layer);
    gesture.current =
      kind === "scale"
        ? {
            kind,
            id,
            centre,
            startDist: Math.max(4, Math.hypot(point.x - centre.x, point.y - centre.y)),
            from: layer.scale,
          }
        : {
            kind,
            id,
            centre,
            startAngle: Math.atan2(point.y - centre.y, point.x - centre.x),
            from: layer.rotation,
          };
  }

  function onBackgroundDown(event: React.PointerEvent) {
    // A second finger anywhere on the stage pinches the picked layer.
    if (gesture.current && selected) {
      track(event);
      if (pointers.current.size >= 2) startPinch(selected);
      return;
    }
    onSelect("");
  }

  const active = layers.find((layer) => layer.id === selected);
  const activeBox = active ? boxes.get(active.id) : undefined;

  const areaStyle: React.CSSProperties = stage
    ? {
        left: `${stage.box.cx * 100}%`,
        top: `${stage.box.cy * 100}%`,
        width: `${stage.box.w * 100}%`,
        height: `${stage.box.h * 100}%`,
        transform: `translate(-50%, -50%) rotate(${stage.box.rot}deg)`,
      }
    : { inset: 0 };

  return (
    <div
      className="relative mx-auto w-full touch-none select-none"
      style={{
        aspectRatio: `${aspect}`,
        maxWidth: `calc(var(--stage-max-h, 70vh) * ${aspect})`,
        background: garment ? "#0b0614" : colorHex,
      }}
      onPointerDown={onBackgroundDown}
      data-testid="design-stage"
    >
      {stage ? (
        <img
          src={stage.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      ) : null}
      <div ref={areaRef} className="absolute" style={areaStyle}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <div
          className="pointer-events-none absolute inset-0 border border-dashed"
          style={{ borderColor: "color-mix(in srgb, currentColor 55%, transparent)", color: inkFor(colorHex) }}
        />
        {guides.x ? (
          <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-pink" />
        ) : null}
        {guides.y ? (
          <div className="pointer-events-none absolute top-1/2 right-0 left-0 h-px bg-pink" />
        ) : null}
        {layers.map((layer) => {
          const box = boxes.get(layer.id);
          if (!box) return null;
          const soft = softIds?.has(layer.id);
          return (
            <button
              key={layer.id}
              type="button"
              aria-label={layer.type === "text" ? `Text: ${layer.text}` : "Artwork"}
              aria-pressed={layer.id === selected}
              onPointerDown={(event) => onLayerDown(event, layer.id)}
              onDoubleClick={() => onOpen?.(layer.id)}
              onFocus={() => onSelect(layer.id)}
              className={`absolute cursor-move touch-none outline-none ${soft ? "outline-2 outline-dashed outline-pink" : ""}`}
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                width: Math.max(28, box.w),
                height: Math.max(28, box.h),
                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
              }}
            >
              {soft ? (
                <span className="absolute -top-5 left-0 bg-pink px-1 font-display text-[0.6rem] tracking-wider text-white uppercase">
                  Soft
                </span>
              ) : null}
            </button>
          );
        })}
        {active && activeBox ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${active.x * 100}%`,
              top: `${active.y * 100}%`,
              width: Math.max(28, activeBox.w),
              height: Math.max(28, activeBox.h),
              transform: `translate(-50%, -50%) rotate(${active.rotation}deg)`,
            }}
          >
            <div className="absolute inset-[-3px] border-2 border-cyan" />
            <div className="absolute bottom-full left-1/2 h-5 w-0.5 -translate-x-1/2 bg-cyan" />
            <span
              role="button"
              tabIndex={-1}
              aria-label="Turn"
              title="Drag to turn. Hold Shift for 15° steps."
              onPointerDown={(event) => onHandleDown(event, active.id, "rotate")}
              className="pointer-events-auto absolute bottom-full left-1/2 mb-4 flex size-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-cyan bg-night text-cyan"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            {(["-top-3 -left-3 cursor-nwse-resize", "-top-3 -right-3 cursor-nesw-resize", "-bottom-3 -left-3 cursor-nesw-resize", "-bottom-3 -right-3 cursor-nwse-resize"] as const).map(
              (place) => (
                <span
                  key={place}
                  role="button"
                  tabIndex={-1}
                  aria-label="Resize"
                  onPointerDown={(event) => onHandleDown(event, active.id, "scale")}
                  className={`pointer-events-auto absolute flex size-6 items-center justify-center ${place}`}
                >
                  <span className="size-3 border-2 border-cyan bg-night" />
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function inkFor(hex: string): string {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(value)) return "#f6f1ff";
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#141018" : "#f6f1ff";
}
