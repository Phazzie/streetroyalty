import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Crown } from "@/components/site/shell";
import { familySummary, generationLabel, remixLineNote } from "@/components/remix/words";
import { pieceFamily } from "@/lib/social/remix-api";

type Family = Awaited<ReturnType<typeof pieceFamily>>;
type Stop = Family["chain"][number];

/**
 * The family tree is drawn like a transit map. The pink line is the bloodline: it starts
 * at the original and stops at every generation. The crown marks the piece on this page.
 * From there a second line carries on to the remixes made from it.
 */
const CSS = `
.sr-ft { --rail: 3rem; --stop: 2.5rem; --pipe: 6px; --branch: 1.25rem; --step: 220ms; }
.sr-ft-list { list-style: none; margin: 0; padding: 0; position: relative; }
.sr-ft-stop { position: relative; padding: 0 0 1rem var(--rail); min-height: 6rem; }
.sr-ft-seg {
  position: absolute; left: calc(var(--rail) / 2 - var(--pipe) / 2); top: var(--stop);
  width: var(--pipe); height: 100%; background: var(--color-pipe); transform-origin: top center;
}
.sr-ft-seg[data-line="remix"] { background: var(--color-blue); }
.sr-ft-seg[data-line="lost"] {
  background: repeating-linear-gradient(to bottom, var(--color-pipe) 0 7px, transparent 7px 13px);
}
.sr-ft-dot {
  position: absolute; left: calc(var(--rail) / 2); top: var(--stop);
  width: 1.375rem; height: 1.375rem; margin: -0.6875rem 0 0 -0.6875rem; border-radius: 9999px;
  background: var(--color-surface); border: 4px solid var(--color-fg);
  transition: scale 200ms ease; z-index: 2;
}
.sr-ft-stop:hover > .sr-ft-dot, .sr-ft-branch:hover > .sr-ft-dot { scale: 1.18; }
.sr-ft-dot[data-kind="ghost"] { background: transparent; border: 3px dashed var(--color-subtle); }
.sr-ft-dot[data-kind="here"] {
  width: 2.5rem; height: 2.5rem; margin: -1.25rem 0 0 -1.25rem; border: 0;
  background: var(--color-fg); color: var(--color-bg);
  display: grid; place-items: center;
}
.sr-ft-dot[data-kind="here"]::after {
  content: ""; position: absolute; inset: 0; border-radius: 9999px; border: 2px solid var(--color-fg);
  animation: sr-ft-ring 2.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}
.sr-ft-train {
  position: absolute; left: calc(var(--rail) / 2 - 3px); top: calc(var(--stop) - 9px);
  width: 6px; height: 18px; border-radius: 3px; background: var(--color-fg);
  opacity: 0; pointer-events: none; z-index: 1;
}
.sr-ft[data-go="true"] .sr-ft-train {
  animation: sr-ft-ride var(--ride, 4s) cubic-bezier(0.6, 0, 0.3, 1) var(--wait, 1.4s) infinite;
}
.sr-ft-thumb {
  flex: none; width: 4rem; aspect-ratio: 4 / 5; border: 2px solid var(--color-ink);
  background: var(--color-bg); display: block; overflow: hidden;
}
.sr-ft-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sr-ft-thumb[data-ghost="true"] {
  border-style: dashed; border-color: var(--color-subtle);
  background: repeating-linear-gradient(135deg, transparent 0 7px, var(--color-line) 7px 9px);
}
.sr-ft-kicker {
  display: block; font-family: var(--font-display); font-size: 0.68rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--color-muted);
}
.sr-ft-title {
  display: block; font-family: var(--font-display); text-transform: uppercase; line-height: 1.15;
  overflow-wrap: anywhere;
}
.sr-ft-link { display: flex; min-height: 2.75rem; flex-direction: column; justify-content: center; }
.sr-ft-link:hover .sr-ft-title, .sr-ft-maker:hover { text-decoration: underline; text-underline-offset: 3px; }
.sr-ft-maker {
  display: inline-flex; min-height: 2.75rem; align-items: center; font-family: var(--font-display);
  font-size: 0.85rem; color: var(--color-fg);
}
.sr-ft-fork { position: relative; }
.sr-ft-name {
  position: relative; padding: 0.25rem 0 0.9rem var(--rail); min-height: calc(var(--stop) + 0.5rem);
}
.sr-ft-name::before, .sr-ft-branch::before {
  content: ""; position: absolute; left: calc(var(--rail) / 2 - var(--pipe) / 2); top: 0; bottom: 0;
  width: var(--pipe); background: var(--color-blue);
}
.sr-ft-pill {
  display: inline-block; border: 2px solid var(--color-ink); background: var(--color-blue); color: #14081c;
  font-family: var(--font-display); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 0.15rem 0.5rem;
}
.sr-ft-branch {
  position: relative; padding: 0 0 0.75rem calc(var(--rail) + var(--branch) + 1.25rem); min-height: 5rem;
  --bstop: 2rem;
}
.sr-ft-branch:last-child::before { display: none; }
.sr-ft-elbow {
  position: absolute; left: calc(var(--rail) / 2 - var(--pipe) / 2); top: 0;
  width: calc(var(--rail) / 2 + var(--branch) + var(--pipe) / 2); height: calc(var(--bstop) + var(--pipe) / 2);
  border-left: var(--pipe) solid var(--color-blue); border-bottom: var(--pipe) solid var(--color-blue);
  border-bottom-left-radius: 1.25rem;
}
.sr-ft-branch > .sr-ft-dot { left: calc(var(--rail) + var(--branch)); top: var(--bstop); }
.sr-ft-branch .sr-ft-thumb { width: 3rem; }
.sr-ft-end { position: relative; padding: 0 0 0 var(--rail); min-height: calc(var(--stop) + 1.5rem); }
.sr-ft-end::before {
  content: ""; position: absolute; left: calc(var(--rail) / 2 - 0.875rem); top: calc(var(--stop) - var(--pipe) / 2);
  width: 1.75rem; height: var(--pipe); background: var(--color-blue);
}
.sr-ft-end p { padding-top: calc(var(--stop) - 0.7rem); }

.sr-ft[data-go="false"] :is(.sr-ft-seg, .sr-ft-dot, .sr-ft-card, .sr-ft-elbow, .sr-ft-name, .sr-ft-end) { opacity: 0; }
.sr-ft[data-go="false"] :is(.sr-ft-name, .sr-ft-branch)::before { opacity: 0; }
.sr-ft[data-go="true"] .sr-ft-branch::before { animation: sr-ft-fade 600ms ease-out both; animation-delay: calc(var(--n, 1) * var(--step)); }
.sr-ft[data-go="true"] .sr-ft-seg {
  animation: sr-ft-draw 520ms var(--ease-out-expo) both; animation-delay: calc(var(--i) * var(--step) + 140ms);
}
.sr-ft[data-go="true"] .sr-ft-dot {
  animation: sr-ft-pop 420ms var(--ease-out-expo) both; animation-delay: calc(var(--i) * var(--step));
}
.sr-ft[data-go="true"] :is(.sr-ft-card, .sr-ft-name, .sr-ft-end) {
  animation: sr-ft-in 520ms var(--ease-out-expo) both; animation-delay: calc(var(--i) * var(--step) + 80ms);
}
.sr-ft[data-go="true"] .sr-ft-elbow {
  animation: sr-ft-bend 520ms var(--ease-out-expo) both; animation-delay: calc(var(--i) * var(--step) - 120ms);
}
@keyframes sr-ft-fade { from { opacity: 0; } }
@keyframes sr-ft-draw { from { transform: scaleY(0); } }
@keyframes sr-ft-pop { from { scale: 0; } 70% { scale: 1.25; } }
@keyframes sr-ft-in { from { opacity: 0; transform: translateX(-0.6rem); } }
@keyframes sr-ft-bend { from { clip-path: inset(0 100% 100% 0); } to { clip-path: inset(0); } }
@keyframes sr-ft-ring { from { transform: scale(1); opacity: 0.55; } to { transform: scale(1.75); opacity: 0; } }
@keyframes sr-ft-ride {
  0% { transform: translateY(0); opacity: 0; }
  8% { opacity: 1; }
  52% { transform: translateY(var(--run, 0px)); opacity: 1; }
  60%, 100% { transform: translateY(var(--run, 0px)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sr-ft :is(.sr-ft-seg, .sr-ft-dot, .sr-ft-card, .sr-ft-elbow, .sr-ft-name, .sr-ft-end) {
    animation: none !important; opacity: 1 !important; transition: none;
  }
  .sr-ft-dot[data-kind="here"]::after, .sr-ft .sr-ft-train { animation: none !important; opacity: 0 !important; }
  .sr-ft .sr-ft-branch::before { animation: none !important; opacity: 1 !important; }
  .sr-ft-stop:hover > .sr-ft-dot, .sr-ft-branch:hover > .sr-ft-dot { scale: 1; }
}
`;

