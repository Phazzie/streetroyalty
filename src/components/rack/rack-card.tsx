import { Link } from "@tanstack/react-router";
import { ClashBadge } from "@/components/rack/clash-badge";
import { CrownButton } from "@/components/rack/crown-button";
import { MakerLine } from "@/components/rack/maker-line";
import { formatMoney } from "@/lib/pod/money";
import type { RackPiece } from "@/lib/social/types";

/** One piece on the rack: the picture and price go to the piece, the maker goes to their page, the crown is a tap. */
export function RackCard({
  piece,
  showMaker = true,
  onCrown,
}: {
  piece: RackPiece;
  showMaker?: boolean;
  onCrown?: (next: { crowned: boolean; crowns: number }) => void;
}) {
  return (
    <article className="studio-card relative flex min-w-0 flex-col border-2 border-ink bg-surface">
      <div className="absolute top-3 left-3 z-10">
        <ClashBadge palette={piece.palette} size="sm" />
      </div>
      <CrownButton
        designId={piece.id}
        crowns={piece.crowns}
        crowned={piece.crownedByMe}
        onChange={onCrown}
        className="absolute top-3 right-3 z-10"
      />
      <Link
        to="/rack/$slug"
        params={{ slug: piece.slug }}
        className="block p-2 pb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg"
      >
        <span className="block">
          {piece.mockupUrl ? (
            <img
              src={piece.mockupUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <span className="block aspect-[4/5] bg-bg" />
          )}
        </span>
        <span className="mt-2 block truncate font-display uppercase">{piece.title}</span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm text-muted">{piece.productName}</span>
          <span className="font-display text-lg">{formatMoney(piece.retailCents)}</span>
        </span>
      </Link>
      {showMaker ? (
        <div className="mt-2 border-t-2 border-line px-2 py-1">
          <MakerLine maker={piece.maker} />
        </div>
      ) : (
        <div className="h-2" />
      )}
    </article>
  );
}
