import { CATEGORIES, type Category, type PieceDraft, type Reaction } from "@/lib/types";

const LEX: { category: Category; words: string[] }[] = [
  {
    category: "Hats",
    words: ["bucket hat", "beanie", "fedora", "durag", "headwrap", "beret", "hat", "cap"],
  },
  {
    category: "Shoes",
    words: [
      "sneakers",
      "sneaker",
      "loafers",
      "loafer",
      "boots",
      "boot",
      "heels",
      "heel",
      "sandals",
      "sandal",
      "trainers",
      "trainer",
      "jordans",
      "jordan",
      "shoes",
      "shoe",
    ],
  },
  {
    category: "Outer",
    words: ["overcoat", "trench", "bomber", "parka", "blazer", "puffer", "jacket", "coat"],
  },
  {
    category: "Bottoms",
    words: [
      "trousers",
      "trouser",
      "pants",
      "jeans",
      "joggers",
      "jogger",
      "cargos",
      "cargo",
      "slacks",
      "shorts",
      "short",
      "jean",
      "slack",
    ],
  },
  {
    category: "Tops",
    words: [
      "t-shirt",
      "tshirt",
      "hoodie",
      "sweater",
      "jersey",
      "blouse",
      "shirt",
      "polo",
      "tank",
      "vest",
      "tee",
      "top",
      "tops",
    ],
  },
  {
    category: "Accessories",
    words: [
      "sunglasses",
      "glasses",
      "bracelet",
      "earrings",
      "earring",
      "necklace",
      "pendant",
      "gloves",
      "glove",
      "chain",
      "watch",
      "scarf",
      "belt",
      "ring",
      "rings",
      "bag",
      "cuff",
    ],
  },
];

export type Intent =
  | { type: "stop" }
  | { type: "again" }
  | { type: "save" }
  | { type: "wear" }
  | { type: "runway"; reaction?: Reaction }
  | { type: "reaction"; reaction: Reaction }
  | { type: "pieces"; pieces: PieceDraft[]; thenWear: boolean; transcript: string }
  | { type: "unclear" };

type Hit = { index: number; length: number; category: Category };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHits(text: string): Hit[] {
  const entries = LEX.flatMap((entry) =>
    entry.words.map((word) => ({ word, category: entry.category })),
  ).sort((a, b) => b.word.length - a.word.length);
  const taken = new Array<boolean>(text.length).fill(false);
  const hits: Hit[] = [];
  for (const entry of entries) {
    const re = new RegExp(`\\b${escapeRegExp(entry.word)}\\b`, "gi");
    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      const length = match[0].length;
      if (taken.slice(index, index + length).some(Boolean)) continue;
      for (let i = index; i < index + length; i += 1) taken[i] = true;
      hits.push({ index, length, category: entry.category });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  return hits;
}

const SEPARATORS = [",", ";", " and ", " plus ", " tucked into ", " paired with "];

function boundaryBefore(text: string, matchIndex: number, prevStart: number, prevEnd: number): number {
  const slice = text.slice(prevStart, matchIndex);
  const lower = slice.toLowerCase();
  let rel = -1;
  let sepLen = 0;
  for (const sep of SEPARATORS) {
    const at = lower.lastIndexOf(sep);
    if (at > rel) {
      rel = at;
      sepLen = sep.length;
    }
  }
  if (rel >= 0) return prevStart + rel + sepLen;
  const gap = text.slice(prevEnd, matchIndex).trim();
  const words = gap.length > 0 ? gap.split(/\s+/) : [];
  if (words.length === 0) return matchIndex;
  const give = Math.ceil(words.length / 2);
  const head = words.slice(0, words.length - give).join(" ");
  const tail = words.slice(words.length - give).join(" ");
  const tailAt = text.toLowerCase().lastIndexOf(tail.toLowerCase(), matchIndex);
  if (tailAt >= prevEnd) return tailAt;
  return prevEnd + (head.length > 0 ? head.length + 1 : 0);
}

function cleanEdge(value: string): string {
  let next = value.trim();
  for (let pass = 0; pass < 3; pass += 1) {
    next = next
      .replace(/^[\s,;]+/, "")
      .replace(/[\s,;]+$/, "")
      .replace(/^(and|plus|tucked into|paired with)\s+/i, "")
      .replace(/\s+(and|plus|tucked into|paired with)$/i, "")
      .trim();
  }
  return next;
}

export function splitPieces(transcript: string): PieceDraft[] {
  const text = transcript.trim();
  if (!text) return [];
  const hits = findHits(text);
  if (hits.length === 0) return [];
  if (hits.length === 1) {
    const spoken = cleanEdge(text);
    return spoken ? [{ category: hits[0].category, spoken }] : [];
  }
  const limited = hits.slice(0, 4);
  const starts = [0];
  for (let i = 1; i < limited.length; i += 1) {
    const prev = limited[i - 1];
    starts.push(boundaryBefore(text, limited[i].index, starts[i - 1], prev.index + prev.length));
  }
  const pieces: PieceDraft[] = [];
  for (let i = 0; i < limited.length; i += 1) {
    const end = i + 1 < limited.length ? starts[i + 1] : text.length;
    let spoken = cleanEdge(text.slice(starts[i], end));
    if (i === limited.length - 1 && hits.length > limited.length) {
      spoken = cleanEdge(text.slice(starts[i]));
    }
    if (!spoken) continue;
    if (!text.toLowerCase().includes(spoken.toLowerCase())) continue;
    pieces.push({ category: limited[i].category, spoken });
  }
  return pieces;
}

function reactionIn(text: string): Reaction | undefined {
  const lower = text.toLowerCase();
  const boo = /\bboo/.test(lower);
  const cheer = /\bcheer/.test(lower);
  if (boo && cheer) return "both";
  if (/\bboth\b|\bsplit\b/.test(lower)) return "both";
  if (boo) return "boo";
  if (cheer) return "cheer";
  return undefined;
}

export function interpret(transcript: string): Intent {
  const text = transcript.trim();
  if (!text) return { type: "unclear" };
  if (/^(stop|cancel|quiet|cut it|shut up)\b/i.test(text)) return { type: "stop" };
  if (text.length < 42 && /\b(try again|run it back|redo that|redo it|redo)\b/i.test(text)) {
    return { type: "again" };
  }
  if (text.length < 42 && /\b(save this|save it|keep this|keep it)\b/i.test(text)) {
    return { type: "save" };
  }
  const reactionOnly = text.match(/^(boo|boos|boo them|cheer|cheers|cheer them|both|split them)$/i);
  if (reactionOnly) {
    return { type: "reaction", reaction: reactionIn(text) ?? "both" };
  }
  if (text.length < 80 && /\b(runway|walk it|send it down)\b/i.test(text)) {
    return { type: "runway", reaction: reactionIn(text) };
  }
  const pieces = splitPieces(text);
  const wear =
    /\b(put it on( me)?|put them on|wear it|wear that)\b/i.test(text) ||
    (text.length < 32 && /\brun it\b/i.test(text));
  if (pieces.length > 0) {
    return { type: "pieces", pieces, thenWear: wear, transcript: text };
  }
  if (wear) return { type: "wear" };
  return { type: "unclear" };
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
