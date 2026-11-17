import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SeamBar } from "@/components/made/seam-bar";
import { bpsToPercent, CARD_FEE_BPS, CARD_FEE_FIXED_CENTS, splitRetail } from "@/lib/made/math";
import { formatMoney } from "@/lib/pod/money";
import { getStudioConfig } from "@/lib/studio/api";

type Config = { markup: number; currency: string };

/**
 * "Where the money goes" for one piece. An estimate: making it is about the price divided
 * by the studio markup. Maker payouts are not switched on, and it says so.
 */
export function MoneySplit({
  retailCents,
  productType,
}: {
  retailCents: number;
  productType: string;
}) {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    let live = true;
    void getStudioConfig()
      .then((result) => {
        if (live) setConfig({ markup: result.markup, currency: result.currency });
      })
      .catch(() => {
        if (live) setConfig(null);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!config || !(retailCents > 0)) return null;

  const split = splitRetail(retailCents, config.markup);
  const garment = productType.trim() ? productType.trim().toLowerCase() : "garment";

  return (
    <section
      aria-labelledby="money-split-title"
      className="border-2 border-ink bg-surface p-4 text-fg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="money-split-title" className="font-display text-sm tracking-wider uppercase">
          Where the money goes
        </h2>
        <span className="border-2 border-ink px-2 py-0.5 font-display text-[0.68rem] tracking-widest uppercase">
          Estimate
        </span>
      </div>
      <div className="mt-3">
        <SeamBar
          currency={config.currency}
          parts={[
            { key: "making", label: "Making it", cents: split.makingCents, tone: "ink" },
            { key: "fee", label: "The card fee", cents: split.cardFeeCents, tone: "hatch" },
            { key: "left", label: "What is left", cents: split.leftCents, tone: "soft" },
          ]}
        />
      </div>
      <p className="mt-3 text-sm text-muted">
        Maker payouts are not switched on yet, so today what is left goes to Street Royalty.
      </p>
      <details className="mt-2 text-sm">
        <summary className="flex min-h-11 items-center font-display text-xs tracking-wider uppercase underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg">
          How we worked this out
        </summary>
        <dl className="grid gap-3 border-t-2 border-line pt-3 text-muted">
          <div>
            <dt className="font-bold text-fg">
              Making it, about {formatMoney(split.makingCents, config.currency)}
            </dt>
            <dd>
              The blank {garment} and the print. We do not have the exact bill for this piece, so
              this is the price divided by {config.markup}, the studio markup today.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-fg">
              The card fee, about {formatMoney(split.cardFeeCents, config.currency)}
            </dt>
            <dd>
              {bpsToPercent(CARD_FEE_BPS)} percent plus {CARD_FEE_FIXED_CENTS} cents, a common
              rate for taking a card. The real fee can differ.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-fg">
              What is left, about {formatMoney(split.leftCents, config.currency)}
            </dt>
            <dd>
              The price of {formatMoney(split.retailCents, config.currency)} minus the two parts
              above. Shipping and tax are added at checkout and are not in this bar.
            </dd>
          </div>
        </dl>
        <Link
          to="/math"
          className="mt-3 inline-flex min-h-11 items-center font-display text-xs tracking-wider uppercase underline decoration-2 underline-offset-4"
        >
          Do the math on your own piece
        </Link>
      </details>
    </section>
  );
}
