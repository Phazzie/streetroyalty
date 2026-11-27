import { createPrintfulProvider } from "./printful.ts";
import { createSandboxProvider, sharedSandboxOrders } from "./sandbox.ts";
import type { PaymentsMode, PodMode, PodProvider } from "./types.ts";
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
  if (explicit === "live" || explicit === "sandbox") return explicit;
  throw new PodError(
    "POD_MODE must be sandbox or live. A Printful key does not switch the shop to live.",
    500,
  );
}

/** Live printing needs a key, a store, and a public origin. Missing any of them fails closed. */
export function assertLivePodEnv(env: StudioEnv): {
  apiKey: string;
  storeId: string;
  publicUrl: string;
} {
  const missing = [
    env.PRINTFUL_API_KEY?.trim() ? null : "PRINTFUL_API_KEY",
    env.PRINTFUL_STORE_ID?.trim() ? null : "PRINTFUL_STORE_ID",
    env.APP_PUBLIC_URL?.trim() ? null : "APP_PUBLIC_URL",
  ].filter((item): item is string => item != null);
  if (missing.length > 0) {
    const verb = missing.length === 1 ? "is" : "are";
    throw new PodError(`${missing.join(", ")} ${verb} required when POD_MODE=live`, 500);
  }
  return {
    apiKey: env.PRINTFUL_API_KEY!.trim(),
    storeId: env.PRINTFUL_STORE_ID!.trim(),
    publicUrl: env.APP_PUBLIC_URL!.trim(),
  };
}

export function readPaymentsMode(env: StudioEnv): PaymentsMode {
  const explicit = env.PAYMENTS_MODE?.trim().toLowerCase();
  if (explicit === "live") return "live";
  if (explicit === "test") return "test";
  // Unset, sandbox, or anything else stays in practice. A Stripe key does not
  // turn live payments on, so a host that has not set PAYMENTS_MODE cannot
  // charge a card by accident.
  return "sandbox";
}

/** Which Stripe key a card mode needs. Test mode never touches a live key, live mode never a test one. */
export function stripeKeyMismatch(mode: PaymentsMode, key: string | undefined): string | null {
  const trimmed = key?.trim() ?? "";
  if (mode === "sandbox" || !trimmed) return null;
  const isTest = /^(sk|rk)_test_/.test(trimmed);
  const isLive = /^(sk|rk)_live_/.test(trimmed);
  if (mode === "test" && !isTest)
    return "PAYMENTS_MODE=test needs a Stripe test key (sk_test_). It refuses a live key.";
  if (mode === "live" && !isLive)
    return "PAYMENTS_MODE=live needs a Stripe live key (sk_live_). A test key cannot take real money.";
  return null;
}

/** The Stripe secret key for a card mode, or a plain error saying what is wrong. */
export function readStripeSecret(mode: PaymentsMode, env: StudioEnv = process.env): string {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error(`STRIPE_SECRET_KEY is required when PAYMENTS_MODE=${mode}.`);
  const mismatch = stripeKeyMismatch(mode, key);
  if (mismatch) throw new Error(mismatch);
  return key;
}

export function getPodProvider(env: StudioEnv = process.env): PodProvider {
  const mode = readPodMode(env);
  const markup = readMarkup(env);
  if (mode === "sandbox") return createSandboxProvider(sharedSandboxOrders(), markup);
  const live = assertLivePodEnv(env);
  return createPrintfulProvider({
    apiKey: live.apiKey,
    storeId: live.storeId,
    markup,
  });
}
