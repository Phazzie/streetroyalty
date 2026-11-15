import { create } from "zustand";
import { MAX_BAG_LINES, MAX_LINE_QUANTITY, type BagLine } from "./types.ts";

/** Pure bag maths. The store below is a thin shell over these. */

export function addLine(lines: BagLine[], line: BagLine): BagLine[] {
  const quantity = clampQuantity(line.quantity);
  const index = lines.findIndex((item) => item.variantId === line.variantId);
  if (index >= 0) {
    return lines.map((item, at) =>
      at === index ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item,
    );
  }
  if (lines.length >= MAX_BAG_LINES) return lines;
  return [...lines, { ...line, quantity }];
}

export function setLineQuantity(lines: BagLine[], variantId: string, quantity: number): BagLine[] {
  if (!Number.isFinite(quantity) || quantity < 1)
    return lines.filter((item) => item.variantId !== variantId);
  return lines.map((item) =>
    item.variantId === variantId ? { ...item, quantity: clampQuantity(quantity) } : item,
  );
}

export function bagCount(lines: BagLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function bagSubtotalCents(lines: BagLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.round(quantity)));
}

/** Reads a stored bag back defensively. Anything malformed is dropped. */
export function parseStoredBag(raw: string | null): BagLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const lines: BagLine[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const priceCents = Number(row.priceCents);
    if (
      typeof row.variantId !== "string" ||
      typeof row.slug !== "string" ||
      typeof row.name !== "string"
    )
      continue;
    if (!Number.isFinite(priceCents) || priceCents < 0) continue;
    lines.push({
      variantId: row.variantId,
      slug: row.slug,
      name: row.name,
      variantLabel: typeof row.variantLabel === "string" ? row.variantLabel : "",
      priceCents: Math.round(priceCents),
      imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : "",
      quantity: clampQuantity(Number(row.quantity)),
    });
    if (lines.length >= MAX_BAG_LINES) break;
  }
  return lines;
}

const KEY = "sr-bag-v1";
const SENT_KEY = "sr-bag-sent";

type BagState = {
  lines: BagLine[];
  open: boolean;
  hydrated: boolean;
  /** True after these lines were handed to the hosted checkout. The bag cannot know if the order went through. */
  sent: boolean;
  markSent: () => void;
  hydrate: () => void;
  add: (line: BagLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

function save(lines: BagLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // A full or blocked store only costs the bag its memory between visits.
  }
}

function clearSent() {
  try {
    localStorage.removeItem(SENT_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const useBag = create<BagState>((set, get) => ({
  lines: [],
  open: false,
  hydrated: false,
  sent: false,
  markSent: () => {
    try {
      localStorage.setItem(SENT_KEY, "1");
    } catch {
      // Without storage the note simply will not be there after the trip to checkout.
    }
    set({ sent: true });
  },
  hydrate: () => {
    if (get().hydrated) return;
    let lines: BagLine[] = [];
    let sent = false;
    try {
      lines = parseStoredBag(localStorage.getItem(KEY));
      sent = localStorage.getItem(SENT_KEY) === "1";
    } catch {
      lines = [];
    }
    set({ lines, sent: sent && lines.length > 0, hydrated: true });
  },
  add: (line) => {
    const lines = addLine(get().lines, line);
    save(lines);
    clearSent();
    set({ lines, open: true, sent: false });
  },
  setQuantity: (variantId, quantity) => {
    const lines = setLineQuantity(get().lines, variantId, quantity);
    save(lines);
    set({ lines });
  },
  remove: (variantId) => {
    const lines = get().lines.filter((item) => item.variantId !== variantId);
    save(lines);
    set({ lines });
  },
  clear: () => {
    save([]);
    clearSent();
    set({ lines: [], sent: false });
  },
  setOpen: (open) => set({ open }),
}));
