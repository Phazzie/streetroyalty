import { createFileRoute } from "@tanstack/react-router";

/**
 * Local-only helper. Answers 404 unless SR_DEV_SEED=1 and printing is in sandbox,
 * which production never is. See src/lib/social/dev-seed.server.ts.
 */
export const Route = createFileRoute("/api/dev/seed")({
  server: {
    handlers: {
      POST: async () => {
        const { devSeedEnabled, runDevSeed } = await import("@/lib/social/dev-seed.server");
        if (!devSeedEnabled()) return new Response("Not found", { status: 404 });
        return Response.json(await runDevSeed());
      },
    },
  },
});
