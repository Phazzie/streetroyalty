import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioShell } from "@/components/studio/shell";
import { filterByTerms, searchTerms } from "@/lib/ai/local";
import { vibeTerms } from "@/lib/ai/api";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { formatMoney } from "@/lib/pod/money";
import { shopList } from "@/lib/studio/api";
import type { DesignSummary } from "@/lib/studio/models";

export const Route = createFileRoute("/shop/")({ component: ShopPage });

function ShopPage() {
  const [pieces, setPieces] = useState<DesignSummary[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [source, setSource] = useState<"local" | "grok" | "">("");
  const flight = useRef(createSingleFlight());

  useEffect(() => {
    void shopList()
      .then(setPieces)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The shop did not load."));
  }, []);

  const shown = useMemo(() => {
    const rack = pieces ?? [];
    const active = terms.length > 0 ? terms : searchTerms(query);
    return filterByTerms(rack, active, (piece) => `${piece.title} ${piece.productName} ${piece.colorName}`);
  }, [pieces, query, terms]);

  return (
    <StudioShell current="/shop">
      <p className="tag">Shop</p>
      <h1 className="mt-3 font-display text-4xl leading-none">The rack</h1>
      <p className="mt-2 mb-4 max-w-xl text-muted">Published pieces print after checkout. Nothing ships before the payment clears.</p>
      <form
        className="mb-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void flight.current(async () => {
            try {
              const result = await vibeTerms({ data: { query } });
              setTerms(result.terms);
              setSource(result.source);
            } catch {
              setTerms(searchTerms(query));
              setSource("local");
            }
          });
        }}
      >
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setTerms([]);
            setSource("");
          }}
          placeholder="Pink hoodie, or a rainy night"
          aria-label="Search the rack"
        />
        <Button type="submit" variant="ghost">
          Find
        </Button>
      </form>
      {source ? <p className="mb-4 text-sm text-muted">Matched with {source === "grok" ? "the crown" : "the words you typed"}.</p> : null}
      {error ? <p className="border-2 border-pipe p-4">{error}</p> : null}
      {pieces && pieces.length === 0 ? (
        <p className="empty-state">The rack is empty. Publish a piece from the studio.</p>
      ) : null}
      {pieces && pieces.length > 0 && shown.length === 0 ? (
        <p className="empty-state">Nothing on the rack matches that. Clear the search or try hoodie, hat, tee.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((piece) => (
          <Link key={piece.id} to="/shop/$slug" params={{ slug: piece.slug }} className="studio-card border-2 border-ink bg-surface p-2">
            {piece.mockupUrl ? (
              <img src={piece.mockupUrl} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="aspect-[4/5] bg-bg" />
            )}
            <p className="mt-2 font-display uppercase">{piece.title}</p>
            <p className="text-sm text-muted">{piece.productName}</p>
            <p className="font-display text-lg">{formatMoney(piece.retailCents)}</p>
          </Link>
        ))}
      </div>
    </StudioShell>
  );
}
