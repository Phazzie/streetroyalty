import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { shopList } from "@/lib/studio/api";
import type { DesignSummary } from "@/lib/studio/models";

export const Route = createFileRoute("/shop")({ component: ShopPage });

function ShopPage() {
  const [pieces, setPieces] = useState<DesignSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void shopList()
      .then(setPieces)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The shop did not load."));
  }, []);

  return (
    <StudioShell current="/shop">
      <p className="tag">Shop</p>
      <h1 className="mt-3 font-display text-4xl leading-none">The rack</h1>
      <p className="mt-2 mb-6 max-w-xl text-muted">Published pieces print after checkout. Nothing ships before the payment clears.</p>
      {error ? <p className="border-2 border-pipe p-4">{error}</p> : null}
      {pieces && pieces.length === 0 ? (
        <p className="border-2 border-dashed border-line p-6">The rack is empty. Publish a piece from the studio.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(pieces ?? []).map((piece) => (
          <Link key={piece.id} to="/shop/$slug" params={{ slug: piece.slug }} className="studio-card border-2 border-ink bg-surface p-2">
            {piece.mockupUrl ? <img src={piece.mockupUrl} alt="" className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] bg-bg" />}
            <p className="mt-2 font-display uppercase">{piece.title}</p>
            <p className="text-sm text-muted">{piece.productName}</p>
            <p className="font-display text-lg">{formatMoney(piece.retailCents)}</p>
          </Link>
        ))}
      </div>
    </StudioShell>
  );
}
