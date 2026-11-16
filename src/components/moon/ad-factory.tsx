import { useMemo, useState } from "react";
import { directedKitFor } from "@/lib/moon/adkit";

/**
 * The Ad Factory, director mode: one design mints its own campaign AND
 * directs its own spot — hooks built to an exact character spec, a
 * 15-second UGC shot list, a creator caption in first person, a carousel
 * arc, plus the static/offer/PSA cards. The kit grades itself before it
 * displays: banned-voice scan, hook diversity, read-aloud check. The
 * designer is the ad, and the byline says so.
 */
export function AdFactory({
  title,
  productName,
  retailCents,
  designer,
  forkedFromTitle,
}: {
  title: string;
  productName: string;
  retailCents: number;
  designer?: string;
  forkedFromTitle?: string | null;
}) {
  const kit = useMemo(
    () => directedKitFor({ title, productName, retailCents, designer, forkedFromTitle }),
    [title, productName, retailCents, designer, forkedFromTitle],
  );
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? kit.cards : kit.cards.slice(0, 6);
  return (
    <section aria-label="Ad factory" className="border-2 border-ink bg-surface p-4 md:col-span-2">
      <h2 className="font-display text-2xl uppercase">Ad Factory</h2>
      <p className="mt-1 text-sm text-muted">{kit.byline}</p>
      {kit.creditLine ? <p className="mt-1 text-sm text-cyan">{kit.creditLine}</p> : null}
      <p className="mt-1 text-sm text-muted">
        This piece just directed its own spot and minted {kit.cards.length} cards — hooks, a
        15-second shot list, a creator caption, a carousel. Volume testing without the volume
        department.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="border-2 border-ink bg-bg p-3">
          <p className="font-display text-sm tracking-widest uppercase">The directed spot — {kit.totalSeconds}s, UGC</p>
          <p className="mt-2 font-display text-xs tracking-widest uppercase text-muted">Hooks, built to spec</p>
          <ul className="mt-1 flex flex-col gap-1">
            {kit.hooks.map((hook, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 text-sm">
                <span>“{hook}”</span>
                <span className="shrink-0 text-xs text-muted">{kit.spec.counts.hooks[index]}/{kit.spec.hookMaxChars}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-display text-xs tracking-widest uppercase text-muted">Shot list</p>
          <ol className="mt-1 flex flex-col gap-2">
            {kit.shots.map((shot) => (
              <li key={shot.n} className="text-sm">
                <span className="font-display uppercase">Shot {shot.n} · {shot.seconds}s</span>
                <span className="block text-muted">{shot.framing}</span>
                <span className="block">“{shot.line}” <span className="text-xs text-muted">({shot.line.length}/{kit.spec.shotLineMaxChars})</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-display text-xs tracking-widest uppercase text-muted">Creator caption</p>
          <blockquote className="mt-1 border-l-2 border-pipe pl-2 text-sm">
            {kit.caption} <span className="text-xs text-muted">({kit.spec.counts.caption}/{kit.spec.captionMaxChars})</span>
          </blockquote>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border-2 border-ink bg-bg p-3">
            <p className="font-display text-sm tracking-widest uppercase">Carousel arc — 5 cards</p>
            <ol className="mt-2 flex flex-col gap-1">
              {kit.carousel.map((card) => (
                <li key={card.n} className="text-sm">
                  <span className="font-display uppercase">{card.n}. {card.role}</span> — {card.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="border-2 border-lime bg-bg p-3">
            <p className="font-display text-sm tracking-widest uppercase">Self-QA gate</p>
            <ul className="mt-2 flex flex-col gap-1">
              {kit.qa.map((check) => (
                <li key={check.id} className="flex items-baseline gap-2 text-sm">
                  <span aria-hidden="true">{check.ok ? "✓" : "✗"}</span>
                  <span>
                    <span className="font-display uppercase">{check.id}</span> — {check.detail}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Copy that fails a check is repaired or dropped by the kit itself. Nothing broken
              reaches this page.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((card, index) => (
          <article key={index} className="border-2 border-ink p-3" style={{ background: card.garmentHex }}>
            <p className="font-display text-[0.65rem] tracking-widest uppercase" style={{ color: card.inkHex }}>
              {card.kind} · {card.theme}
            </p>
            <p className="mt-2 font-display text-lg leading-tight uppercase" style={{ color: card.inkHex }}>
              {card.headline}
            </p>
            <p className="mt-1 text-sm" style={{ color: card.inkHex }}>
              {card.sub}
            </p>
            <p className="mt-3 inline-block border-2 px-2 py-1 font-display text-xs uppercase" style={{ borderColor: card.inkHex, color: card.inkHex }}>
              {card.cta}
            </p>
          </article>
        ))}
      </div>
      <button type="button" className="chip mt-3" onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show fewer" : `Show all ${kit.cards.length} ads`}
      </button>
    </section>
  );
}
