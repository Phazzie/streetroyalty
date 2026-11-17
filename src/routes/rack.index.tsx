import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MakerLine } from "@/components/rack/maker-line";
import { RackCard } from "@/components/rack/rack-card";
import { StudioShell } from "@/components/studio/shell";
import { filterByTerms, searchTerms } from "@/lib/ai/local";
import { vibeTerms } from "@/lib/ai/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { rackList } from "@/lib/social/api";
import type { MakerRef, RackPiece, RackSort } from "@/lib/social/types";

const SORTS: { id: RackSort; label: string; hint: string }[] = [
  { id: "fresh", label: "Fresh", hint: "Newest first." },
  { id: "crowned", label: "Crowned", hint: "Most crowns first." },
  { id: "following", label: "Following", hint: "Only makers you follow." },
];

function sortOf(value: unknown): RackSort {
  return value === "crowned" || value === "following" ? value : "fresh";
}

export const Route = createFileRoute("/rack/")({
  validateSearch: (search: Record<string, unknown>): { sort?: RackSort } =>
    search.sort === "crowned" || search.sort === "following" ? { sort: search.sort } : {},
  component: RackPage,
});

function RackPage() {
  const navigate = useNavigate();
  const sort = sortOf(Route.useSearch().sort);
  const { user, isPending } = useCurrentUserState();
  const [pieces, setPieces] = useState<RackPiece[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [source, setSource] = useState<"local" | "grok" | "">("");
  const flight = useRef(createSingleFlight());
  const viewerId = user?.id ?? "";

  useEffect(() => {
    if (isPending) return;
    let live = true;
    setPieces(null);
    setError("");
    void rackList({ data: { sort } })
      .then((next) => {
        if (live) setPieces(next);
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : "The rack did not load.");
      });
    return () => {
      live = false;
    };
  }, [sort, viewerId, isPending]);

  const shown = useMemo(() => {
    const rack = pieces ?? [];
    const active = terms.length > 0 ? terms : searchTerms(query);
    return filterByTerms(
      rack,
      active,
      (piece) =>
        `${piece.title} ${piece.productName} ${piece.colorName} ${piece.maker.name} ${piece.maker.handle}`,
    );
  }, [pieces, query, terms]);

  const signedOutFollowing = sort === "following" && !isPending && !user;

  // Everyone with a piece showing, most crowned first, so the rack reads as people and not only products.
  const makers = useMemo(() => {
    const seen = new Map<string, { maker: MakerRef; pieces: number; crowns: number }>();
    for (const piece of pieces ?? []) {
      if (!piece.maker.handle) continue;
      const entry = seen.get(piece.maker.handle) ?? { maker: piece.maker, pieces: 0, crowns: 0 };
      entry.pieces += 1;
      entry.crowns += piece.crowns;
      seen.set(piece.maker.handle, entry);
    }
    return [...seen.values()].sort(
      (left, right) => right.crowns - left.crowns || right.pieces - left.pieces,
    );
  }, [pieces]);

  return (
    <StudioShell current="/rack">
      <p className="tag">Customs</p>
      <h1 className="mt-3 font-display text-4xl leading-none">The rack</h1>
      <p className="mt-2 mb-4 max-w-xl text-muted">
        Pieces made in the studio and published by their makers. Each one prints after checkout.
        Crown the ones you rate.
      </p>
      <form
        className="mb-4 flex flex-wrap gap-2"
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
          className="min-w-0 flex-1 basis-48"
        />
        <Button type="submit" variant="ghost">
          Find
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!pieces || pieces.length === 0}
          onClick={() => {
            if (!pieces || pieces.length === 0) return;
            const pick = pieces[Math.floor(Math.random() * pieces.length)];
            if (pick) void navigate({ to: "/rack/$slug", params: { slug: pick.slug } });
          }}
        >
          Surprise me
        </Button>
      </form>
      <div role="group" aria-label="Sort the rack" className="mb-2 flex flex-wrap gap-2">
        {SORTS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={sort === item.id}
            className={`chip ${sort === item.id ? "chip-on" : ""}`}
            onClick={() =>
              void navigate({
                to: "/rack",
                search: item.id === "fresh" ? {} : { sort: item.id },
                replace: true,
              })
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mb-5 text-sm text-muted">{SORTS.find((item) => item.id === sort)?.hint}</p>
      {makers.length > 1 || (user && !isPending) ? (
        <nav aria-label="Makers on the rack" className="mb-5 border-y-2 border-line py-2">
          <ul className="flex items-stretch gap-2 overflow-x-auto pb-1">
            <li className="flex shrink-0 items-center pr-1 font-display text-xs tracking-wide text-muted uppercase">
              Who made these
            </li>
            {user && !isPending ? (
              <li className="shrink-0">
                <Link to="/me" className="chip h-full whitespace-nowrap">
                  Your maker page
                </Link>
              </li>
            ) : null}
            {makers.map((entry) => (
              <li
                key={entry.maker.handle}
                className="max-w-56 shrink-0 border-2 border-line bg-surface px-2"
              >
                <MakerLine maker={entry.maker} />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {source ? (
        <p className="mb-4 text-sm text-muted">
          Matched with {source === "grok" ? "the crown" : "the words you typed"}.
        </p>
      ) : null}
      {error ? <p className="border-2 border-pipe p-4">{error}</p> : null}
      {signedOutFollowing ? (
        <div className="empty-state">
          <p>Sign in to follow makers. Their new pieces line up here.</p>
          <Button asChild className="mt-4">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : null}
      {!signedOutFollowing && pieces && pieces.length === 0 ? (
        sort === "following" ? (
          <div className="empty-state">
            <p>You follow nobody yet. Tap a maker's name on any piece, then Follow.</p>
            <Button asChild variant="ghost" className="mt-4">
              <Link to="/rack">See what is fresh</Link>
            </Button>
          </div>
        ) : (
          <p className="empty-state">The rack is empty. Publish a piece from the studio.</p>
        )
      ) : null}
      {pieces && pieces.length > 0 && shown.length === 0 ? (
        <p className="empty-state">
          Nothing on the rack matches that. Clear the search or try hoodie, hat, tee.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((piece) => (
          <RackCard
            key={piece.id}
            piece={piece}
            onCrown={(next) =>
              setPieces(
                (current) =>
                  current?.map((item) =>
                    item.id === piece.id
                      ? { ...item, crowns: next.crowns, crownedByMe: next.crowned }
                      : item,
                  ) ?? current,
              )
            }
          />
        ))}
      </div>
    </StudioShell>
  );
}
