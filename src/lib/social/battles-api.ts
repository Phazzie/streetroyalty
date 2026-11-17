import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";

/** Reads the viewer when there is one, and lets a visitor through when there is not. */
const optionalUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("../auth/client.ts");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { getSessionUser } = await import("../auth/verify.server.ts");
    const user = await getSessionUser(context.bearerToken);
    return next({ context: { userId: user?.id ?? null } });
  });

/**
 * Open: anybody can watch a battle. It reads public, published pieces only, and uses the
 * viewer's id (when signed in) just to leave out their own pieces and pairs they judged.
 */
export const nextBattle = createServerFn({ method: "GET" })
  .middleware([optionalUser])
  .validator((input: { skip?: unknown } | undefined) => ({
    skip: Array.isArray(input?.skip)
      ? input.skip
          .filter((key): key is string => typeof key === "string" && key.length <= 200)
          .slice(-60)
      : [],
  }))
  .handler(async ({ data, context }) => {
    const server = await import("./battles.server.ts");
    return server.nextBattle(context.userId, data.skip);
  });

export const castVote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { winnerId?: string; loserId?: string }) => ({
    winnerId: String(input?.winnerId ?? ""),
    loserId: String(input?.loserId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const server = await import("./battles.server.ts");
    return server.castVote(context.userId, data);
  });

/** Open: the throne board is public and reads only published pieces and vote counts. */
export const throne = createServerFn({ method: "GET" }).handler(async () => {
  const server = await import("./battles.server.ts");
  return server.throne();
});
