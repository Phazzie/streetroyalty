/**
 * A maker's handle as it arrives in a link (the `m` search param on /tag/<slug>).
 * Anything that does not look like a handle is dropped, so a tag never prints
 * words somebody typed into the address bar.
 */
export function cleanHandle(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const handle = String(value).trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{0,31}$/.test(handle) ? handle : undefined;
}

/** The link without its scheme, for the small print under a code. */
export function plainLink(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\?via=tag$/, "");
}
