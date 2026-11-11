import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { receiveStripeWebhook } = await import("@/lib/studio/repo.server");
        const result = await receiveStripeWebhook(raw, request.headers.get("stripe-signature"));
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
