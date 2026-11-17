import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";

/**
 * Reports, as the browser calls them. Every one needs a signed-in user, and the
 * two queue calls check on the server, each time, that the user runs the shop.
 */

/** Flag a piece (by slug) or a maker (by handle). The server finds the id itself. */
export const fileReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { kind?: string; slug?: string; handle?: string; reason?: string; note?: string }) => ({
      kind: String(input?.kind ?? ""),
      slug: String(input?.slug ?? "").slice(0, 140),
      handle: String(input?.handle ?? "").slice(0, 60),
      reason: String(input?.reason ?? ""),
      note: String(input?.note ?? "").slice(0, 4000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { fileReport: file } = await import("./reports.server.ts");
    return file(context.userId, data);
  });

/** The open queue. Refused for anyone who does not run the shop. */
export const listReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listReports: list } = await import("./reports.server.ts");
    return list(context.userId);
  });

/** Settle every open report on one target. Refused for anyone who does not run the shop. */
export const resolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ticket?: string; action?: string }) => ({
    ticket: String(input?.ticket ?? "").slice(0, 80),
    action: String(input?.action ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { resolveReport: resolve } = await import("./reports.server.ts");
    return resolve(context.userId, data);
  });