function step(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

function Thumb({ stop }: { stop: Stop }) {
  if (!stop.onRack || !stop.mockupUrl) {
    return <span className="sr-ft-thumb" data-ghost={!stop.onRack} aria-hidden="true" />;
  }
  return (
    <span className="sr-ft-thumb" aria-hidden="true">
      <img src={stop.mockupUrl} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

function Maker({ stop }: { stop: Stop }) {
  if (!stop.maker) return null;
  if (!stop.maker.handle) {
    return <span className="sr-ft-maker text-muted">by {stop.maker.name}</span>;
  }
  return (
    <Link
      to="/m/$handle"
      params={{ handle: stop.maker.handle }}
      className="sr-ft-maker"
      aria-label={`Maker ${stop.maker.name}, @${stop.maker.handle}`}
    >
      <span className="mr-1 font-sans text-muted">by</span>@{stop.maker.handle}
    </Link>
  );
}

/** The picture, the name of the stop and the piece, and who made it. */
function Card({
  stop,
  kicker,
  here,
  small,
  index,
  extra,
}: {
  stop: Stop;
  kicker: string;
  here?: boolean;
  small?: boolean;
  index: number;
  extra?: ReactNode;
}) {
  const title = stop.title ?? "A piece that was deleted";
  const words = (
    <>
      <span className="sr-ft-kicker">{kicker}</span>
      <span className={`sr-ft-title ${small ? "text-sm" : ""} ${stop.onRack ? "" : "text-muted"}`}>
        {title}
      </span>
    </>
  );
  return (
    <div className="sr-ft-card flex min-w-0 items-start gap-3" style={step(index)}>
      <Thumb stop={stop} />
      <div className="min-w-0 flex-1">
        {stop.onRack && stop.slug && !here ? (
          <Link to="/rack/$slug" params={{ slug: stop.slug }} className="sr-ft-link">
            {words}
          </Link>
        ) : (
          <div className="sr-ft-link">{words}</div>
        )}
        {stop.onRack ? null : <p className="text-sm text-muted">No longer on the rack.</p>}
        <Maker stop={stop} />
        {extra}
      </div>
    </div>
  );
}

export function FamilyTree({ slug }: { slug: string }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [failed, setFailed] = useState(false);
  const [go, setGo] = useState(false);
  const root = useRef<HTMLElement | null>(null);
  const line = useRef<HTMLOListElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    let live = true;
    setFamily(null);
    setFailed(false);
    setGo(false);
    void pieceFamily({ data: { slug } })
      .then((next) => {
        if (live) setFamily(next);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  // Draw the line when it scrolls into view, not before anyone can see it.
  useEffect(() => {
    const element = root.current;
    if (!family || !element) return;
    if (typeof IntersectionObserver === "undefined") {
      setGo(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setGo(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [family]);

  // The train runs from the original to this piece, so it needs the distance between them.
  useEffect(() => {
    const list = line.current;
    if (!family || !list) return;
    const measure = () => {
      const last = list.querySelector<HTMLElement>(":scope > li:last-of-type");
      list.style.setProperty("--run", `${last?.offsetTop ?? 0}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [family]);

  if (failed) return null;
  if (!family) {
    return <p className="pending-pulse text-sm text-muted">Tracing the family tree.</p>;
  }

  const { chain, remixes, broken } = family;
  const generation = chain.length;
  const summary = familySummary({ generation, broken, descendants: family.descendants });

  if (generation <= 1 && remixes.length === 0 && family.descendants === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Crown className="h-3 w-auto flex-none text-fg" />
        <span>{summary}</span>
      </p>
    );
  }

  const lastIndex = generation - 1;
  const forkStart = generation + 1;

  return (
    <section
      ref={root}
      className="sr-ft border-2 border-ink bg-surface p-4 sm:p-5"
      data-go={go}
      aria-labelledby={headingId}
    >
      <style>{CSS}</style>
      <h2 id={headingId} className="font-display text-sm tracking-wide uppercase">
        Family tree
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">{summary}</p>

      <ol ref={line} className="sr-ft-list">
        {chain.map((stop, index) => {
          const here = index === lastIndex;
          const lost = stop.title === null;
          const kicker = here
            ? index === 0
              ? "The original. You are here"
              : broken
                ? "You are here"
                : `${generationLabel(index)}. You are here`
            : lost
              ? broken
                ? "Missing link"
                : generationLabel(index)
              : broken && index > 0
                ? "Later generation"
                : generationLabel(index);
          const next = chain[index + 1];
          const lineKind = here
            ? "remix"
            : broken && (lost || next?.title === null)
              ? "lost"
              : "blood";
          return (
            <li key={index} className="sr-ft-stop" aria-current={here ? "true" : undefined}>
              <span
                className="sr-ft-seg"
                data-line={lineKind}
                style={step(index)}
                aria-hidden="true"
              />
              {index === 0 && generation > 1 ? (
                <span
                  className="sr-ft-train"
                  style={{ "--ride": `${3 + generation * 0.6}s` } as CSSProperties}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="sr-ft-dot"
                data-kind={here ? "here" : stop.onRack ? "stop" : "ghost"}
                style={step(index)}
                aria-hidden="true"
              >
                {here ? <Crown className="h-3.5 w-auto" /> : null}
              </span>
              <Card stop={stop} kicker={kicker} here={here} index={index} />
            </li>
          );
        })}
      </ol>

      {remixes.length > 0 ? (
        <div className="sr-ft-fork">
          <div className="sr-ft-name" style={step(generation)}>
            <span className="sr-ft-pill">Remix line</span>
            <p className="mt-1 text-sm text-muted">
              {remixLineNote({
                shown: remixes.length,
                remixCount: family.remixCount,
                descendants: family.descendants,
              })}
            </p>
          </div>
          <ul className="sr-ft-list" style={{ "--n": forkStart } as CSSProperties}>
            {remixes.map((remix, index) => (
              <li key={remix.slug ?? index} className="sr-ft-branch">
                <span className="sr-ft-elbow" style={step(forkStart + index)} aria-hidden="true" />
                <span className="sr-ft-dot" style={step(forkStart + index)} aria-hidden="true" />
                <Card
                  stop={remix}
                  kicker="Remix"
                  small
                  index={forkStart + index}
                  extra={
                    remix.below > 0 ? (
                      <p className="text-sm text-muted">
                        {remix.below === 1 ? "1 more piece" : `${remix.below} more pieces`} down
                        this branch.
                      </p>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="sr-ft-end" style={step(generation)}>
          <p className="text-sm text-muted">
            {family.descendants > 0
              ? "The remixes of this one left the rack. The line carries on below them."
              : "End of the line for now. Nobody has remixed this one yet."}
          </p>
        </div>
      )}
    </section>
  );
}
