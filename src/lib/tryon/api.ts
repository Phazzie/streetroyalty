import { createServerFn } from "@tanstack/react-start";

/**
 * Lets the mirror say it is closed before anyone taps, instead of spinning and
 * then failing. Open on purpose: it answers the same for everyone and makes no
 * picture. The paid call stays generateLook, behind the daily caps.
 */
export const tryOnStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { readTryOnStatus } = await import("./status.server.ts");
  return readTryOnStatus();
});
