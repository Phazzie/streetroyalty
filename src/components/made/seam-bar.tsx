import { formatMoney } from "@/lib/pod/money";

export type SeamTone = "ink" | "hatch" | "dots" | "cross" | "soft";

export type SeamPart = {
  key: string;
  label: string;
  cents: number;
  tone: SeamTone;
};

const CSS = `
.seam-bar{display:flex;height:2.75rem;border:2px solid var(--color-ink);background:var(--color-surface);overflow:hidden}
.seam-seg{min-width:0;flex-basis:0;transition:flex-grow 600ms cubic-bezier(0.16,1,0.3,1)}
.seam-seg + .seam-seg{border-left:2px dashed var(--color-pipe)}
.seam-ink{background:var(--color-fg)}
.seam-hatch{background:repeating-linear-gradient(135deg,var(--color-fg) 0 2px,transparent 2px 7px)}
.seam-dots{background:radial-gradient(var(--color-fg) 1.5px,transparent 1.7px) 0 0/7px 7px}
.seam-cross{background:repeating-linear-gradient(0deg,var(--color-fg) 0 1.5px,transparent 1.5px 7px),repeating-linear-gradient(90deg,var(--color-fg) 0 1.5px,transparent 1.5px 7px)}
.seam-soft{background:var(--color-lilac-soft)}
.seam-key{display:inline-block;width:1rem;height:1rem;flex:none;border:2px solid var(--color-ink)}
@media (prefers-reduced-motion: reduce){.seam-seg{transition:none}}
`;

/**
 * One strip of cloth cut into parts, with a stitched seam between each. The parts are
 * told apart by weave, not by colour alone, so it reads in greyscale too.
 */
export function SeamBar({ parts, currency = "USD" }: { parts: SeamPart[]; currency?: string }) {
  const shown = parts.filter((part) => part.cents > 0);
  const summary = parts
    .map((part) => `${part.label} ${formatMoney(part.cents, currency)}`)
    .join(", ");

  return (
    <div>
      <style>{CSS}</style>
      <div className="seam-bar" role="img" aria-label={summary}>
        {shown.map((part) => (
          <div
            key={part.key}
            className={`seam-seg seam-${part.tone}`}
            style={{ flexGrow: part.cents }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span aria-hidden="true" className={`seam-key seam-${part.tone}`} />
            <span className="min-w-0 flex-1">{part.label}</span>
            <span className="font-display tabular-nums">{formatMoney(part.cents, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
