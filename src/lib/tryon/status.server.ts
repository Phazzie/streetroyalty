import { readLimits } from "../ai/limits.ts";

export type TryOnStatus = { on: boolean; perDay: number };

/**
 * Whether try-on can make a picture at all, and how many each visitor gets a
 * day. It says nothing about the key itself or about any visitor.
 */
export function readTryOnStatus(
  env: Record<string, string | undefined> = process.env,
): TryOnStatus {
  const perDay = readLimits(env).image.visitor;
  return { on: Boolean(env.XAI_API_KEY?.trim()) && perDay > 0, perDay };
}
