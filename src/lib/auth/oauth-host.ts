/** Hosts the baked preview OAuth client is allowed to serve. */
export function isPreviewHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}

/**
 * Real broker keys work on every host. The baked preview client works only on
 * a preview host. Anywhere else, with no real keys, Google and X stay off.
 */
export function grokOAuthAllowed(hostname: string, hasRealClient: boolean): boolean {
  if (hasRealClient) return true;
  return isPreviewHostname(hostname);
}
