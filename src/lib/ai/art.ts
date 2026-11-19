import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";
import { isArtStyle, type ArtStyleId } from "./art-styles.ts";

type ArtResult =
  | { ok: true; image: string; prompt: string }
  | { ok: false; kind: "unavailable" | "missed" | "limit" };

/** One piece of print art from a short idea. Counted against the daily image cap. */
export const generateArt = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { idea?: string; style?: string } | undefined) => ({
    idea: String(input?.idea ?? "")
      .trim()
      .slice(0, 240),
    style: (isArtStyle(input?.style) ? input.style : "ink") as ArtStyleId,
  }))
  .handler(async ({ data, context }): Promise<ArtResult> => {
    if (!data.idea) return { ok: false, kind: "missed" };
    const { admit } = await import("./guard.server.ts");
    const verdict = await admit("image", context.userId);
    if (verdict !== "ok") return { ok: false, kind: verdict };
    const { runArt } = await import("../imagine.server.ts");
    return runArt(data);
  });
