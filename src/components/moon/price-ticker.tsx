import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/pod/money";
import type { TickerBreakdown } from "@/lib/moon/pricing";

/**
 * The price is a material, not a tag. The number rolls to its new value
 * and the meter shows every cent's job. Display only — the server
 * recomputes the real price from the catalog variant on save/checkout.
 */
export function PriceTicker({ breakdown }: { breakdown: TickerBreakdown }) {
  const [shown, setShown] = useState(breakdown.retailCents);
  const [flash, setFlash] = useState<"" | "up" | "down">("");
  const previous = useRef(breakdown.retailCents);

  useEffect(() => {
    const from = previous.current;
    const to = breakdown.retailCents;
    previous.current = to;
    if (from === to) return;
    setFlash(to > from ? "up" : "down");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(to);
      return;
    }
    const started = performance.now();
    const duration = 420;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else window.setTimeout(() => setFlash(""), 350);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [breakdown.retailCents]);

  return (
    <div className="border-2 border-ink bg-bg p-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-xs tracking-widest uppercase">Live meter</p>
        <p
          className={`font-display text-3xl tabular-nums transition-colors ${
            flash === "up" ? "text-orange" : flash === "down" ? "text-cyan" : ""
          }`}
        >
          {formatMoney(shown)}
        </p>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
        {breakdown.lines.map((line) => (
          <li key={line.key} className="flex justify-between gap-2">
            <span>{line.label}</span>
            <span className="tabular-nums">{formatMoney(line.cents)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-2 border-t border-line pt-1 text-fg">
          <span>With the house markup</span>
          <span className="tabular-nums">{formatMoney(breakdown.retailCents)}</span>
        </li>
      </ul>
      <p className="mt-2 text-xs text-subtle">
        Meter math is the estimate. The register recomputes from the catalog when you save or check
        out — the meter never sets the price.
      </p>
    </div>
  );
}
