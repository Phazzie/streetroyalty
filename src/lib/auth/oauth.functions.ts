import { createServerFn } from "@tanstack/react-start";
import { GROK_PROVIDERS } from "./providers";

/** Google and X, or nothing when this host has no real broker client. */
export const listOAuthProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { grokOAuthButtonsVisible } = await import("./server.ts");
  if (!grokOAuthButtonsVisible()) return [];
  return GROK_PROVIDERS.map(({ providerId, label }) => ({ providerId, label }));
});
