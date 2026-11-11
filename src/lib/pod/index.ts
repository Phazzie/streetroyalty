import { createPrintfulProvider } from "./printful.ts";
import { createSandboxProvider, sharedSandboxOrders } from "./sandbox.ts";
import type { PodMode, PodProvider } from "./types.ts";
import { PodError } from "./types.ts";

export type StudioEnv = {
  POD_MODE?: string;
  PRINTFUL_API_KEY?: string;
  PRINTFUL_STORE_ID?: string;
  STUDIO_MARKUP?: string;
  PAYMENTS_MODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  PRINTFUL_WEBHOOK_SECRET?: string;
  APP_PUBLIC_URL?: string;
};

export function readMarkup(env: StudioEnv): number {
  const parsed = Number(env.STUDIO_MARKUP ?? "2.2");
  if (!Number.isFinite(parsed)) return 2.2;
  return Math.min(5, Math.max(1, parsed));
}

export function readPodMode(env: StudioEnv): PodMode {
  const explicit = env.POD_MODE?.trim().toLowerCase();
  if (explicit === "live") return "live";
  if (explicit === "sandbox") return "sandbox";
  return env.PRINTFUL_API_KEY?.trim() ? "live" : "sandbox";
}

export function readPaymentsMode(env: StudioEnv): PodMode {
  const explicit = env.PAYMENTS_MODE?.trim().toLowerCase();
  if (explicit === "live") return "live";
  if (explicit === "sandbox") return "sandbox";
  return env.STRIPE_SECRET_KEY?.trim() ? "live" : "sandbox";
}

export function getPodProvider(env: StudioEnv = process.env): PodProvider {
  const mode = readPodMode(env);
  const markup = readMarkup(env);
  if (mode === "sandbox") return createSandboxProvider(sharedSandboxOrders(), markup);
  const apiKey = env.PRINTFUL_API_KEY?.trim();
  if (!apiKey) throw new PodError("PRINTFUL_API_KEY is required when POD_MODE=live", 500);
  return createPrintfulProvider({
    apiKey,
    storeId: env.PRINTFUL_STORE_ID?.trim() || undefined,
    markup,
  });
}
