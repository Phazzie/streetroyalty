import { createServerFn } from "@tanstack/react-start";
import { localCritique, localLines, parseCritique, parseLines, parseTerms, searchTerms } from "@/lib/ai/local";

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
