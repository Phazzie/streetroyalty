/**
 * Spending limits for the generation calls the app pays for. Pure, so the
 * policy can be tested without a database or a request.
 */

export type AiKind = "text" | "image" | "video";

export type AiLimits = Record<AiKind, { visitor: number; global: number }>;

export const DEFAULT_LIMITS: AiLimits = {
  text: { visitor: 40, global: 1500 },
  image: { visitor: 10, global: 150 },
  video: { visitor: 2, global: 20 },
};

type LimitEnv = Record<string, string | undefined>;

function readCap(env: LimitEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(1_000_000, Math.floor(value));
}

/**
 * AI_VISITOR_IMAGE and friends cap one signed-in account per day. A call with
 * no account is capped per address instead. AI_DAILY_IMAGE and friends cap
 * everyone together. Zero turns a kind off.
 */
export function readLimits(env: LimitEnv): AiLimits {
  return {
    text: {
      visitor: readCap(env, "AI_VISITOR_TEXT", DEFAULT_LIMITS.text.visitor),
      global: readCap(env, "AI_DAILY_TEXT", DEFAULT_LIMITS.text.global),
    },
    image: {
      visitor: readCap(env, "AI_VISITOR_IMAGE", DEFAULT_LIMITS.image.visitor),
      global: readCap(env, "AI_DAILY_IMAGE", DEFAULT_LIMITS.image.global),
    },
    video: {
      visitor: readCap(env, "AI_VISITOR_VIDEO", DEFAULT_LIMITS.video.visitor),
      global: readCap(env, "AI_DAILY_VIDEO", DEFAULT_LIMITS.video.global),
    },
  };
}

export type SpendVerdict = { ok: true } | { ok: false; reason: "visitor" | "global" };

/** Counts are the totals after this request was added. */
export function judgeSpend(
  counts: { visitor: number; global: number | null },
  cap: { visitor: number; global: number },
): SpendVerdict {
  if (counts.visitor > cap.visitor) return { ok: false, reason: "visitor" };
  if (counts.global !== null && counts.global > cap.global) return { ok: false, reason: "global" };
  return { ok: true };
}

export function usageDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The visitor's address. Vercel reports it in its own headers and overwrites
 * forwarded-for, so those are trusted in that order. Behind a proxy that only
 * appends to forwarded-for a client could vary this, which weakens the
 * per-visitor cap; the site-wide cap still holds. With no address at all,
 * every visitor shares one bucket, which errs toward spending less.
 */
export function clientAddress(headers: { get(name: string): string | null }): string {
  const first = (name: string) => headers.get(name)?.split(",")[0]?.trim() ?? "";
  const address = first("x-vercel-forwarded-for") || first("x-real-ip") || first("x-forwarded-for");
  return /^[0-9a-f:.]{3,45}$/i.test(address) ? address.toLowerCase() : "unknown";
}
