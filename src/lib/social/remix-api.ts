import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";

function slugOf(input: { slug?: string } | undefined): { slug: string } {
  const slug = String(input?.slug ?? "")
    .trim()
    .slice(0, 120);
  if (!slug) throw new Error("Pick a piece.");
  return { slug };
}

/** Make the caller's own draft copy of a published piece. The copy belongs to the signed-in user. */
export const remixPiece = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(slugOf)
  .handler(async ({ data, context }) => {
    const { remixDesign } = await import("./remix.server.ts");
    return remixDesign(context.userId, data.slug);
  });

/** Open on purpose: the family tree of a published piece is part of its public rack page. */
export const pieceFamily = createServerFn({ method: "GET" })
  .validator(slugOf)
  .handler(async ({ data }) => {
    const { readFamily } = await import("./remix.server.ts");
    return readFamily(data.slug);
  });
