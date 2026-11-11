import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/printful")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { receivePrintfulWebhook } = await import("@/lib/studio/repo.server");
        const result = await receivePrintfulWebhook(raw, request.headers.get("x-pf-webhook-signature"));
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
