import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { isMissing, type MissingPiece, type SheetPiece } from "@/lib/episodes/sheet";
import { refKey } from "@/lib/episodes/types";

export type Look = {
  cast: string;
  role: string;
  pieces: (SheetPiece | MissingPiece)[];
};

export function ShopIt({ piece, className }: { piece: SheetPiece; className?: string }) {
  const classes = cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1 bg-accent px-3 font-display text-xs tracking-wider text-accent-fg uppercase",
    className,
  );
  const label = (
    <>
      Shop it
      <span className="sr-only">: {piece.name}</span>
      <ArrowUpRight className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
    </>
  );
  return piece.ref.kind === "rack" ? (
    <Link to="/rack/$slug" params={{ slug: piece.ref.slug }} className={classes}>
      {label}
    </Link>
  ) : (
    <Link to="/rack" className={classes}>
      {label}
    </Link>
  );
}

export function PieceRow({
  piece,
  delay = 0,
  animate = true,
}: {
  piece: SheetPiece | MissingPiece;
  delay?: number;
  animate?: boolean;
}) {
  if (isMissing(piece)) {
    return (
      <li className="border-2 border-dashed border-line px-3 py-3 text-sm text-muted">
        A piece planned for this scene is not{" "}
        {piece.ref.kind === "shop" ? "in the sets" : "on the rack"} right now.
      </li>
    );
  }
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-2 border-ink bg-surface p-2",
        animate && "ep-in",
      )}
      style={{ "--ep-delay": `${delay}ms` } as React.CSSProperties}
    >
      <div className="h-20 w-16 shrink-0 overflow-hidden bg-cream">
        {piece.imageUrl ? (
          <img
            src={piece.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="display text-2xl leading-none">{piece.name}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          {piece.baseColor?.hex ? (
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 border border-ink"
              style={{ background: piece.baseColor.hex }}
              aria-hidden="true"
            />
          ) : null}
          <span className="truncate">
            {piece.baseColor ? `${piece.baseColor.name} ` : ""}
            {piece.source === "shop" ? piece.garment : "custom from the rack"}
          </span>
        </p>
      </div>
      <ShopIt piece={piece} />
    </li>
  );
}

/**
 * Who is on screen at the playhead, and what each of them is wearing. The key on
 * the list restarts the slide-in whenever the wardrobe changes, so a cut reads as
 * a cut.
 */
export function OnScreenNow({
  looks,
  cutKey,
  planned,
  className,
}: {
  looks: Look[];
  cutKey: string;
  planned: boolean;
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby="ep-on-screen">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
        <h2 id="ep-on-screen" className="display text-4xl">
          On screen now
        </h2>
        {planned ? <span className="eyebrow text-subtle">Planned</span> : null}
      </div>
      <div aria-live="polite" aria-atomic="false">
        {looks.length === 0 ? (
          <p className="mt-4 border-2 border-dashed border-line px-3 py-6 text-center text-muted">
            Nobody is on screen at this point.
          </p>
        ) : (
          <div key={cutKey} className="mt-4 flex flex-col gap-6">
            {looks.map((look, lookIndex) => (
              <div key={look.cast}>
                <p className="font-display text-sm tracking-wider uppercase">{look.cast}</p>
                {look.role ? <p className="text-sm text-muted">{look.role}</p> : null}
                {look.pieces.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No wardrobe set for this scene.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {look.pieces.map((piece, index) => (
                      <PieceRow
                        key={refKey(piece.ref)}
                        piece={piece}
                        delay={lookIndex * 90 + index * 60}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
