import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatMoney } from "@/lib/pod/money";
import { shopDrops, shopList } from "@/lib/studio/api";
import type { DesignSummary } from "@/lib/studio/models";
import { groupDrops } from "@/lib/moon/drops";
import { FitRescue } from "@/components/moon/fit-rescue";
import { CrownFitting } from "@/components/moon/crown-fitting";

const TICKER_LINES = [
  "You never left. You are street royalty.",
  "Locked in. Board's open.",
  "Crown never came off.",
  "Peel a look. Make it yours.",
  "No grid. Just the show.",
];

/**
 * The front door is a runway, not a catalog wall. Published pieces walk
 * full-bleed; every look is grabbable — peel it off the runway, fork it,
 * wear it. The store and the studio are the same surface.
 */
export function Runway() {
  const [pieces, setPieces] = useState<DesignSummary[] | null>(null);
  const [drops, setDrops] = useState<{ id: string; name: string; dropAt: string | null }[]>([]);

  useEffect(() => {
    void shopList()
      .then(setPieces)
      .catch(() => setPieces([]));
    void shopDrops()
      .then(setDrops)
      .catch(() => setDrops([]));
  }, []);

  const liveDrops = groupDrops(pieces ?? [], drops);
  const ticker = [...TICKER_LINES, ...TICKER_LINES];

  return (
    <>
    <section aria-label="The runway" className="border-b-4 border-pipe bg-bg text-fg">
      <div className="overflow-hidden border-b-2 border-ink py-2" aria-hidden="true">
        <div className="marquee-track gap-8">
          {ticker.map((line, index) => (
            <span key={index} className="font-display text-sm tracking-widest whitespace-nowrap uppercase">
              {line} <span className="text-pipe">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <p className="tag">The runway — tonight&apos;s show</p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-6xl">
          Don&apos;t shop.
          <br />
          <span className="text-accent">Watch the show.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Every look below is live: grab one, peel it into the studio, change it, wear it. Buying and
          designing happen on the same floor here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/studio" className="chip chip-on">
            Open the studio
          </Link>
          <Link to="/shop" className="chip chip-pink">
            Walk the rack
          </Link>
          <Link to="/dashboard" className="chip chip-violet">
            Seller board
          </Link>
        </div>
        {liveDrops.map((drop) => (
          <p key={drop.collectionId} className="mt-4 border-2 border-amber bg-surface px-3 py-2 font-display text-sm uppercase">
            {drop.live ? "Drop open now" : "Drop lands soon"}: {drop.name} — {drop.pieces.length} pieces
          </p>
        ))}
      </div>

      {pieces === null ? (
        <p className="mx-auto max-w-6xl px-4 pb-10 text-muted">Raising the lights…</p>
      ) : pieces.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 pb-10">
          <p className="empty-state">
            The runway is dark until the first piece publishes. Open the studio, make one, put it on
            the rack — the show starts with yours.
          </p>
        </div>
      ) : (
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-10"
          aria-label="Looks on the runway"
        >
          {pieces.map((piece, index) => (
            <article
              key={piece.id}
              className="studio-card relative w-72 shrink-0 snap-start border-2 border-ink bg-surface sm:w-80"
            >
              <p className="absolute top-2 left-2 z-10 bg-bg px-2 py-1 font-display text-xs tracking-widest uppercase">
                Look {String(index + 1).padStart(2, "0")}
              </p>
              {piece.mockupUrl ? (
                <img
                  src={piece.mockupUrl}
                  alt={`${piece.title} on the runway`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-cream font-display text-4xl" style={{ color: piece.colorHex }}>
                  SR
                </div>
              )}
              <div className="p-3">
                <h2 className="font-display text-lg leading-tight uppercase">{piece.title}</h2>
                <p className="text-sm text-muted">
                  {piece.productName} · {piece.colorName}
                </p>
                {piece.forkedFromTitle ? (
                  <p className="text-sm text-cyan">Forked from “{piece.forkedFromTitle}”</p>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="font-display text-xl">{formatMoney(piece.retailCents)}</p>
                  <Link to="/shop/$slug" params={{ slug: piece.slug }} className="chip chip-on">
                    Peel this look
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
    <FitRescue />
    <CrownFitting />
    <section aria-label="Space to design" className="border-b-4 border-pipe bg-bg text-fg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="tag">Space to Design</p>
        <p className="mt-3 max-w-xl font-display text-2xl leading-tight">
          This floor runs zero third-party ads. Ever.
        </p>
        <p className="mt-2 max-w-xl text-muted">
          The space stays clean so the work can talk. Every piece on this runway carries its own
          kit — hooks, a shot list, a caption — directed in the studio by the person who made it.
          The designers are the advertising here.
        </p>
      </div>
    </section>
    </>
  );
}
