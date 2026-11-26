/**
 * The design chat. A shopper says what they want in plain words, the chat answers
 * with a short reply and a list of edits, and the studio applies those edits to the
 * real layers on the real blank. Pure: the edit list, its parser, the prompt, the
 * reducer that applies edits, and a no-AI reader for the simple asks.
 */
import type { DesignLayer } from "../pod/types.ts";
import { ART_STYLES, isArtStyle, type ArtStyleId } from "../ai/art-styles.ts";
import { findColors } from "../say/colors.ts";
import { clampFx } from "../text/layout.ts";
import { FONTS, FONT_NAMES } from "./fonts.ts";
import { MAX_LAYERS } from "./validate.ts";

/* ---------------------------------------------------------------- stamps */

/** Art drawn in code: free, sharp at any size, one colour. */
export const STAMPS = [
  { id: "chicago-skyline", label: "Chicago skyline", note: "wide city skyline silhouette, about 3.6 times wider than tall" },
  { id: "chicago-star", label: "Chicago star", note: "the six-pointed star from the Chicago flag, square" },
] as const;

export type StampId = (typeof STAMPS)[number]["id"];

export function isStamp(value: unknown): value is StampId {
  return STAMPS.some((stamp) => stamp.id === value);
}

/** Where a rendered stamp is looked up, so the reducer stays pure. */
export function stampKey(stamp: StampId, color: string): string {
  return `${stamp}|${color.toLowerCase()}`;
}

/* -------------------------------------------------------------- the edits */

type TextLook = {
  text?: string;
  font?: string;
  color?: string;
  arc?: number;
  outline?: boolean;
  /** A sticker outline round the letters. Null takes it off. */
  stroke?: string | null;
  tracking?: number;
};

type Place = { x?: number; y?: number; scale?: number; rotation?: number };

export type ChatOp =
  | ({ op: "add_text"; spot?: string; text: string } & Omit<TextLook, "text"> & Place)
  | ({ op: "edit"; layer: string } & TextLook & Place)
  | { op: "nudge"; layer: string; dx?: number; dy?: number; grow?: number; turn?: number }
  | { op: "remove"; layer: string }
  | { op: "clear"; spot?: string }
  | { op: "stack"; layer: string; to: "front" | "back" }
  | ({ op: "add_stamp"; spot?: string; stamp: StampId; color: string } & Place)
  | ({ op: "make_art"; spot?: string; idea: string; style: ArtStyleId } & Place)
  | { op: "set_color"; color: string }
  | { op: "set_blank"; blank: string }
  | { op: "show_spot"; spot: string };

export type ChatAnswer = { reply: string; ops: ChatOp[] };

export const MAX_OPS = 12;

const HEX = /^#[0-9a-f]{6}$/i;

function num(value: unknown, min: number, max: number): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function word(value: unknown, max = 80): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function hex(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (HEX.test(text)) return text.toLowerCase();
  const said = findColors(text)[0];
  return said ? said.hex : undefined;
}

/** A font the studio serves, matched loosely: "big shoulders" finds Big Shoulders Display. */
export function matchFont(value: unknown): string | undefined {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return undefined;
  const exact = FONT_NAMES.find((name) => name.toLowerCase() === text);
  if (exact) return exact;
  const byName = FONTS.find((font) => font.name.toLowerCase().includes(text) || text.includes(font.name.toLowerCase()));
  if (byName) return byName.name;
  return FONTS.find((font) => font.vibe.toLowerCase() === text)?.name;
}

function place(row: Record<string, unknown>): Place {
  const out: Place = {};
  const x = num(row.x, 0, 1);
  const y = num(row.y, 0, 1);
  const scale = num(row.scale, 0.15, 3);
  const rotation = num(row.rotation, -180, 180);
  if (x !== undefined) out.x = x;
  if (y !== undefined) out.y = y;
  if (scale !== undefined) out.scale = scale;
  if (rotation !== undefined) out.rotation = rotation;
  return out;
}

function look(row: Record<string, unknown>): TextLook {
  const out: TextLook = {};
  if (row.text != null) {
    const text = word(row.text);
    if (text) out.text = text;
  }
  const font = matchFont(row.font);
  if (font) out.font = font;
  const color = hex(row.color);
  if (color) out.color = color;
  const arc = num(row.arc, -120, 120);
  if (arc !== undefined) out.arc = arc;
  if (typeof row.outline === "boolean") out.outline = row.outline;
  if (row.stroke === null || row.stroke === false || row.stroke === "none") out.stroke = null;
  else {
    const stroke = hex(row.stroke);
    if (stroke) out.stroke = stroke;
  }
  const tracking = num(row.tracking, -0.05, 0.6);
  if (tracking !== undefined) out.tracking = tracking;
  return out;
}

