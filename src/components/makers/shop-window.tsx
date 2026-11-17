import type { ReactNode } from "react";
import { MakerCrown } from "@/components/makers/maker-crown";
import type { MakerProfile, RackPiece } from "@/lib/social/types";

const STYLE = `
.mkw-awning { position: relative; z-index: 1; height: 3.25rem; border: 2px solid var(--color-ink); transform-origin: 50% 0; animation: mkw-unroll 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.mkw-fringe { position: relative; z-index: 1; height: 16px; margin: 0 2px -16px; transform-origin: 50% 0; -webkit-mask: radial-gradient(circle 15px at 50% 0, #000 96%, transparent) 0 0 / 28px 16px repeat-x; mask: radial-gradient(circle 15px at 50% 0, #000 96%, transparent) 0 0 / 28px 16px repeat-x; animation: mkw-unroll 700ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both, mkw-sway 5.5s 900ms ease-in-out infinite; }
.mkw-sign { animation: mkw-rise 600ms 160ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.mkw-shutter { background: repeating-linear-gradient(180deg, var(--color-surface) 0 14px, var(--color-line) 14px 16px); }
@keyframes mkw-unroll { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes mkw-sway { 0%, 100% { transform: skewX(0deg); } 30% { transform: skewX(5deg); } 65% { transform: skewX(-4deg); } }
@keyframes mkw-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .mkw-awning, .mkw-fringe, .mkw-sign { animation: none; }
}
`;

const STRIPE = 28;

/** The colours this maker actually prints with, most used first, as awning stripes. */
export function awningColors(pieces: RackPiece[]): string[] {
  const counts = new Map<string, number>();
  for (const piece of pieces)
    for (const color of piece.palette) counts.set(color, (counts.get(color) ?? 0) + 1);
  const colors = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([color]) => color)
    .slice(0, 5);
  for (const spare of ["#f5ebdd", "#14081c"]) {
    if (colors.length >= 2) break;
    if (!colors.includes(spare)) colors.push(spare);
  }
  return colors;
}

function stripes(colors: string[]): string {
  const stops = colors.map(
    (color, index) => `${color} ${index * STRIPE}px ${(index + 1) * STRIPE}px`,
  );
  return `repeating-linear-gradient(90deg, ${stops.join(", ")})`;
}

function since(joinedAt: string): string {
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 border-2 border-ink bg-surface px-2 py-3 text-center">
      <dd className="font-display text-3xl leading-none tabular-nums">{value}</dd>
      <dt className="mt-1 truncate text-xs tracking-wide text-muted uppercase">{label}</dt>
    </div>
  );
}

/**
 * The top of a maker's page, dressed as their shop front. The awning is striped in
 * the colours of their own pieces, so no two fronts match.
 */
export function ShopWindow({
  maker,
  pieces,
  action,
}: {
  maker: MakerProfile;
  pieces: RackPiece[];
  action: ReactNode;
}) {
  const band = stripes(awningColors(pieces));
  const opened = since(maker.joinedAt);
  return (
    <header>
      <style>{STYLE}</style>
      <div aria-hidden="true">
        <div className="mkw-awning" style={{ background: band }} />
        <div className="mkw-fringe" style={{ background: band }} />
      </div>
      <div className="mkw-sign paper mx-2 border-2 border-t-0 border-ink px-4 pt-9 pb-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <MakerCrown handle={maker.handle} size={64} />
            <div className="min-w-0">
              <p className="font-display text-sm break-all">@{maker.handle}</p>
              {opened ? <p className="text-sm text-muted">On the rack since {opened}</p> : null}
            </div>
          </div>
          {action}
        </div>
        <h1 className="display mt-5 text-[clamp(2.75rem,12vw,6rem)] break-words">{maker.name}</h1>
        {maker.bio ? (
          <p className="mt-4 max-w-2xl border-l-4 border-ink pl-3 text-lg break-words">
            {maker.bio}
          </p>
        ) : maker.isMe ? (
          <p className="mt-4 max-w-2xl text-muted">
            No bio yet. Say what you make in a line or two.
          </p>
        ) : null}
        <dl className="mt-6 grid grid-cols-3 gap-2 sm:max-w-md">
          <Count value={maker.pieces} label={maker.pieces === 1 ? "Piece" : "Pieces"} />
          <Count value={maker.followers} label={maker.followers === 1 ? "Follower" : "Followers"} />
          <Count value={maker.crowns} label={maker.crowns === 1 ? "Crown" : "Crowns"} />
        </dl>
      </div>
    </header>
  );
}

/** Nobody has this handle. A shop front with the shutter down. */
export function ShutWindow({ handle, children }: { handle: string; children: ReactNode }) {
  return (
    <div>
      <style>{STYLE}</style>
      <div className="mkw-shutter border-2 border-ink px-4 py-16 text-center sm:py-24">
        <div className="mx-auto inline-block max-w-full border-2 border-ink bg-bg px-5 py-6">
          <h1 className="display text-[clamp(2.25rem,10vw,4.5rem)] break-words">
            Nobody trades here
          </h1>
          <p className="mt-3 break-all text-muted">No maker goes by @{handle}.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
