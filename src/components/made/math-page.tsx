import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SeamBar } from "@/components/made/seam-bar";
import { StudioShell } from "@/components/studio/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  bpsToPercent,
  dollarsToCents,
  percentToBps,
  planFromSearch,
  runPlan,
  searchFromPlan,
  type Plan,
  type PlanSearch,
} from "@/lib/made/math";
import { centsToDecimal, formatMoney } from "@/lib/pod/money";
import { getCatalogProduct, listCatalog } from "@/lib/studio/api";

const CSS = `
.dm-receipt{position:relative;transform:rotate(-0.6deg);border:2px solid var(--color-ink);border-bottom:0}
.dm-receipt::after{content:"";position:absolute;left:-2px;right:-2px;bottom:-12px;height:12px;
  background:
    linear-gradient(135deg,var(--color-bg) 8.5px,transparent 0) 0 0/12px 12px repeat-x,
    linear-gradient(225deg,var(--color-bg) 8.5px,transparent 0) 0 0/12px 12px repeat-x}
.dm-leader{flex:1;min-width:0.75rem;border-bottom:2px dotted var(--color-line);transform:translateY(-0.3em)}
.dm-stamp{display:inline-block;animation:dm-stamp 420ms cubic-bezier(0.16,1,0.3,1)}
@keyframes dm-stamp{from{transform:scale(1.18) rotate(-3deg);opacity:0.4}to{transform:none;opacity:1}}
.dm-feed{animation:dm-feed 700ms cubic-bezier(0.16,1,0.3,1)}
@keyframes dm-feed{from{clip-path:inset(0 0 100% 0);transform:translateY(-14px) rotate(-0.6deg)}to{clip-path:inset(0 0 -20px 0);transform:rotate(-0.6deg)}}
@media (prefers-reduced-motion: reduce){.dm-stamp,.dm-feed{animation:none}}
`;

type Preset = {
  id: string;
  name: string;
  type: string;
  /** The lowest wholesale price across sizes and colours, when the catalog gives one. */
  wholesaleCents: number | null;
};

type Catalog = { mode: "sandbox" | "live"; presets: Preset[] } | "loading" | "failed";

function useCatalog(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>("loading");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const page = await listCatalog({ data: { limit: 6 } });
        const presets = await Promise.all(
          page.products.map(async (product): Promise<Preset> => {
            try {
              const full = await getCatalogProduct({ data: { productId: product.id } });
              const costs = full.variants.flatMap((variant) =>
                variant.wholesaleCents != null && variant.wholesaleCents > 0
                  ? [variant.wholesaleCents]
                  : [],
              );
              return {
                id: product.id,
                name: product.name,
                type: product.type,
                wholesaleCents: costs.length > 0 ? Math.min(...costs) : null,
              };
            } catch {
              return {
                id: product.id,
                name: product.name,
                type: product.type,
                wholesaleCents: null,
              };
            }
          }),
        );
        if (live) setCatalog({ mode: page.podMode, presets });
      } catch {
        if (live) setCatalog("failed");
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return catalog;
}

