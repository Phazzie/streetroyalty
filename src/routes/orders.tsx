import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Note, StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import {
  confirmStripeReturn,
  linkWebhooks,
  myOrders,
  retryPrint,
  studioAccess,
} from "@/lib/studio/api";
import type { OrderSummary } from "@/lib/studio/models";

export const Route = createFileRoute("/orders")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const sessionId = typeof search.session_id === "string" ? search.session_id : "";
    return sessionId ? { session_id: sessionId } : {};
  },
  component: OrdersPage,
});

function OrdersPage() {
  const sessionId = Route.useSearch().session_id ?? "";
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [note, setNote] = useState("");
  const [secret, setSecret] = useState("");
  const [admin, setAdmin] = useState(false);

  function reload() {
    void myOrders()
      .then(setOrders)
      .catch((reason: unknown) =>
        setNote(reason instanceof Error ? reason.message : "Sign in to see orders."),
      );
  }

  useEffect(() => {
    void studioAccess()
      .then((access) => setAdmin(access.admin))
      .catch(() => setAdmin(false));
  }, []);

  useEffect(() => {
    if (sessionId) {
      void confirmStripeReturn({ data: { sessionId } })
        .then(() => setNote("Payment landed. The print order was submitted."))
        .catch((reason: unknown) =>
          setNote(reason instanceof Error ? reason.message : "Could not confirm payment."),
        )
        .finally(reload);
      return;
    }
    reload();
  }, [sessionId]);

  return (
    <StudioShell current="/orders">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none">Orders</h1>
        {admin ? (
          <Button
            variant="ghost"
            onClick={() => {
              void linkWebhooks()
                .then((result) => {
                  setSecret(result.secretHex ?? "");
                  setNote(
                    result.mode === "sandbox"
                      ? `Sandbox mode. When you go live, point Printful at ${result.url}`
                      : `Printful will post to ${result.url}. Copy the secret into PRINTFUL_WEBHOOK_SECRET.`,
                  );
                })
                .catch((reason: unknown) =>
                  setNote(
                    reason instanceof Error ? reason.message : "Could not register webhooks.",
                  ),
                );
            }}
          >
            Connect webhooks
          </Button>
        ) : null}
      </div>
      {note ? (
        <div className="mb-4">
          <Note>{note}</Note>
        </div>
      ) : null}
      {secret ? (
        <p className="mb-4 break-all border-2 border-amber bg-surface p-3 text-sm">
          Webhook secret (store it in PRINTFUL_WEBHOOK_SECRET, then clear this screen): {secret}
        </p>
      ) : null}
      {orders && orders.length === 0 ? (
        <p className="empty-state">No orders yet. The rack is waiting.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {(orders ?? []).map((order) => (
          <li key={order.id} className="border-2 border-ink bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display uppercase">{order.status.replaceAll("_", " ")}</p>
              <p>{formatMoney(order.totalCents)}</p>
            </div>
            <p className="text-sm text-muted">
              {order.sandbox ? "Sandbox" : "Live"} · payment {order.paymentStatus}
              {order.providerStatus ? ` · print ${order.providerStatus}` : ""}
            </p>
            {order.failureReason ? <p className="mt-2 text-sm">{order.failureReason}</p> : null}
            {order.status === "failed" && order.paymentStatus === "paid" ? (
              <Button
                className="mt-3"
                onClick={() => {
                  void retryPrint({ data: { orderId: order.id } })
                    .then(() => {
                      setNote("Print submitted. The charge was not refunded.");
                      reload();
                    })
                    .catch((reason: unknown) =>
                      setNote(reason instanceof Error ? reason.message : "Retry failed."),
                    );
                }}
              >
                Retry print
              </Button>
            ) : null}
            {order.status === "needs_review" ? (
              <p className="mt-2 text-sm">
                The print was not submitted. The shop refunds this charge in Stripe.
              </p>
            ) : null}
            <ul className="mt-2 text-sm">
              {order.items.map((item, index) => (
                <li key={`${order.id}-${index}`}>
                  {item.quantity} × {item.title} ({item.variantLabel})
                </li>
              ))}
            </ul>
            {order.trackingNumber ? (
              <p className="mt-2 text-sm">
                Tracking{" "}
                {order.trackingUrl ? (
                  <a className="underline" href={order.trackingUrl}>
                    {order.trackingNumber}
                  </a>
                ) : (
                  order.trackingNumber
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </StudioShell>
  );
}