/** One edit from the model, checked. Anything malformed is dropped, never guessed at. */
export function parseOp(input: unknown): ChatOp | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const spot = row.spot == null ? undefined : word(row.spot, 40) || undefined;
  const layer = word(row.layer, 40);
  switch (row.op) {
    case "add_text": {
      const text = word(row.text);
      if (!text) return null;
      const { text: _drop, ...rest } = look(row);
      return { op: "add_text", spot, text, ...rest, ...place(row) };
    }
    case "edit": {
      if (!layer) return null;
      const patch = { ...look(row), ...place(row) };
      return Object.keys(patch).length > 0 ? { op: "edit", layer, ...patch } : null;
    }
    case "nudge": {
      if (!layer) return null;
      const op: ChatOp = { op: "nudge", layer };
      const dx = num(row.dx, -1, 1);
      const dy = num(row.dy, -1, 1);
      const grow = num(row.grow, 0.2, 5);
      const turn = num(row.turn, -360, 360);
      if (dx !== undefined) op.dx = dx;
      if (dy !== undefined) op.dy = dy;
      if (grow !== undefined) op.grow = grow;
      if (turn !== undefined) op.turn = turn;
      return op;
    }
    case "remove":
      return layer ? { op: "remove", layer } : null;
    case "clear":
      return { op: "clear", spot };
    case "stack":
      return layer && (row.to === "front" || row.to === "back") ? { op: "stack", layer, to: row.to } : null;
    case "add_stamp": {
      if (!isStamp(row.stamp)) return null;
      return { op: "add_stamp", spot, stamp: row.stamp, color: hex(row.color) ?? "#141414", ...place(row) };
    }
    case "make_art": {
      const idea = word(row.idea, 240);
      if (!idea) return null;
      return { op: "make_art", spot, idea, style: isArtStyle(row.style) ? row.style : "ink", ...place(row) };
    }
    case "set_color": {
      const color = word(row.color, 40);
      return color ? { op: "set_color", color } : null;
    }
    case "set_blank": {
      const blank = word(row.blank, 60);
      return blank ? { op: "set_blank", blank } : null;
    }
    case "show_spot":
      return spot ? { op: "show_spot", spot } : null;
    default:
      return null;
  }
}

/** Reads the model's whole answer. Null when there is no usable JSON in it. */
export function parseAnswer(raw: string): ChatAnswer | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as { reply?: unknown; ops?: unknown };
  const ops: ChatOp[] = [];
  let art = 0;
  for (const entry of Array.isArray(record.ops) ? record.ops : []) {
    const op = parseOp(entry);
    if (!op) continue;
    // One paid picture a turn at most, and the shopper still has to say yes to it.
    if (op.op === "make_art" && ++art > 1) continue;
    ops.push(op);
    if (ops.length >= MAX_OPS) break;
  }
  const reply = word(record.reply, 400);
  if (!reply && ops.length === 0) return null;
  return { reply: reply || "Done.", ops };
}

/* ----------------------------------------------------- what the model sees */

export type LayerBrief = {
  id: string;
  kind: "text" | "art";
  text?: string;
  font?: string;
  color?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  arc?: number;
  outline?: boolean;
  stroke?: string;
};

export type ChatContext = {
  blank: { id: string; name: string; type: string };
  blanks: { id: string; name: string; type: string }[];
  color: string;
  colors: string[];
  placement: string;
  spots: { placement: string; title: string }[];
  selected: string;
  layers: Record<string, LayerBrief[]>;
};

export type ChatLine = { role: "user" | "assistant"; text: string };

const round = (value: number) => Math.round(value * 100) / 100;

export function briefLayer(layer: DesignLayer): LayerBrief {
  const base = { id: layer.id, x: round(layer.x), y: round(layer.y), scale: round(layer.scale), rotation: Math.round(layer.rotation) };
  if (layer.type === "image") return { ...base, kind: "art" };
  return {
    ...base,
    kind: "text",
    text: layer.text,
    font: layer.font,
    color: layer.color,
    ...(layer.arc ? { arc: layer.arc } : {}),
    ...(layer.outline ? { outline: true } : {}),
    ...(layer.stroke ? { stroke: layer.stroke } : {}),
  };
}

