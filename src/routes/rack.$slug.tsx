import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClashBadge } from "@/components/rack/clash-badge";
import { CrownButton } from "@/components/rack/crown-button";
import { FamilyTree } from "@/components/rack/family-tree";
import { FollowButton } from "@/components/rack/follow-button";
import { MakerLine } from "@/components/rack/maker-line";
import { MoneySplit } from "@/components/rack/money-split";
import { PieceOptions } from "@/components/rack/piece-options";
import { PieceTag } from "@/components/rack/piece-tag";
import { RackCard } from "@/components/rack/rack-card";
import { RemixButton } from "@/components/rack/remix-button";
import { ReportLink } from "@/components/rack/report-link";
import { ScanStrip } from "@/components/rack/scan-strip";
import { TryOn } from "@/components/rack/try-on";
import { Note, StudioShell } from "@/components/studio/shell";
import { formatMoney } from "@/lib/pod/money";
import { houseBlank, houseBlankByPrintfulId } from "@/lib/pod/house-blanks";
import { SignInCall } from "@/components/ai/sign-in-call";
import { useAiPrompt } from "@/components/ai/use-paid-ai";
import { isUnauthorized } from "@/lib/ai/access";
import { printNote } from "@/lib/ai/api";
import { localPrintNote } from "@/lib/ai/local";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { makerPage, rackPiece } from "@/lib/social/api";
import { cartAdd } from "@/lib/studio/api";
import { AOP_ORDER_CLOSED, canOrderProduct } from "@/lib/studio/garments";
import { createSingleFlight } from "@/lib/ui/single-flight";

export const Route = createFileRoute("/rack/$slug")({ component: ProductPage });

type Piece = Awaited<ReturnType<typeof rackPiece>>;
type Shop = Awaited<ReturnType<typeof makerPage>>;

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const ai = useAiPrompt();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [variantId, setVariantId] = useState("");
  const [colorwayId, setColorwayId] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState("");
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
        // The saved size can sell out at Printful. Start on one that is still made.
        setVariantId(
          next.sizes.some((item) => item.variantId === next.variantId)
            ? next.variantId
            : (next.sizes[0]?.variantId ?? ""),
        );
        setColorwayId(next.activeColorwayId ?? next.colorways[0]?.id ?? "");
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
          <ScanStrip slug={piece.slug} />
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
                {shop ? (
                  <FollowButton
                    handle={piece.maker.handle}
                    following={shop.maker.followedByMe}
                    isMe={shop.maker.isMe}
                  />
                ) : (
                  // Holds the button's place until we know whether you follow them, or it is you.
                  <span aria-hidden="true" className="block min-h-11 w-24" />
                )}
              </div>
              <PieceOptions piece={piece} colorwayId={colorwayId} onColorway={setColorwayId} />
              <p className="mt-4 font-display text-3xl">
                {formatMoney(size?.retailCents ?? piece.retailCents)}
              </p>
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <p className="text-sm text-muted">Size</p>
                <Link
                  to="/sizes"
                  hash={sizeGuideAnchor(piece.templateId)}
                  className="text-sm text-fg underline underline-offset-4"
                >
                  Size guide
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {piece.sizes.map((item) => (
                  <button
                    key={item.variantId}
                    type="button"
                    aria-pressed={item.variantId === variantId}
                    onClick={() => setVariantId(item.variantId)}
                    className={`chip min-w-11 ${item.variantId === variantId ? "chip-on" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {ai.showSignIn ? (
                <div className="mt-4">
                  <SignInCall>Sign in for a print note from the crown.</SignInCall>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="mt-4 w-full"
                  disabled={adding || ai.blocked}
                  onClick={() => {
                    if (!piece || ai.blocked) return;
                    void flight.current(async () => {
                      try {
                        const result = await printNote({
                          data: { placement: piece.placement, product: piece.productName },
                        });
                        setAdvice(result.note);
                      } catch (reason) {
                        if (ai.refused(reason)) return;
                        setAdvice(localPrintNote(piece.placement, piece.productName));
                      }
                    });
                  }}
                >
                  Will this print?
                </Button>
              )}
              {advice ? <p className="mt-3 text-sm text-muted">{advice}</p> : null}
              {piece.construction !== "aop" || canOrderProduct(piece.productId) ? (
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  disabled={adding || !variantId}
                  onClick={() => {
                    void flight.current(async () => {
                      setAdding(true);
                      setCartError("");
                      try {
                        await cartAdd({
                          data: {
                            designId: piece.id,
                            variantId,
                            colorwayId: colorwayId || undefined,
                          },
                        });
                        void navigate({ to: "/cart" });
                      } catch (reason: unknown) {
                        // The cart lives on your account. Sign in, then land back on this piece.
                        if (isUnauthorized(reason)) {
                          void navigate({ to: "/login", search: { next: `/rack/${slug}` } });
                          return;
                        }
                        setCartError(
                          reason instanceof Error ? reason.message : "Could not add it. Try again.",
                        );
                      } finally {
                        setAdding(false);
                      }
                    });
                  }}
                >
                  Add to cart
                </Button>
              ) : (
                <p className="mt-6 border-2 border-ink p-3 text-sm">{AOP_ORDER_CLOSED}</p>
              )}
              {cartError ? (
                <p role="alert" className="mt-3 border-2 border-pipe p-3 text-sm">
                  {cartError}
                </p>
              ) : null}
              {!user && !isPending ? (
                <p className="mt-2 text-sm text-muted">You'll sign in first. The cart stays on your account.</p>
              ) : null}
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
          <div className="mt-10">
            <TryOn
              slug={piece.slug}
              title={piece.title}
              mockupUrl={piece.mockupUrl}
              productType={piece.productType}
              colorName={piece.colorName}
              placement={piece.placement}
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
          <div className="mt-10 flex justify-end border-t border-line pt-3">
            <ReportLink kind="piece" slug={piece.slug} />
          </div>
        </>
      ) : null}
    </StudioShell>
  );
}

/** Where this piece's blank sits on the size guide. */
function sizeGuideAnchor(templateId: string): string | undefined {
  return (houseBlank(templateId) ?? houseBlankByPrintfulId(templateId))?.id;
}
