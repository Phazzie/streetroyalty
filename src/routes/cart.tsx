import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { cartList, cartNudge } from "@/lib/studio/api";
import type { CartLine } from "@/lib/studio/models";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const pendingRef = useRef("");

  function reload() {
    void cartList()
      .then(setLines)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Sign in to see the cart."));
  }

  useEffect(() => {
    reload();
  }, []);

  const total = (lines ?? []).reduce((sum, line) => sum + line.unitCents * line.quantity, 0);

  function nudge(cartId: string, delta: -1 | 1) {
    if (pendingRef.current) return;
    pendingRef.current = cartId;
    setPendingId(cartId);
    void cartNudge({ data: { cartId, delta } })
      .then(() => reload())
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not update the cart."))
      .finally(() => {
        pendingRef.current = "";
        setPendingId("");
      });
  }

  return (
    <StudioShell current="/cart">
      <h1 className="mb-4 font-display text-4xl leading-none">Cart</h1>
      {error ? <p className="mb-4 border-2 border-pipe p-4">{error}</p> : null}
      {lines && lines.length === 0 ? <p className="empty-state">Nothing in the bag. The shop is open.</p> : null}
      <ul className="flex flex-col gap-3">
        {(lines ?? []).map((line) => (
          <li key={line.id} className="grid grid-cols-[5rem_1fr] gap-3 border-2 border-ink bg-surface p-3 sm:grid-cols-[6rem_1fr_auto]">
            {line.mockupUrl ? <img src={line.mockupUrl} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-bg" />}
            <div>
              <p className="font-display uppercase">{line.title}</p>
              <p className="text-sm text-muted">{line.variantLabel}</p>
              <p>{formatMoney(line.unitCents)}</p>
            </div>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <Button variant="ghost" aria-label={`Fewer ${line.title}`} disabled={pendingId === line.id} onClick={() => nudge(line.id, -1)}>
                −
              </Button>
              <span className="min-w-6 text-center">{line.quantity}</span>
              <Button variant="ghost" aria-label={`More ${line.title}`} disabled={pendingId === line.id || line.quantity >= 10} onClick={() => nudge(line.id, 1)}>
                +
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {lines && lines.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-2xl">{formatMoney(total)} before shipping</p>
          <Link to="/checkout" className="chip chip-on">
            Checkout
          </Link>
        </div>
      ) : null}
    </StudioShell>
  );
}
