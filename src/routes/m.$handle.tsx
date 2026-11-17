import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShopWindow, ShutWindow } from "@/components/makers/shop-window";
import { FollowButton } from "@/components/rack/follow-button";
import { RackCard } from "@/components/rack/rack-card";
import { Note, StudioShell } from "@/components/studio/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { makerPage } from "@/lib/social/api";

export const Route = createFileRoute("/m/$handle")({ component: MakerPage });

type Shop = Awaited<ReturnType<typeof makerPage>>;

function MakerPage() {
  const { handle } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [shop, setShop] = useState<Shop | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const viewerId = user?.id ?? "";

  useEffect(() => {
    if (isPending) return;
    let live = true;
    setMissing(false);
    setError("");
    void makerPage({ data: { handle } })
      .then((next) => {
        if (live) setShop(next);
      })
      .catch((reason: unknown) => {
        if (!live) return;
        setShop(null);
        const message = reason instanceof Error ? reason.message : "";
        if (message === "No maker goes by that handle.") setMissing(true);
        else setError(message || "This page did not load.");
      });
    return () => {
      live = false;
    };
  }, [handle, viewerId, isPending]);

  return (
    <StudioShell current="/rack">
      {error ? <Note>{error}</Note> : null}
      {missing ? (
        <ShutWindow handle={handle.replace(/^@+/, "").slice(0, 40)}>
          <Link to="/rack" className="chip chip-on">
            Back to the rack
          </Link>
        </ShutWindow>
      ) : null}
      {shop ? (
        <>
          <ShopWindow
            maker={shop.maker}
            pieces={shop.pieces}
            action={
              <FollowButton
                handle={shop.maker.handle}
                following={shop.maker.followedByMe}
                isMe={shop.maker.isMe}
                onChange={(next) =>
                  setShop((current) => {
                    if (!current) return current;
                    const was = current.maker.followedByMe;
                    const followers =
                      next.followers ??
                      Math.max(
                        0,
                        current.maker.followers +
                          (next.following === was ? 0 : next.following ? 1 : -1),
                      );
                    return {
                      ...current,
                      maker: { ...current.maker, followedByMe: next.following, followers },
                    };
                  })
                }
              />
            }
          />
          <section className="mt-8" aria-labelledby="maker-rack">
            <h2 id="maker-rack" className="mb-3 font-display text-xl leading-none uppercase">
              On the rack
            </h2>
            {shop.pieces.length === 0 ? (
              <div className="empty-state">
                <p>
                  {shop.maker.isMe
                    ? "Your window is empty. Publish a piece from the studio and it hangs here."
                    : "Nothing in the window yet."}
                </p>
                {shop.maker.isMe ? (
                  <p className="mt-4">
                    <Link to="/studio" className="chip chip-on">
                      Open the studio
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {shop.pieces.map((piece) => (
                  <RackCard
                    key={piece.id}
                    piece={piece}
                    showMaker={false}
                    onCrown={(next) =>
                      setShop((current) => {
                        if (!current) return current;
                        const before = current.pieces.find((item) => item.id === piece.id);
                        const shift = before ? next.crowns - before.crowns : 0;
                        return {
                          maker: {
                            ...current.maker,
                            crowns: Math.max(0, current.maker.crowns + shift),
                          },
                          pieces: current.pieces.map((item) =>
                            item.id === piece.id
                              ? { ...item, crowns: next.crowns, crownedByMe: next.crowned }
                              : item,
                          ),
                        };
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </StudioShell>
  );
}