/** Trims whatever the browser sent to a bounded, well-formed context. */
export function cleanContext(input: unknown): ChatContext | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const pick = (value: unknown) => {
    const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return { id: word(row.id, 60), name: word(row.name, 80), type: word(row.type, 40) };
  };
  const blank = pick(raw.blank);
  if (!blank.id) return null;
  const spots = (Array.isArray(raw.spots) ? raw.spots : []).slice(0, 12).map((value) => {
    const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return { placement: word(row.placement, 40), title: word(row.title, 40) };
  }).filter((spot) => spot.placement);
  const layers: Record<string, LayerBrief[]> = {};
  const rawLayers = (raw.layers && typeof raw.layers === "object" ? raw.layers : {}) as Record<string, unknown>;
  for (const spot of spots) {
    const list = rawLayers[spot.placement];
    if (!Array.isArray(list)) continue;
    layers[spot.placement] = list.slice(0, MAX_LAYERS).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      const id = word(row.id, 40);
      if (!id) return [];
      const brief: LayerBrief = {
        id,
        kind: row.kind === "art" ? "art" : "text",
        x: num(row.x, 0, 1) ?? 0.5,
        y: num(row.y, 0, 1) ?? 0.5,
        scale: num(row.scale, 0.15, 3) ?? 1,
        rotation: num(row.rotation, -180, 180) ?? 0,
      };
      if (brief.kind === "text") {
        brief.text = word(row.text);
        brief.font = matchFont(row.font) ?? "Archivo Black";
        brief.color = hex(row.color) ?? "#ffffff";
        const arc = num(row.arc, -120, 120);
        if (arc) brief.arc = arc;
        if (row.outline === true) brief.outline = true;
        const stroke = hex(row.stroke);
        if (stroke) brief.stroke = stroke;
      }
      return [brief];
    });
  }
  return {
    blank,
    blanks: (Array.isArray(raw.blanks) ? raw.blanks : []).slice(0, 24).map(pick).filter((item) => item.id),
    color: word(raw.color, 40),
    colors: (Array.isArray(raw.colors) ? raw.colors : []).slice(0, 30).map((value) => word(value, 40)).filter(Boolean),
    placement: word(raw.placement, 40),
    spots,
    selected: word(raw.selected, 40),
    layers,
  };
}

export function cleanHistory(input: unknown): ChatLine[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-8)
    .flatMap((value): ChatLine[] => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const text = word(row.text, 400);
      return role && text ? [{ role, text }] : [];
    });
}

/** The standing instructions. Everything the model may do, and nothing it may invent. */
export function systemPrompt(): string {
  return [
    "You are the design chat inside a streetwear print-on-demand studio. The shopper describes changes in plain words, often casually; you make the edits.",
    "Every piece is a real Printful blank printed by DTG on the listed print spots. Only what is listed can be made: the listed blanks, their listed garment colours, text, code-drawn stamps and AI art on the listed spots.",
    "You cannot change the cut, sew panels, add embroidery, patches, rhinestones, glitter, puff ink or any colour of garment not listed. If asked, say so in one short line and offer the nearest thing you can do.",
    "Reply with JSON only: {\"reply\":\"\",\"ops\":[]}. reply is one or two short, warm, plain sentences, under 220 characters, no jargon, no emoji. Say what you changed.",
    "Positions: x and y run 0 to 1 across the print area of a spot, 0.5,0.5 is the middle, y 0 is the top. Text scale 1 sets letters 14% of the print area's height; long lines shrink to fit the width. Art scale 1 is 52% of the print area's width. Scale runs 0.15 to 3.",
    "Ops:",
    '{"op":"add_text","spot":"front","text":"","font":"","color":"#rrggbb","x":0.5,"y":0.3,"scale":1,"rotation":0,"arc":0,"tracking":0,"stroke":"#rrggbb"} adds words. arc bends the line in degrees (-120 to 120, negative arches up). tracking is letter spacing 0 to 0.6. stroke is a sticker outline colour. outline:true prints only the outline of the letters.',
    '{"op":"edit","layer":"<id>", ...any of text, font, color, x, y, scale, rotation, arc, tracking, outline, stroke} changes a layer. stroke:null takes the sticker outline off.',
    '{"op":"nudge","layer":"<id>","dx":0,"dy":-0.08,"grow":1.2,"turn":0} moves, grows (multiplies scale) or turns a layer relative to where it is. "Bigger" is grow 1.2 to 1.3, "a lot bigger" 1.6. "Up a bit" is dy -0.06.',
    '{"op":"remove","layer":"<id>"}, {"op":"clear","spot":"front"} empties a spot, {"op":"stack","layer":"<id>","to":"front|back"}.',
    `{"op":"add_stamp","spot":"back","stamp":"<id>","color":"#rrggbb","x":0.5,"y":0.4,"scale":1.6} adds free code-drawn art. Stamps: ${STAMPS.map((stamp) => `${stamp.id} (${stamp.note})`).join("; ")}. Prefer a stamp when one fits.`,
    `{"op":"make_art","spot":"front","idea":"","style":"<id>","y":0.45,"scale":1} asks for new AI art. It costs the shop money, so the shopper is asked before it runs; use it only when they want a new picture no stamp covers, at most once a turn, and say in reply that it needs their OK. idea is a short visual description. Styles: ${ART_STYLES.map((style) => `${style.id} (${style.label})`).join(", ")}.`,
    '{"op":"set_color","color":"<one of the listed garment colours>"} changes the garment colour. {"op":"set_blank","blank":"<blank id>"} switches to another listed blank; spots and colours then follow that blank. {"op":"show_spot","spot":"back"} brings a spot on screen.',
    "Use layer ids exactly as listed. \"It\" or \"the text\" means the selected layer, or the most recent matching layer. Keep text readable against the garment colour. Leave the rest of the design alone unless asked.",
    `Fonts: ${FONTS.map((font) => `${font.name} (${font.vibe})`).join(", ")}.`,
    "If the ask is unclear, make your best guess and say what you did; never ask more than one question.",
  ].join("\n");
}

