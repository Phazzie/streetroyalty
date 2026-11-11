import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note, StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { beginCheckout, paySandbox, shippingQuote } from "@/lib/studio/api";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { canceled?: string } => {
    if (search.canceled === "1" || search.canceled === 1) return { canceled: "1" };
    return {};
  },
  component: CheckoutPage,
});

const empty = {
  name: "",
  address1: "",
  address2: "",
  city: "",
  stateCode: "",
  countryCode: "US",
  zip: "",
  email: "",
  phone: "",
};

function CheckoutPage() {
  const canceled = Route.useSearch().canceled === "1";
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState(empty);
  const [rates, setRates] = useState<{ id: string; name: string; rateCents: number; minDays: number | null; maxDays: number | null }[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [method, setMethod] = useState("");
  const [orderId, setOrderId] = useState("");
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState(canceled ? "Payment canceled. The print order stayed a draft." : "");
  const [busy, setBusy] = useState(false);

  function setField(key: keyof typeof empty, value: string) {
    setRecipient((current) => ({ ...current, [key]: value }));
  }

  return (
    <StudioShell current="/checkout">
      <h1 className="mb-2 font-display text-4xl leading-none">Checkout</h1>
      <p className="mb-6 max-w-xl text-muted">
        We create the print order as a draft. It is confirmed only after payment, so nothing ships unpaid.
      </p>
      {note ? <div className="mb-4"><Note>{note}</Note></div> : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void shippingQuote({ data: { recipient } })
            .then((quote) => {
              setRates(quote.rates);
              setSubtotal(quote.subtotalCents);
              setMethod(quote.rates[0]?.id ?? "");
              setNote("Pick a shipping method, then pay.");
            })
            .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "No quote."))
            .finally(() => setBusy(false));
        }}
      >
        {(
          [
            ["name", "Full name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["address1", "Street"],
            ["address2", "Apt"],
            ["city", "City"],
            ["stateCode", "State"],
            ["zip", "Postal code"],
            ["countryCode", "Country"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-muted">{label}</span>
            <Input value={recipient[key]} onChange={(event) => setField(key, event.target.value)} autoComplete="on" required={key !== "address2" && key !== "phone" && key !== "email"} />
          </label>
        ))}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy}>
            Shipping rates
          </Button>
        </div>
      </form>
      {rates.length > 0 ? (
        <fieldset className="mt-6 border-2 border-ink p-4">
          <legend className="px-2 font-display uppercase">Ship it</legend>
          <p className="mb-3 text-sm text-muted">Pieces {formatMoney(subtotal)}</p>
          <div className="flex flex-col gap-2">
            {rates.map((rate) => (
              <label key={rate.id} className="flex min-h-11 items-center gap-3 border-2 border-line px-3 py-2">
                <input type="radio" name="ship" checked={method === rate.id} onChange={() => setMethod(rate.id)} />
                <span className="flex-1">{rate.name}</span>
                <span>{formatMoney(rate.rateCents)}</span>
              </label>
            ))}
          </div>
          <Button
            className="mt-4"
            disabled={busy || !method}
            onClick={() => {
              setBusy(true);
              void beginCheckout({ data: { recipient, shippingMethod: method } })
                .then((result) => {
                  if (result.mode === "stripe" && result.url) {
                    window.location.href = result.url;
                    return;
                  }
                  setOrderId(result.orderId);
                  setTotal(result.totalCents);
                  setNote("Sandbox payment. This does not charge a card or a live Printful wallet.");
                })
                .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Checkout failed."))
                .finally(() => setBusy(false));
            }}
          >
            Place order
          </Button>
        </fieldset>
      ) : null}
      {orderId ? (
        <section className="mt-6 border-2 border-accent bg-surface p-4">
          <h2 className="font-display text-2xl">Test payment</h2>
          <p className="mt-2 text-muted">Order {orderId.slice(0, 8)} is a draft for {formatMoney(total)}. Confirm to submit it.</p>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void paySandbox({ data: { orderId } })
                .then(() => navigate({ to: "/orders" }))
                .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Payment failed."))
                .finally(() => setBusy(false));
            }}
          >
            Confirm test payment
          </Button>
        </section>
      ) : null}
    </StudioShell>
  );
}
