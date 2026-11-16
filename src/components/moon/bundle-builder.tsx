import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatMoney } from "@/lib/pod/money";
import { bundlePrice, categorize, completeTheLook, type BundlePiece } from "@/lib/moon/bundle";
import type { DesignSummary } from "@/lib/studio/models";

/**
 * Complete the look: outfits, not items. Pick pieces across kinds; a top,
 * a bottom, and a third kind price as a look. The discount rule is printed
 * on the bundle — and the register still recomputes per piece, so the
 * bundle shows its math instead of hiding it.
 */
export function BundleBuilder({ pieces }: { pieces: DesignSummary[] }) {
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const chosen = pieces.filter((piece) => chosenIds.includes(piece.id));
  const bundlePieces: BundlePiece[] = chosen.map((piece) => ({
    id: piece.id,
    title: piece.title,
    category: categorize(piece.productType),
    retailCents: piece.retailCents,
  }));
  const price = bundlePrice(bundlePieces);
  const suggestions = useMemo(() => completeTheLook(pieces, chosen), [pieces, chosen]);

  const toggle = (id: string) =>
    setChosenIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  if (pieces.length < 2) return null;
  return (
    <section aria-label="Complete the look" className="mb-6 border-2 border-cyan bg-surface p-3">
      <h2 className="font-display text-2xl uppercase">Complete the look</h2>
      <p className="mb-3 text-sm text-muted">
        Outfits, not items. {price.rule} Tap pieces to build the look.
      </p>
      <div className="flex flex-wrap gap-2">
        {pieces.slice(0, 12).map((piece) => (
          <button
            key={piece.id}
            type="button"
            aria-pressed={chosenIds.includes(piece.id)}
            onClick={() => toggle(piece.id)}
            className={`chip ${chosenIds.includes(piece.id) ? "chip-on" : ""}`}
          >
            {piece.title} · {categorize(piece.productType)}
          </button>
        ))}
      </div>
      {chosen.length > 0 ? (
        <div className="mt-3 border-2 border-ink bg-bg p-3">
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex justify-between"><span>Rack total</span><span>{formatMoney(price.subtotalCents)}</span></li>
            <li className="flex justify-between"><span>Bundle cut {price.complete ? "(look complete)" : "(not yet — see the rule)"}</span><span>−{formatMoney(price.discountCents)}</span></li>
            <li className="flex justify-between font-display"><span>Bundle total</span><span>{formatMoney(price.totalCents)}</span></li>
          </ul>
          <p className="mt-2 text-xs text-subtle">
            Test-mode bundle math, printed loud: checkout today recomputes per piece from the
            catalog; the bundle discount is the target this preview proves out.
          </p>
          {suggestions.length > 0 ? (
            <p className="mt-2 text-sm text-muted">
              Missing kinds:{" "}
              {suggestions.map((piece) => (
                <button key={piece.id} type="button" className="underline" onClick={() => toggle(piece.id)}>
                  add {piece.title} ({formatMoney(piece.retailCents)})
                </button>
              )).reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ", ", el]), [])}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {chosen.map((piece) => (
              <Link key={piece.id} to="/shop/$slug" params={{ slug: piece.slug }} className="chip">
                {piece.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