/** The current design and the shopper's words, as the user message. */
export function turnPrompt(context: ChatContext, message: string): string {
  const spots = context.spots.map((spot) => {
    const list = context.layers[spot.placement] ?? [];
    return `- ${spot.placement} (${spot.title})${spot.placement === context.placement ? ", on screen" : ""}: ${list.length === 0 ? "empty" : JSON.stringify(list)}`;
  });
  return [
    `Blank: ${context.blank.name} (${context.blank.type}), id ${context.blank.id}, in ${context.color || "its first colour"}.`,
    `Garment colours for this blank: ${context.colors.join(", ") || "none listed"}.`,
    `Other blanks: ${context.blanks.filter((item) => item.id !== context.blank.id).map((item) => `${item.name} (${item.type}) id ${item.id}`).join("; ") || "none"}.`,
    `Selected layer: ${context.selected || "none"}.`,
    "Print spots and their layers (layers listed bottom first):",
    ...spots,
    `Shopper: ${message.replace(/\s+/g, " ").trim().slice(0, 500)}`,
  ].join("\n");
}

/* ------------------------------------------------------- applying the edits */

export type Canvas = {
  placement: string;
  /** Every spot's layers, the one on screen included. */
  spots: Record<string, DesignLayer[]>;
  selected: string;
};

export type ApplyOptions = {
  /** The print spots of the blank the edits land on. */
  placements: string[];
  /** Rendered stamps by `stampKey`. A stamp missing here is skipped. */
  stamps: Record<string, string>;
  newId: (kind: string) => string;
};

export type Applied = { canvas: Canvas; changed: number; skipped: string[] };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function resolveSpot(spot: string | undefined, canvas: Canvas, placements: string[]): string | null {
  if (!spot) return canvas.placement;
  if (placements.includes(spot)) return spot;
  const loose = spot.toLowerCase().replace(/[\s-]+/g, "_");
  const words = (value: string) => value.split("_").sort().join("_");
  return (
    placements.find((item) => item === loose) ??
    placements.find((item) => words(item) === words(loose)) ??
    placements.find((item) => loose.includes(item) || item.includes(loose)) ??
    null
  );
}

function findLayer(canvas: Canvas, ref: string): { spot: string; index: number } | null {
  const want = ref === "selected" || ref === "it" ? canvas.selected : ref;
  const order = [canvas.placement, ...Object.keys(canvas.spots).filter((spot) => spot !== canvas.placement)];
  for (const spot of order) {
    const index = (canvas.spots[spot] ?? []).findIndex((layer) => layer.id === want);
    if (index >= 0) return { spot, index };
  }
  return null;
}

function patchText(layer: DesignLayer, patch: TextLook & Place): DesignLayer {
  const next: Record<string, unknown> = { ...layer };
  for (const key of ["x", "y", "scale", "rotation"] as const) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  if (layer.type === "text") {
    if (patch.text) next.text = patch.text;
    if (patch.font) next.font = patch.font;
    if (patch.color) next.color = patch.color;
    const fx = clampFx({
      arc: patch.arc ?? layer.arc ?? 0,
      tracking: patch.tracking ?? layer.tracking ?? 0,
      outline: patch.outline ?? layer.outline ?? false,
    });
    for (const [key, value, off] of [
      ["arc", fx.arc, 0],
      ["tracking", fx.tracking, 0],
      ["outline", fx.outline, false],
    ] as const) {
      if (value === off) delete next[key];
      else next[key] = value;
    }
    if (patch.stroke === null) delete next.stroke;
    else if (patch.stroke) next.stroke = patch.stroke;
    if (next.outline) delete next.stroke;
  }
  return next as DesignLayer;
}