function Field({
  label,
  hint,
  value,
  onCommit,
  prefix,
  suffix,
  inputMode = "decimal",
}: {
  label: string;
  hint?: string;
  value: string;
  onCommit: (text: string) => void;
  prefix?: string;
  suffix?: string;
  inputMode?: "decimal" | "numeric";
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="mt-1 flex h-12 items-center rounded-md border-2 border-ink bg-cream focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-fg">
        {prefix ? (
          <span aria-hidden="true" className="pl-3 font-display text-subtle">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          inputMode={inputMode}
          autoComplete="off"
          value={text}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(event) => {
            focused.current = true;
            event.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            setText(value);
          }}
          onChange={(event) => {
            setText(event.target.value);
            onCommit(event.target.value);
          }}
          className="h-full w-full min-w-0 bg-transparent px-2 text-base text-fg tabular-nums outline-none"
        />
        {suffix ? (
          <span aria-hidden="true" className="pr-3 text-sm whitespace-nowrap text-subtle">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, cents, sign }: { label: string; cents: number; sign: "+" | "-" | "" }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="min-w-0">{label}</span>
      <span aria-hidden="true" className="dm-leader" />
      <span className="font-display tabular-nums">
        {sign === "-" ? "- " : sign === "+" ? "+ " : ""}
        {formatMoney(cents)}
      </span>
    </div>
  );
}

function pieces(count: number): string {
  return count === 1 ? "1 piece" : `${count.toLocaleString("en-US")} pieces`;
}

export function MathPage({
  search,
  onChange,
}: {
  search: PlanSearch;
  onChange: (next: PlanSearch) => void;
}) {
  const plan = planFromSearch(search);
  const result = runPlan(plan);
  const catalog = useCatalog();
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<Plan>, blankId: string | undefined = search.b) =>
    onChange(searchFromPlan({ ...plan, ...patch }, blankId));

  const money = (cents: number) => centsToDecimal(cents);
  const losing = result.keepCents < 0;
  const flat = result.keepCents === 0;
  const perWeek =
    result.piecesForTarget != null ? Math.ceil((result.piecesForTarget * 12) / 52) : null;

  return (
    <StudioShell current="/rack">
      <style>{CSS}</style>
      <p className="tag">For makers</p>
      <h1 className="mt-3 font-display text-4xl leading-none">Do the math</h1>
      <p className="mt-2 max-w-xl text-muted">
        Type your own numbers and see what one piece really leaves you. This is arithmetic, not a
        forecast. Nobody can tell you how many you will sell.
      </p>

      <p
        aria-hidden="true"
        className="sticky top-16 z-10 -mx-4 mt-4 flex items-baseline justify-between gap-3 border-y-2 border-ink bg-bg px-4 py-2 lg:hidden"
      >
        <span className="eyebrow text-subtle">You keep, per piece</span>
        <span className="font-display text-xl tabular-nums">
          {losing ? "- " : ""}
          {formatMoney(Math.abs(result.keepCents))}
        </span>
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <form className="grid min-w-0 gap-6" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="grid min-w-0 gap-3">
            <legend className="font-display text-sm tracking-wider uppercase">1. The piece</legend>
            <Field
              label="What you charge"
              prefix="$"
              value={money(plan.priceCents)}
              onCommit={(text) => set({ priceCents: dollarsToCents(text) })}
            />
            <div>
              <p id="dm-presets" className="text-sm font-bold">
                What it costs to make
              </p>
              <p className="text-xs text-subtle">
                The blank and the print. Pick one from the catalog or type your own.
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="dm-presets">
                {catalog === "loading" ? (
                  <span className="text-sm text-subtle">Reading the catalog.</span>
                ) : catalog === "failed" ? (
                  <span className="text-sm text-subtle">
                    The catalog did not load. Type the cost below.
                  </span>
                ) : (
                  catalog.presets.map((preset) => {
                    const on = search.b === preset.id && plan.makeCents === preset.wholesaleCents;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={preset.wholesaleCents == null}
                        aria-pressed={on}
                        onClick={() =>
                          preset.wholesaleCents != null &&
                          set({ makeCents: preset.wholesaleCents }, preset.id)
                        }
                        className={cn(
                          "chip h-auto min-h-11 flex-col items-start gap-0 py-1.5 text-left normal-case disabled:border-line disabled:bg-line disabled:text-muted",
                          on && "chip-on",
                        )}
                      >
                        <span className="text-[0.78rem] uppercase">{preset.type}</span>
                        <span className="font-sans text-xs tracking-normal">
                          {preset.wholesaleCents != null
                            ? `from ${formatMoney(preset.wholesaleCents)}`
                            : "no cost listed"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {typeof catalog === "object" ? (
                <p className="mt-2 text-xs text-subtle">
                  {catalog.mode === "sandbox"
                    ? "The studio is in sandbox, so these costs are stand-ins and not real quotes. Smallest size shown."
                    : "Costs come from the printer's catalog today. Smallest size shown, bigger sizes cost more."}
                </p>
              ) : null}
            </div>
            <Field
              label="Cost to make one"
              prefix="$"
              value={money(plan.makeCents)}
              onCommit={(text) => set({ makeCents: dollarsToCents(text) }, undefined)}
            />
          </fieldset>

          <fieldset className="grid min-w-0 gap-3">
            <legend className="font-display text-sm tracking-wider uppercase">2. Shipping</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="You charge"
                prefix="$"
                value={money(plan.shipChargedCents)}
                onCommit={(text) => set({ shipChargedCents: dollarsToCents(text) })}
              />
              <Field
                label="You pay"
                prefix="$"
                value={money(plan.shipPaidCents)}
                onCommit={(text) => set({ shipPaidCents: dollarsToCents(text) })}
              />
            </div>
            <p className="text-xs text-subtle">
              If you offer free shipping, set what you charge to 0. You still pay to send it.
            </p>
          </fieldset>

          <fieldset className="grid min-w-0 gap-3">
            <legend className="font-display text-sm tracking-wider uppercase">3. The cuts</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Card fee"
                suffix="%"
                value={bpsToPercent(plan.feeBps)}
                onCommit={(text) => set({ feeBps: percentToBps(text) })}
              />
              <Field
                label="Plus, per sale"
                prefix="$"
                value={money(plan.feeFixedCents)}
                onCommit={(text) => set({ feeFixedCents: dollarsToCents(text) })}
              />
            </div>
            <Field
              label="House cut"
              suffix="% of the price"
              hint="Not decided yet. Street Royalty has not set a cut, so this starts at 0. Move it to see what a cut would do."
              value={bpsToPercent(plan.houseBps)}
              onCommit={(text) => set({ houseBps: percentToBps(text) })}
            />
          </fieldset>

          <fieldset className="grid min-w-0 gap-3">
            <legend className="font-display text-sm tracking-wider uppercase">4. Your month</legend>
            <Field
              label="Pieces sold a month"
              inputMode="numeric"
              hint="Your guess. Try a low one and a high one."
              value={String(plan.perMonth)}
              onCommit={(text) =>
                set({ perMonth: Number.parseInt(text.replace(/\D/g, ""), 10) || 0 })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Ad budget"
                prefix="$"
                value={money(plan.adCents)}
                onCommit={(text) => set({ adCents: dollarsToCents(text) })}
              />
              <Field
                label="Monthly target"
                prefix="$"
                value={money(plan.targetCents)}
                onCommit={(text) => set({ targetCents: dollarsToCents(text) })}
              />
            </div>
          </fieldset>
        </form>

        <div className="min-w-0 lg:sticky lg:top-6">
          <section
            aria-labelledby="dm-receipt-title"
            className="paper dm-receipt dm-feed px-5 pt-5 pb-6"
          >
            <p className="eyebrow text-subtle">Street Royalty · the studio</p>
            <h2 id="dm-receipt-title" className="display mt-1 text-4xl">
              One piece sold
            </h2>
            <div className="mt-4 grid gap-2">
              <Row label="You charge" cents={plan.priceCents} sign="" />
              <Row label="Shipping you charge" cents={plan.shipChargedCents} sign="+" />
              <Row label="Making it" cents={plan.makeCents} sign="-" />
              <Row label="Shipping you pay" cents={plan.shipPaidCents} sign="-" />
              <Row
                label={`Card fee, ${bpsToPercent(plan.feeBps)}% + ${formatMoney(plan.feeFixedCents)}`}
                cents={result.cardFeeCents}
                sign="-"
              />
              <Row
                label={`House cut, ${bpsToPercent(plan.houseBps)}% (not decided)`}
                cents={result.houseCutCents}
                sign="-"
              />
            </div>
            <div className="mt-4 border-t-2 border-ink pt-3">
              <p className="eyebrow text-subtle">You keep, per piece</p>
              <p
                className="display mt-1 text-6xl tabular-nums"
                data-testid="keep"
                aria-live="polite"
              >
                <span key={result.keepCents} className="dm-stamp">
                  {losing ? "- " : ""}
                  {formatMoney(Math.abs(result.keepCents))}
                </span>
              </p>
              {losing ? (
                <p className="mt-2 border-2 border-ink bg-surface px-3 py-2 text-sm">
                  At this price you lose {formatMoney(Math.abs(result.keepCents))} on every piece.
                </p>
              ) : null}
              {result.breakEvenPriceCents != null ? (
                <p className="mt-2 text-sm text-muted">
                  Charge less than {formatMoney(result.breakEvenPriceCents)} and you lose money on
                  each one.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  With these cuts no price covers the cost. Lower the fee or the house cut.
                </p>
              )}
            </div>
            <div className="mt-4">
              <SeamBar
                parts={[
                  { key: "making", label: "Making it", cents: result.parts.making, tone: "ink" },
                  { key: "ship", label: "Shipping", cents: result.parts.shipping, tone: "dots" },
                  { key: "fee", label: "The card fee", cents: result.parts.cardFee, tone: "hatch" },
                  { key: "house", label: "The house", cents: result.parts.house, tone: "cross" },
                  { key: "keep", label: "You keep", cents: result.parts.keep, tone: "soft" },
                ]}
              />
            </div>
          </section>

          <dl className="mt-8 grid gap-3">
            <div className="border-2 border-ink bg-surface p-4">
              <dt className="eyebrow text-subtle">A month, at {pieces(plan.perMonth)}</dt>
              <dd className="mt-1 font-display text-3xl tabular-nums" data-testid="month">
                {result.keepPerMonthCents < 0 ? "- " : ""}
                {formatMoney(Math.abs(result.keepPerMonthCents))}
              </dd>
            </div>
            <div className="border-2 border-ink bg-surface p-4">
              <dt className="eyebrow text-subtle">
                To pay back {formatMoney(plan.adCents)} of ads
              </dt>
              <dd className="mt-1" data-testid="ads">
                {result.piecesForAds == null ? (
                  <span className="text-muted">
                    {flat ? "A piece keeps nothing" : "Every piece loses money"} at this price, so
                    ads can not pay themselves back.
                  </span>
                ) : (
                  <>
                    <span className="font-display text-3xl tabular-nums">
                      {pieces(result.piecesForAds)}
                    </span>
                    <span className="block text-sm text-muted">
                      Sold because of the ads, before the ads have made you anything.
                    </span>
                  </>
                )}
              </dd>
            </div>
            <div className="border-2 border-ink bg-surface p-4">
              <dt className="eyebrow text-subtle">
                To keep {formatMoney(plan.targetCents)} a month
              </dt>
              <dd className="mt-1" data-testid="target">
                {result.piecesForTarget == null ? (
                  <span className="text-muted">
                    Not reachable at this price. Raise the price or lower a cost.
                  </span>
                ) : (
                  <>
                    <span className="font-display text-3xl tabular-nums">
                      {pieces(result.piecesForTarget)} a month
                    </span>
                    {perWeek != null && result.piecesForTarget > 0 ? (
                      <span className="block text-sm text-muted">About {perWeek} a week.</span>
                    ) : null}
                  </>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              Copy a link to this plan
            </Button>
            <span role="status" className="text-sm text-muted">
              {copied ? "Copied. Your numbers are in the link." : ""}
            </span>
          </div>
          <ul className="mt-5 grid gap-1 text-sm text-muted">
            <li>Maker payouts are not switched on yet. This is for planning.</li>
            <li>Tax is not in here. Returns and reprints are not either.</li>
            <li>
              Not sure what a blank or a print area is?{" "}
              <Link
                to="/made"
                className="inline-flex min-h-11 items-center underline decoration-2 underline-offset-4"
              >
                How it's made
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </StudioShell>
  );
}
