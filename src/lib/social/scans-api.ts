import { createServerFn } from "@tanstack/react-start";

function slugOf(input: { slug?: string } | undefined): { slug: string } {
  return { slug: String(input?.slug ?? "").slice(0, 140) };
}

/** Open on purpose: a stranger who scans a tag is not signed in. Capped per piece per day. */
export const countTagScan = createServerFn({ method: "POST" })
  .validator(slugOf)
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("../auth/isolation.server.ts");
    assertSameSiteRequest();
    const { recordScan } = await import("./scans.server.ts");
    return recordScan(data.slug);
  });

export const tagScans = createServerFn({ method: "GET" })
  .validator(slugOf)
  .handler(async ({ data }) => {
    const { readScans } = await import("./scans.server.ts");
    return readScans(data.slug);
  });