/**
 * Applies the layer edits. Blank, garment colour and paid art are the studio's to
 * handle first (they need the catalog or a yes); they pass through untouched here,
 * apart from `show_spot`, which moves the screen.
 */
export function applyOps(start: Canvas, ops: ChatOp[], options: ApplyOptions): Applied {
  let canvas: Canvas = { ...start, spots: { ...start.spots } };
  let changed = 0;
  const skipped: string[] = [];
  const spotList = (spot: string) => canvas.spots[spot] ?? [];
  const setSpot = (spot: string, layers: DesignLayer[]) => {
    canvas = { ...canvas, spots: { ...canvas.spots, [spot]: layers } };
  };
  const room = (spot: string) => {
    if (spotList(spot).length < MAX_LAYERS) return true;
    skipped.push(`The ${spot.replace(/_/g, " ")} already has eight layers.`);
    return false;
  };

  for (const op of ops) {
    switch (op.op) {
      case "add_text": {
        const spot = resolveSpot(op.spot, canvas, options.placements);
        if (!spot) {
          skipped.push(`This piece has no ${op.spot} to print on.`);
          break;
        }
        if (!room(spot)) break;
        const id = options.newId("text");
        const base: DesignLayer = {
          id,
          type: "text",
          text: op.text,
          font: op.font ?? "Archivo Black",
          color: op.color ?? "#ffffff",
          x: 0.5,
          y: spotList(spot).length === 0 ? 0.3 : 0.6,
          scale: 1,
          rotation: 0,
        };
        setSpot(spot, [...spotList(spot), patchText(base, op)]);
        canvas.selected = id;
        changed++;
        break;
      }
      case "add_stamp": {
        const spot = resolveSpot(op.spot, canvas, options.placements);
        const src = options.stamps[stampKey(op.stamp, op.color)];
        if (!spot) {
          skipped.push(`This piece has no ${op.spot} to print on.`);
          break;
        }
        if (!src || !room(spot)) break;
        const id = options.newId("img");
        setSpot(spot, [
          ...spotList(spot),
          {
            id,
            type: "image",
            src,
            x: op.x ?? 0.5,
            y: op.y ?? 0.45,
            scale: op.scale ?? 1,
            rotation: op.rotation ?? 0,
          },
        ]);
        canvas.selected = id;
        changed++;
        break;
      }
      case "edit":
      case "nudge":
      case "remove":
      case "stack": {
        const hit = findLayer(canvas, op.layer);
        if (!hit) {
          skipped.push("I lost track of which layer that was. Tap it and ask again.");
          break;
        }
        const list = [...spotList(hit.spot)];
        const layer = list[hit.index]!;
        if (op.op === "remove") {
          list.splice(hit.index, 1);
          if (canvas.selected === layer.id) canvas.selected = "";
        } else if (op.op === "stack") {
          list.splice(hit.index, 1);
          if (op.to === "front") list.push(layer);
          else list.unshift(layer);
        } else if (op.op === "edit") {
          const { op: _op, layer: _ref, ...patch } = op;
          list[hit.index] = patchText(layer, patch);
          canvas.selected = layer.id;
        } else {
          list[hit.index] = {
            ...layer,
            x: round(clamp(layer.x + (op.dx ?? 0), 0, 1)),
            y: round(clamp(layer.y + (op.dy ?? 0), 0, 1)),
            scale: round(clamp(layer.scale * (op.grow ?? 1), 0.15, 3)),
            rotation: Math.round(((((layer.rotation + (op.turn ?? 0) + 180) % 360) + 360) % 360) - 180),
          };
          canvas.selected = layer.id;
        }
        setSpot(hit.spot, list);
        changed++;
        break;
      }
      case "clear": {
        const spot = resolveSpot(op.spot, canvas, options.placements);
        if (!spot) break;
        if (spotList(spot).length > 0) changed++;
        setSpot(spot, []);
        if (spot === canvas.placement) canvas.selected = "";
        break;
      }
      case "show_spot": {
        const spot = resolveSpot(op.spot, canvas, options.placements);
        if (spot && spot !== canvas.placement) {
          canvas = { ...canvas, placement: spot, selected: spotList(spot).at(-1)?.id ?? "" };
          changed++;
        }
        break;
      }
      default:
        break;
    }
  }
  return { canvas, changed, skipped };
}

