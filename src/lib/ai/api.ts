import { createServerFn } from "@tanstack/react-start";
import {
  localCritique,
  localCrowd,
  localLines,
  localLookName,
  localPrintNote,
  parseCritique,
  parseCrowd,
  parseLines,
  parseLookName,
  parsePrintNote,
  parseTerms,
  searchTerms,
} from "@/lib/ai/local";

export const critiqueOutfit = createServerFn({ method: "POST" })
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 400),
  }))
  .handler(async ({ data }) => {
    const fallback = localCritique(data.spoken);
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `You are the crown critic for a streetwear look. Reply with JSON only: {"verdict":"","note":"","next":""}. verdict is under 8 words, note is one sentence, next is the single garment to add. Look: ${data.spoken || "nothing"}`,
      160,
    );
    const parsed = raw ? parseCritique(raw) : null;
    return { ...(parsed ?? fallback), source: parsed ? ("grok" as const) : ("local" as const) };
  });

export const suggestLines = createServerFn({ method: "POST" })
  .validator((input: { seed?: string } | undefined) => ({
    seed: String(input?.seed ?? "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const fallback = localLines(data.seed);
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `Write 3 short streetwear lines for a shirt print, one per line, no quotes, under 24 characters. Theme: ${data.seed || "night"}.`,
      80,
    );
    const parsed = raw ? parseLines(raw) : [];
    return {
      lines: parsed.length > 0 ? parsed : fallback,
      source: parsed.length > 0 ? ("grok" as const) : ("local" as const),
    };
  });

export const nameLook = createServerFn({ method: "POST" })
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 240),
  }))
  .handler(async ({ data }) => {
    const fallback = localLookName(data.spoken);
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `Name this outfit in 2 or 3 words, no quotes, no punctuation. Outfit: ${data.spoken || "empty"}`,
      24,
    );
    const name = raw ? parseLookName(raw) : null;
    return { name: name ?? fallback, source: name ? ("grok" as const) : ("local" as const) };
  });

export const printNote = createServerFn({ method: "POST" })
  .validator((input: { placement?: string; product?: string } | undefined) => ({
    placement: String(input?.placement ?? "front").slice(0, 40),
    product: String(input?.product ?? "piece").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const fallback = localPrintNote(data.placement, data.product);
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `One sentence of practical print advice for a ${data.placement} graphic on a ${data.product}. No hashtags.`,
      80,
    );
    const note = raw ? parsePrintNote(raw) : null;
    return { note: note ?? fallback, source: note ? ("grok" as const) : ("local" as const) };
  });

export const pickCrowd = createServerFn({ method: "POST" })
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 240),
  }))
  .handler(async ({ data }) => {
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `Should the runway crowd cheer, boo, or both for this outfit? Reply with one word: cheer, boo, or both. Outfit: ${data.spoken || "unknown"}`,
      8,
    );
    const crowd = raw ? parseCrowd(raw) : null;
    return { crowd: crowd ?? localCrowd(), source: crowd ? ("grok" as const) : ("local" as const) };
  });

export const vibeTerms = createServerFn({ method: "POST" })
  .validator((input: { query?: string } | undefined) => ({
    query: String(input?.query ?? "").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const fallback = searchTerms(data.query);
    if (!data.query.trim()) return { terms: [] as string[], source: "local" as const };
    const { completeText } = await import("./grok.server.ts");
    const raw = await completeText(
      `Turn this shop search into up to 4 product words a catalog title might contain (tee, hoodie, hat, dress, pink, black). Comma-separated, no sentences. Query: ${data.query}`,
      40,
    );
    const parsed = raw ? parseTerms(raw) : [];
    return {
      terms: parsed.length > 0 ? parsed : fallback,
      source: parsed.length > 0 ? ("grok" as const) : ("local" as const),
    };
  });
