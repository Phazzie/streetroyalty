export type Critique = {
  verdict: string;
  note: string;
  next: string;
};

export function localCritique(spoken: string): Critique {
  const text = spoken.trim();
  if (!text) {
    return {
      verdict: "Nothing on yet",
      note: "Name a piece and put it on before asking the crown.",
      next: "A black hoodie",
    };
  }
  const lower = text.toLowerCase();
  const hasShoes = /\b(shoe|sneaker|boot|loafer|heel|sandal)\b/.test(lower);
  const hasOuter = /\b(coat|jacket|hoodie|trench|suit|blazer)\b/.test(lower);
  const hasDress = /\b(dress|gown|jumpsuit)\b/.test(lower);
  const next = hasDress
    ? "A shoe with a quiet heel"
    : !hasShoes
      ? "Shoes that meet the hem"
      : !hasOuter
        ? "A coat with a hard shoulder"
        : "A hat that does not shout";
  return {
    verdict: text.length > 48 ? "That is a full look" : "It is a start",
    note: `On you now: ${text.slice(0, 180)}.`,
    next,
  };
}

export function parseCritique(raw: string): Critique | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const body = JSON.parse(raw.slice(start, end + 1)) as {
      verdict?: unknown;
      note?: unknown;
      next?: unknown;
    };
    const verdict = String(body.verdict ?? "").trim().slice(0, 80);
    const note = String(body.note ?? "").trim().slice(0, 240);
    const next = String(body.next ?? "").trim().slice(0, 80);
    if (!verdict || !note || !next) return null;
    return { verdict, note, next };
  } catch {
    return null;
  }
}

export function localLines(seed: string): string[] {
  const word = seed.replace(/[^\p{L}\p{N} ]/gu, "").trim().slice(0, 18) || "NIGHT";
  return [word.toUpperCase(), "CROWN ON", "NO CURFEW"];
}

export function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => line.slice(0, 32));
}

export function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 6);
}

export function parseTerms(raw: string): string[] {
  return searchTerms(raw.replaceAll(",", " "));
}

export function filterByTerms<T>(items: readonly T[], terms: readonly string[], textOf: (item: T) => string): T[] {
  if (terms.length === 0) return [...items];
  return items.filter((item) => {
    const text = textOf(item).toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}
