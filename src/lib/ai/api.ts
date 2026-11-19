import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";
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
import { localPlan, parsePlan, planPrompt } from "@/lib/ai/stylist";

export const critiqueOutfit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 400),
  }))
  .handler(async ({ data, context }) => {
    const fallback = localCritique(data.spoken);
    if (!data.spoken.trim()) return { ...fallback, source: "local" as const };
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `You are the crown critic for a streetwear look. Reply with JSON only: {"verdict":"","note":"","next":""}. verdict is under 8 words, note is one sentence, next is the single garment to add. Look: ${data.spoken || "nothing"}`,
      160,
      context.userId,
    );
    const parsed = raw ? parseCritique(raw) : null;
    return { ...(parsed ?? fallback), source: parsed ? ("grok" as const) : ("local" as const) };
  });

export const suggestLines = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { seed?: string } | undefined) => ({
    seed: String(input?.seed ?? "").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const fallback = localLines(data.seed);
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `Write 3 short streetwear lines for a shirt print, one per line, no quotes, under 24 characters. Theme: ${data.seed || "night"}.`,
      80,
      context.userId,
    );
    const parsed = raw ? parseLines(raw) : [];
    return {
      lines: parsed.length > 0 ? parsed : fallback,
      source: parsed.length > 0 ? ("grok" as const) : ("local" as const),
    };
  });

export const nameLook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 240),
  }))
  .handler(async ({ data, context }) => {
    const fallback = localLookName(data.spoken);
    if (!data.spoken.trim()) return { name: fallback, source: "local" as const };
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `Name this outfit in 2 or 3 words, no quotes, no punctuation. Outfit: ${data.spoken || "empty"}`,
      24,
      context.userId,
    );
    const name = raw ? parseLookName(raw) : null;
    return { name: name ?? fallback, source: name ? ("grok" as const) : ("local" as const) };
  });

export const printNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { placement?: string; product?: string } | undefined) => ({
    placement: String(input?.placement ?? "front").slice(0, 40),
    product: String(input?.product ?? "piece").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const fallback = localPrintNote(data.placement, data.product);
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `One sentence of practical print advice for a ${data.placement} graphic on a ${data.product}. No hashtags.`,
      80,
      context.userId,
    );
    const note = raw ? parsePrintNote(raw) : null;
    return { note: note ?? fallback, source: note ? ("grok" as const) : ("local" as const) };
  });

export const pickCrowd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { spoken?: string } | undefined) => ({
    spoken: String(input?.spoken ?? "").slice(0, 240),
  }))
  .handler(async ({ data, context }) => {
    if (!data.spoken.trim()) return { crowd: localCrowd(), source: "local" as const };
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `Should the runway crowd cheer, boo, or both for this outfit? Reply with one word: cheer, boo, or both. Outfit: ${data.spoken || "unknown"}`,
      8,
      context.userId,
    );
    const crowd = raw ? parseCrowd(raw) : null;
    return { crowd: crowd ?? localCrowd(), source: crowd ? ("grok" as const) : ("local" as const) };
  });

export const vibeTerms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { query?: string } | undefined) => ({
    query: String(input?.query ?? "").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const fallback = searchTerms(data.query);
    if (!data.query.trim()) return { terms: [] as string[], source: "local" as const };
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(
      `Turn this shop search into up to 4 product words a catalog title might contain (tee, hoodie, hat, dress, pink, black). Comma-separated, no sentences. Query: ${data.query}`,
      40,
      context.userId,
    );
    const parsed = raw ? parseTerms(raw) : [];
    return {
      terms: parsed.length > 0 ? parsed : fallback,
      source: parsed.length > 0 ? ("grok" as const) : ("local" as const),
    };
  });

/** One outfit for an occasion: a few named pieces and a line on why. Builds nothing by itself. */
export const planOutfit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { occasion?: string } | undefined) => ({
    occasion: String(input?.occasion ?? "")
      .trim()
      .slice(0, 160),
  }))
  .handler(async ({ data, context }) => {
    const fallback = localPlan(data.occasion);
    if (!data.occasion) return { ...fallback, source: "local" as const };
    const { guardedText } = await import("./grok.server.ts");
    const raw = await guardedText(planPrompt(data.occasion), 260, context.userId);
    const parsed = raw ? parsePlan(raw) : null;
    return { ...(parsed ?? fallback), source: parsed ? ("grok" as const) : ("local" as const) };
  });
