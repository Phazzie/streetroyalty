import { CATEGORIES, type Category, type PieceDraft, type Reaction, type View } from "./types.ts";

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
    words: [
      "jean jacket",
      "denim jacket",
      "leather jacket",
      "overcoat",
      "cardigan",
      "trench",
      "bomber",
      "parka",
      "blazer",
      "puffer",
      "jacket",
      "coat",
    ],
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
      "skirt",
      "skirts",
      "jean",
      "slack",
    ],
  },
  {
    category: "Tops",
    words: [
      "tank top",
      "crop top",
      "tube top",
      "polo shirt",
      "t-shirt",
      "tshirt",
      "hoodie",
      "sweater",
      "jumper",
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
  for (const phrase of SKIP_PHRASES) {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi");
    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      for (let i = index; i < index + match[0].length; i += 1) taken[i] = true;
    }
  }
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

const SKIP_PHRASES = ["short sleeve", "short-sleeve", "boot cut", "boot-cut", "bootcut"];

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
  for (let pass = 0; pass < 4; pass += 1) {
    next = next
      .replace(/^[\s,;]+/, "")
      .replace(/[\s,;]+$/, "")
      .replace(/^(and|plus|tucked into|paired with|add|also)\s+/i, "")
      .replace(/\s+(and|plus|tucked into|paired with)$/i, "")
      .replace(/^(a|an|the)\s+/i, "")
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
  return mergeCompounds(text, pieces);
}

function separated(text: string, left: string, right: string): boolean {
  const lower = text.toLowerCase();
  const leftAt = lower.indexOf(left.toLowerCase());
  if (leftAt < 0) return true;
  const rightAt = lower.indexOf(right.toLowerCase(), leftAt + left.length);
  if (rightAt < 0) return true;
  const between = lower.slice(leftAt + left.length, rightAt);
  return /[,;]|\band\b|\bplus\b|\bwith\b|\bpaired\b|\btucked\b/.test(between);
}

function mergeCompounds(text: string, pieces: PieceDraft[]): PieceDraft[] {
  const merged: PieceDraft[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    const compound = prev && prev.category === piece.category && !separated(text, prev.spoken, piece.spoken);
    if (prev && compound) {
      if (!prev.spoken.toLowerCase().includes(piece.spoken.toLowerCase())) {
        prev.spoken = cleanEdge(`${prev.spoken} ${piece.spoken}`);
      }
      continue;
    }
    merged.push({ ...piece });
  }
  return merged;
}

const EDIT_WORDS =
  /\b(make|shorter|longer|darker|lighter|looser|tighter|bigger|smaller|change|without|lose|less|more|tweak)\b/i;

const CHATTER =
  /^(y(es|eah|ep)|no|nah|ok(ay)?|nice|cool|wow|fire|dope|sick|good|great|perfect|thanks|thank you|slay|bet|word|lit|hard|clean|sharp|beautiful|gorgeous|love it|love this|love that|looks good|looks great|so good|so fire|i like it|i love it|hell yeah|hello|hi|hey)[.!?\s]*$/i;

/** A look-screen line is a paid edit only when it asks for a change. */
export function isLookChange(transcript: string): boolean {
  const text = transcript.trim();
  if (!text || CHATTER.test(text)) return false;
  if (EDIT_WORDS.test(text)) return true;
  return text.length >= 12;
}

export type PaidPlan =
  | { kind: "pieces"; pieces: PieceDraft[] }
  | { kind: "tweak" }
  | { kind: "wear" }
  | { kind: "runway"; reaction?: Reaction }
  | { kind: "again" }
  | { kind: "free" };

export function paidPlan(transcript: string, view: View): PaidPlan {
  const intent = interpret(transcript);
  if (intent.type === "again") return { kind: "again" };
  if (intent.type === "runway") return { kind: "runway", reaction: intent.reaction };
  if (intent.type === "wear") return { kind: "wear" };
  if (view === "look" && intent.type === "pieces") {
    if (!EDIT_WORDS.test(transcript)) return { kind: "pieces", pieces: intent.pieces };
    return { kind: "tweak" };
  }
  if (view === "look" && intent.type === "unclear") {
    return isLookChange(transcript) ? { kind: "tweak" } : { kind: "free" };
  }
  if (intent.type === "pieces") return { kind: "pieces", pieces: intent.pieces };
  return { kind: "free" };
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