/** The stamps an edit list needs drawn before it can be applied. */
export function stampsNeeded(ops: ChatOp[]): { stamp: StampId; color: string }[] {
  const seen = new Map<string, { stamp: StampId; color: string }>();
  for (const op of ops) if (op.op === "add_stamp") seen.set(stampKey(op.stamp, op.color), { stamp: op.stamp, color: op.color });
  return [...seen.values()];
}

/** A garment colour from the blank's own list, matched by name or by how it looks. */
export function matchGarmentColor(
  wanted: string,
  colors: readonly { name: string; hex: string }[],
): { name: string; hex: string } | null {
  const text = wanted.trim().toLowerCase();
  if (!text) return null;
  const named =
    colors.find((color) => color.name.toLowerCase() === text) ??
    [...colors].sort((a, b) => b.name.length - a.name.length).find((color) => text.includes(color.name.toLowerCase()));
  if (named) return named;
  return null;
}

/* ---------------------------------------------------- the no-AI reader */

const BLANK_WORDS: [RegExp, string][] = [
  [/\bhood(ie|y)s?\b/, "hoodie"],
  [/\b(crew ?neck|sweatshirt|crew)\b/, "crewneck"],
  [/\blong ?sleeve\b/, "long-sleeve"],
  [/\b(sweat ?pants|joggers?|pants)\b/, "sweatpants"],
  [/\btote( bag)?\b/, "tote"],
  [/\b(tee|t-?shirt|shirt)\b/, "tee"],
];

const SPOT_WORDS: [RegExp, string][] = [
  [/\bleft sleeve\b/, "sleeve_left"],
  [/\bright sleeve\b/, "sleeve_right"],
  [/\bsleeves?\b/, "sleeve_left"],
  [/\b(back|behind)\b/, "back"],
  [/\b(front|chest)\b/, "front"],
];

const FONT_WORDS: [RegExp, string][] = [
  [/\bbig shoulders|chicago font|chicago type\b/, "Big Shoulders Display"],
  [/\bold english|blackletter\b/, "UnifrakturCook"],
  [/\bgothic\b/, "Pirata One"],
  [/\b(graffiti|marker|handwrit)/, "Permanent Marker"],
  [/\bstencil|military\b/, "Black Ops One"],
  [/\bneon\b/, "Monoton"],
  [/\bscript|cursive\b/, "Shrikhand"],
  [/\b(tall|skinny|condensed)\b/, "Anton"],
  [/\bwide\b/, "Rubik Mono One"],
];

export type LocalDesign = {
  canvas: Canvas;
  blank: { id: string; name: string; type: string };
  blanks: { id: string; name: string; type: string }[];
  colors: readonly { name: string; hex: string }[];
};

/**
 * Reads the simple asks with no model behind it: colours, size, moves, words,
 * fonts, spots, the stamps. Free, instant, and the only reader when signed out.
 * Null when it does not understand.
 */
