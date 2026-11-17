import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pod/money";
import { startStoreCheckout } from "@/lib/storefront/api";
import { bagCount, bagSubtotalCents, useBag } from "@/lib/storefront/bag";
import { MAX_LINE_QUANTITY } from "@/lib/storefront/types";
import { createSingleFlight } from "@/lib/ui/single-flight";

export function BagDrawer() {
  const open = useBag((state) => state.open);
  const setOpen = useBag((state) => state.setOpen);
  const lines = useBag((state) => state.lines);
  const setQuantity = useBag((state) => state.setQuantity);
  const remove = useBag((state) => state.remove);
  const clear = useBag((state) => state.clear);
  const sent = useBag((state) => state.sent);
  const notice = useBag((state) => state.notice);
  const markSent = useBag((state) => state.markSent);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(createSingleFlight());
  const count = bagCount(lines);

  function checkout() {
    void flight.current(async () => {
      setBusy(true);
      setNote("");
      try {
        const result = await startStoreCheckout({
          data: {
            lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          },
        });
        if (result.mode === "fourthwall") {
          // The bag is kept in case checkout is abandoned, and marked so it can offer to clear itself.
          markSent();
          window.location.href = result.url;
          return;
        }
        setNote(
          "This is the preview drop, so nothing can be bought yet. Checkout opens when the shop is connected.",
        );
      } catch (reason: unknown) {
        setNote(reason instanceof Error ? reason.message : "Checkout did not start.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNote("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim-in fixed inset-0 z-50 bg-night/70 backdrop-blur-xs" />
        <Dialog.Content
          className="paper drawer-in fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="display text-3xl">
              Your bag{count > 0 ? <span className="ml-2 text-subtle">{count}</span> : null}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full text-fg hover:bg-fg/10"
                aria-label="Close the bag"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-4 px-5">
              <p className="display text-4xl">Nothing in it yet.</p>
              <p className="text-muted">The sets are on the shelf.</p>
              <Button
                asChild
                className="rounded-none font-display text-sm tracking-wider uppercase"
              >
                <Link to="/shop" onClick={() => setOpen(false)}>
                  Shop the drop
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
                {lines.map((line) => (
                  <li key={line.variantId} className="flex gap-4 py-4">
                    <Link
                      to="/shop/$slug"
                      params={{ slug: line.slug }}
                      onClick={() => setOpen(false)}
                      className="block h-28 w-21 shrink-0 overflow-hidden bg-surface"
                    >
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-sm leading-tight uppercase">
                            {line.name}
                          </p>
                          <p className="mt-1 text-sm text-muted">{line.variantLabel}</p>
                        </div>
                        <p className="shrink-0 font-display text-sm">
                          {formatMoney(line.priceCents * line.quantity)}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex items-center border-2 border-ink">
                          <button
                            type="button"
                            className="grid h-10 w-10 place-items-center hover:bg-fg/10"
                            aria-label={`One fewer ${line.name}`}
                            onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-display text-sm" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="grid h-10 w-10 place-items-center hover:bg-fg/10 disabled:opacity-40"
                            aria-label={`One more ${line.name}`}
                            disabled={line.quantity >= MAX_LINE_QUANTITY}
                            onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="min-h-10 px-1 text-sm text-muted underline underline-offset-4 hover:text-fg"
                          onClick={() => remove(line.variantId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="safe-bottom border-t border-line px-5 pt-4">
                {sent ? (
                  <p className="mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-ink bg-surface px-3 py-2 text-sm">
                    <span>You took these to checkout. Already bought them?</span>
                    <button
                      type="button"
                      className="min-h-10 font-semibold underline underline-offset-4"
                      onClick={clear}
                    >
                      Clear the bag
                    </button>
                  </p>
                ) : null}
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow text-muted">Subtotal</p>
                  <p className="font-display text-2xl">{formatMoney(bagSubtotalCents(lines))}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Shipping and tax are worked out at checkout.
                </p>
                {note || notice ? (
                  <p
                    role="status"
                    className="mt-3 border-2 border-ink bg-surface px-3 py-2 text-sm"
                  >
                    {note || notice}
                  </p>
                ) : null}
                <Button
                  className="mt-4 w-full rounded-none font-display text-sm tracking-wider uppercase"
                  size="lg"
                  disabled={busy}
                  onClick={checkout}
                >
                  {busy ? "Opening checkout" : "Checkout"}
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
