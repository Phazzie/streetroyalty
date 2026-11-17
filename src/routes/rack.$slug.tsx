import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClashBadge } from "@/components/rack/clash-badge";
import { CrownButton } from "@/components/rack/crown-button";
import { FamilyTree } from "@/components/rack/family-tree";
import { FollowButton } from "@/components/rack/follow-button";
import { MakerLine } from "@/components/rack/maker-line";
import { MoneySplit } from "@/components/rack/money-split";
import { PieceTag } from "@/components/rack/piece-tag";
import { RackCard } from "@/components/rack/rack-card";
import { RemixButton } from "@/components/rack/remix-button";
import { Note, StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { printNote } from "@/lib/ai/api";
import { localPrintNote } from "@/lib/ai/local";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { makerPage, rackPiece } from "@/lib/social/api";
import { cartAdd } from "@/lib/studio/api";
import { createSingleFlight } from "@/lib/ui/single-flight";

export const Route = createFileRoute("/rack/$slug")({ component: ProductPage });

type Piece = Awaited<ReturnType<typeof rackPiece>>;
type Shop = Awaited<ReturnType<typeof makerPage>>;

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [advice, setAdvice] = useState("");
  const flight = useRef(createSingleFlight());
  const viewerId = user?.id ?? "";

  useEffect(() => {
    if (isPending) return;
    let live = true;
    setError("");
    void rackPiece({ data: { slug } })
      .then((next) => {
        if (!live) return;
        setPiece(next);
        setVariantId(next.variantId);
        if (!next.maker.handle) return;
        // The maker's follow state and their other pieces. The page works without it.
        void makerPage({ data: { handle: next.maker.handle } })
          .then((page) => {
            if (live) setShop(page);
          })
          .catch(() => undefined);
      })
      .catch((reason: unknown) => {
        if (!live) return;
        setPiece(null);
        setError(reason instanceof Error ? reason.message : "Missing piece.");
      });
    return () => {
      live = false;
    };
  }, [slug, viewerId, isPending]);

  const size = piece?.sizes.find((item) => item.variantId === variantId);
  const more = shop?.pieces.filter((item) => item.slug !== slug).slice(0, 3) ?? [];

  return (
    <StudioShell current="/rack">
      {error ? (
        <div className="grid gap-4">
          <Note>{error}</Note>
          <p>
            <Link to="/rack" className="chip">
              Back to the rack
            </Link>
          </p>
        </div>
      ) : null}
      {piece ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="min-w-0">
              {piece.mockupUrl ? (
                <img
                  src={piece.mockupUrl}
                  alt={piece.title}
                  decoding="async"
                  className="w-full border-2 border-ink object-contain"
                />
              ) : (
                <div className="aspect-[4/5] border-2 border-ink bg-surface" />
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <CrownButton
                  designId={piece.id}
                  crowns={piece.crowns}
                  crowned={piece.crownedByMe}
                  size="md"
                  className="items-start"
                  onChange={(next) =>
                    setPiece((current) =>
                      current
                        ? { ...current, crowns: next.crowns, crownedByMe: next.crowned }
                        : current,
                    )
                  }
                />
                <ClashBadge palette={piece.palette} size="md" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="tag">{piece.productType}</p>
              <h1 className="mt-3 font-display text-4xl leading-none break-words">{piece.title}</h1>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y-2 border-line py-2">
                <MakerLine maker={piece.maker} size="md" className="flex-1" />
                <FollowButton
                  handle={piece.maker.handle}
                  following={shop?.maker.followedByMe ?? false}
                  isMe={shop?.maker.isMe ?? false}
                />
              </div>
              <p className="mt-4 text-muted">
                {piece.productName} · {piece.colorName} · {piece.placement} print
              </p>
              <p className="mt-4 font-display text-3xl">
                {formatMoney(size?.retailCents ?? piece.retailCents)}
              </p>
              <p className="mt-4 text-sm text-muted">Size</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {piece.sizes.map((item) => (
                  <button
                    key={item.variantId}
                    type="button"
                    aria-pressed={item.variantId === variantId}
                    onClick={() => setVariantId(item.variantId)}
                    className={`chip ${item.variantId === variantId ? "chip-on" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-4 w-full"
                disabled={adding}
                onClick={() => {
                  if (!piece) return;
                  void flight.current(async () => {
                    try {
                      const result = await printNote({
                        data: { placement: piece.placement, product: piece.productName },
                      });
                      setAdvice(result.note);
                    } catch {
                      setAdvice(localPrintNote(piece.placement, piece.productName));
                    }
                  });
                }}
              >
                Will this print?
              </Button>
              {advice ? <p className="mt-3 text-sm text-muted">{advice}</p> : null}
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
              <div className="mt-4 grid gap-4 empty:hidden">
                <RemixButton designId={piece.id} slug={piece.slug} />
                <MoneySplit
                  retailCents={size?.retailCents ?? piece.retailCents}
                  productType={piece.productType}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-6 empty:hidden md:grid-cols-2">
            <FamilyTree slug={piece.slug} />
            <PieceTag
              slug={piece.slug}
              title={piece.title}
              makerHandle={piece.maker.handle || undefined}
            />
          </div>
          {more.length > 0 && piece.maker.handle ? (
            <section className="mt-10" aria-labelledby="more-from-maker">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h2 id="more-from-maker" className="font-display text-xl leading-none uppercase">
                  More from {piece.maker.name}
                </h2>
                <Link to="/m/$handle" params={{ handle: piece.maker.handle }} className="chip">
                  Their whole rack
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {more.map((item) => (
                  <RackCard key={item.id} piece={item} showMaker={false} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </StudioShell>
  );
}