export function localAnswer(message: string, design: LocalDesign): ChatAnswer | null {
  const text = ` ${message.toLowerCase().replace(/[’']/g, "'")} `;
  const ops: ChatOp[] = [];
  const said: string[] = [];
  const quoted = /["“]([^"”]{1,80})["”]/.exec(message)?.[1]?.trim();
  const spotWord = SPOT_WORDS.find(([pattern]) => pattern.test(text))?.[1];
  const onScreen = design.canvas.spots[design.canvas.placement] ?? [];
  const target =
    onScreen.find((layer) => layer.id === design.canvas.selected) ??
    [...onScreen].reverse().find((layer) => layer.type === "text") ??
    onScreen.at(-1);

  // The garment itself: "make the hoodie black", "black crewneck".
  const blankWord = BLANK_WORDS.find(([pattern]) => pattern.test(text))?.[1];
  const garmentTalk = Boolean(blankWord) || /\b(garment|blank|base colou?r|the piece)\b/.test(text);
  if (blankWord) {
    const blank = design.blanks.find((item) => `${item.name} ${item.type}`.toLowerCase().includes(blankWord));
    if (blank && blank.id !== design.blank.id) {
      ops.push({ op: "set_blank", blank: blank.id });
      said.push(`switched to the ${blank.name}`);
    }
  }
  if (garmentTalk) {
    const color = matchGarmentColor(text, design.colors);
    const asked = findColors(text)[0]?.word;
    if (color) {
      ops.push({ op: "set_color", color: color.name });
      said.push(`made it ${color.name}`);
    } else if (asked) {
      // Not a colour this blank comes in: the studio answers with the ones it does.
      ops.push({ op: "set_color", color: asked });
    }
  }

  // Stamps.
  const stampColor = findColors(text.replace(/\b(the )?(hoodie|tee|shirt|crewneck|blank|garment)\b.*$/, ""))[0]?.hex ?? "#e0182d";
  if (/\bskyline\b/.test(text)) {
    ops.push({ op: "add_stamp", spot: spotWord ?? design.canvas.placement, stamp: "chicago-skyline", color: stampColor, y: 0.42, scale: 1.7 });
    said.push("drew the Chicago skyline");
  }
  if (/\bstar\b/.test(text)) {
    ops.push({ op: "add_stamp", spot: spotWord ?? design.canvas.placement, stamp: "chicago-star", color: stampColor, y: 0.72, scale: 0.35 });
    said.push("added the Chicago star");
  }

  // New words: quoted, or "say / write / add text ...".
  const words = quoted ?? /\b(?:say|says|write|add(?: the)? (?:text|words?))\s+(.{1,80}?)\s*(?:on the|in |$)/.exec(text)?.[1]?.trim();
  const font = FONT_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? matchFont(/\bfont\s+(\w[\w ]*)/.exec(text)?.[1]);
  const inkHits = garmentTalk ? [] : findColors(text);
  const ink = inkHits[0]?.hex;
  const outline = /\b(white|black|red)? ?(sticker )?outline\b/.test(text) ? (findColors(/(\w+) (sticker )?outline/.exec(text)?.[1] ?? "")[0]?.hex ?? "#ffffff") : undefined;

  if (words && !/\b(change|make) (it|the text)\b/.test(text)) {
    ops.push({
      op: "add_text",
      spot: spotWord ?? design.canvas.placement,
      text: words.toUpperCase() === words ? words : words.toUpperCase(),
      ...(font ? { font } : {}),
      color: ink ?? "#ffffff",
      ...(outline ? { stroke: outline } : {}),
    });
    said.push(`wrote ${words.toUpperCase()}`);
  } else if (target) {
    const patch: TextLook & Place = {};
    if (words) patch.text = words;
    if (font && target.type === "text") patch.font = font;
    if (ink && target.type === "text" && !/\bskyline|star\b/.test(text)) patch.color = ink;
    if (outline && target.type === "text") patch.stroke = outline;
    if (/\b(no|remove the|take off the) outline\b/.test(text)) patch.stroke = null;
    if (/\b(curve|arch|bend)\b/.test(text)) patch.arc = -40;
    if (/\bstraight(en)?\b/.test(text)) patch.arc = 0;
    if (/\b(spread|space) (it )?out\b/.test(text)) patch.tracking = 0.2;
    if (/\b(center|centre|middle)\b/.test(text)) patch.x = 0.5;
    if (Object.keys(patch).length > 0) {
      ops.push({ op: "edit", layer: target.id, ...patch });
      const bits: string[] = [];
      if (patch.text) bits.push(`changed the words to ${patch.text}`);
      if (patch.color) bits.push(`made it ${inkHits[0]?.word ?? "that colour"}`);
      if (patch.font) bits.push(`set it in ${patch.font}`);
      if (patch.stroke) bits.push("gave it an outline");
      if (patch.stroke === null) bits.push("took the outline off");
      if (patch.arc) bits.push("curved it");
      if (patch.arc === 0) bits.push("straightened it");
      if (patch.tracking) bits.push("spread the letters out");
      if (patch.x === 0.5) bits.push("centred it");
      said.push(...bits);
    }
    const big = /\b(a lot|much|way) (bigger|larger)\b/.test(text) ? 1.6 : /\b(bigger|larger|grow)\b/.test(text) ? 1.25 : /\b(a lot|much|way) smaller\b/.test(text) ? 0.6 : /\b(smaller|shrink|tinier)\b/.test(text) ? 0.8 : 1;
    const step = /\b(a lot|way|much)\b/.test(text) ? 0.15 : 0.07;
    const dy = /\b(up|higher|raise)\b/.test(text) ? -step : /\b(down|lower)\b/.test(text) ? step : 0;
    const dx = /\bleft\b(?! sleeve)/.test(text) ? -step : /\bright\b(?! sleeve)/.test(text) ? step : 0;
    const turn = /\b(tilt|rotate|turn|angle)\b/.test(text) ? (/\bstraight|level\b/.test(text) ? -target.rotation : -8) : 0;
    if (big !== 1 || dx || dy || turn) {
      ops.push({ op: "nudge", layer: target.id, ...(big !== 1 ? { grow: big } : {}), ...(dx ? { dx } : {}), ...(dy ? { dy } : {}), ...(turn ? { turn } : {}) });
      if (big !== 1) said.push(big > 1 ? "made it bigger" : "made it smaller");
      if (dx || dy) said.push(`moved it ${[dy < 0 ? "up" : dy > 0 ? "down" : "", dx < 0 ? "left" : dx > 0 ? "right" : ""].filter(Boolean).join(" and ")}`);
      if (turn) said.push("tilted it");
    }
    if (/\b(delete|remove|get rid of|take off|lose)\b(?! (the )?outline)/.test(text)) {
      ops.push({ op: "remove", layer: target.id });
      said.push("took it off");
    }
  }

  if (spotWord && ops.length === 0) {
    ops.push({ op: "show_spot", spot: spotWord });
    said.push(`opened the ${spotWord.replace(/_/g, " ").replace("sleeve left", "left sleeve")}`);
  } else if (spotWord && ops.some((op) => op.op === "add_text" || op.op === "add_stamp")) {
    ops.push({ op: "show_spot", spot: spotWord });
  }

  if (ops.length === 0) return null;
  if (said.length === 0) return { reply: "Not that one.", ops };
  const sentence = said.length > 1 ? `${said.slice(0, -1).join(", ")} and ${said.at(-1)}` : said[0]!;
  return { reply: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`, ops };
}

/* ------------------------------------------------------ the showcase */

export const CHEY_RED = "#e0182d";
export const CHEY_BONE = "#f2ece4";

export type DemoTurn = { user: string; reply: string; ops: ChatOp[] };

/**
 * The worked example: a Chey Society hoodie built in four messages. Scripted, so it
 * is free and the same every time, and it runs through the same edits the chat makes.
 */
export function cheyDemo(blankId: string): DemoTurn[] {
  return [
    {
      user: "Make me a Chey Society piece. Black hoodie, CHEY SOCIETY in red across the chest. Chicago feel.",
      reply: "Black hoodie, CHEY stacked over SOCIETY in Chey red, set in Big Shoulders, the type on old Chicago posters.",
      ops: [
        { op: "set_blank", blank: blankId },
        { op: "set_color", color: "Black" },
        { op: "show_spot", spot: "front" },
        { op: "clear", spot: "front" },
        { op: "add_text", spot: "front", text: "CHEY", font: "Big Shoulders Display", color: CHEY_RED, y: 0.38, scale: 2.4, tracking: 0.04 },
        { op: "add_text", spot: "front", text: "SOCIETY", font: "Big Shoulders Display", color: CHEY_RED, y: 0.66, scale: 1, tracking: 0.34 },
      ],
    },
    {
      user: "Put the Chicago skyline on the back in red, with the star under it.",
      reply: "Skyline across the shoulders and the Chicago flag star under it, both in Chey red. Drawn in code, so it costs nothing and prints sharp.",
      ops: [
        { op: "show_spot", spot: "back" },
        { op: "clear", spot: "back" },
        { op: "add_stamp", spot: "back", stamp: "chicago-skyline", color: CHEY_RED, y: 0.26, scale: 1.85 },
        { op: "add_stamp", spot: "back", stamp: "chicago-star", color: CHEY_RED, y: 0.5, scale: 0.34 },
        { op: "add_text", spot: "back", text: "EST. CHICAGO", font: "Big Shoulders Display", color: CHEY_BONE, y: 0.68, scale: 0.6, tracking: 0.4 },
      ],
    },
    {
      user: "Little star on the left sleeve too.",
      reply: "Small red star on the left sleeve. Every spot with art prints, so this piece prints front, back and sleeve.",
      ops: [
        { op: "add_stamp", spot: "sleeve_left", stamp: "chicago-star", color: CHEY_RED, y: 0.2, scale: 1.7 },
        { op: "show_spot", spot: "sleeve_left" },
      ],
    },
    {
      user: "Back to the front. Make CHEY bigger and give it a bone outline.",
      reply: "CHEY is bigger now with a bone sticker outline, so it jumps off the black.",
      ops: [
        { op: "show_spot", spot: "front" },
        { op: "nudge", layer: "@CHEY", grow: 1.12, dy: -0.06 },
        { op: "edit", layer: "@CHEY", stroke: CHEY_BONE },
      ],
    },
  ];
}

/** Demo ops can point at a layer by its words ("@CHEY"), since its id is made at run time. */
export function resolveWordRefs(ops: ChatOp[], canvas: Canvas): ChatOp[] {
  return ops.map((op) => {
    if (!("layer" in op) || !op.layer.startsWith("@")) return op;
    const words = op.layer.slice(1);
    for (const list of Object.values(canvas.spots)) {
      const hit = list.find((layer) => layer.type === "text" && layer.text === words);
      if (hit) return { ...op, layer: hit.id };
    }
    return op;
  });
}
