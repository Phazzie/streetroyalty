import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Note, StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { cartAdd, shopPiece } from "@/lib/studio/api";
import { createSingleFlight } from "@/lib/ui/single-flight";

export const Route = createFileRoute("/shop/$slug")({ component: ProductPage });

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<Awaited<ReturnType<typeof shopPiece>> | null>(null);
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const flight = useRef(createSingleFlight());

  useEffect(() => {
    void shopPiece({ data: { slug } })
      .then((next) => {
        setPiece(next);
        setVariantId(next.variantId);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Missing piece."));
  }, [slug]);

  const size = piece?.sizes.find((item) => item.variantId === variantId);

  return (
    <StudioShell current="/shop">
      {error ? <Note>{error}</Note> : null}
      {piece ? (
        <div className="grid gap-6 md:grid-cols-2">
          {piece.mockupUrl ? (
            <img src={piece.mockupUrl} alt={piece.title} decoding="async" className="w-full border-2 border-ink object-contain" />
          ) : (
            <div className="aspect-[4/5] border-2 border-ink bg-surface" />
          )}
          <div>
            <p className="tag">{piece.productType}</p>
            <h1 className="mt-3 font-display text-4xl leading-none">{piece.title}</h1>
            <p className="mt-2 text-muted">{piece.productName} · {piece.colorName} · {piece.placement} print</p>
            <p className="mt-4 font-display text-3xl">{formatMoney(size?.retailCents ?? piece.retailCents)}</p>
            <p className="mt-4 text-sm text-muted">Size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {piece.sizes.map((item) => (
                <button key={item.variantId} type="button" aria-pressed={item.variantId === variantId} onClick={() => setVariantId(item.variantId)} className={`chip ${item.variantId === variantId ? "chip-on" : ""}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <Button
              className="mt-6 w-full"
              size="lg"
              disabled={adding || !variantId}
              onClick={() => {
                void flight.current(async () => {
                  setAdding(true);
                  try {
                    await cartAdd({ data: { designId: piece.id, variantId } });
                    void navigate({ to: "/cart" });
                  } catch (reason: unknown) {
                    setError(reason instanceof Error ? reason.message : "Sign in to add it.");
                  } finally {
                    setAdding(false);
                  }
                });
              }}
            >
              Add to cart
            </Button>
          </div>
        </div>
      ) : null}
    </StudioShell>
  );
}
