import { createMiddleware, createServerFn } from "@tanstack/react-start";

/** Reads the viewer if there is one. Signed-out visitors pass through as null. */
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
 * The go-live board. Open on purpose: the checklist is for anyone, and the
 * server decides here whether this viewer is a shop admin before any live
 * reading is added. A visitor gets nothing the studio bar does not already show.
 */
export const goLiveBoard = createServerFn({ method: "GET" })
  .middleware([optionalUser])
  .handler(async ({ context }) => {
    const { readBoard } = await import("./board.server.ts");
    return readBoard(context.userId);
  });
