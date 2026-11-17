import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { myShelf, type ShelfPiece } from "@/lib/social/activity-api";

/**
 * The pieces you crowned, hung on a rail that slides sideways.
 * Slide it and they swing, the way clothes do when you push along a rack.
 * It fetches for itself and draws nothing for someone who is signed out.
 */

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; pieces: ShelfPiece[] };

const STYLES = `
.sr-shelf-scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: var(--color-line) transparent;
}
.sr-shelf-scroll:focus-visible { outline: 2px solid var(--color-fg); outline-offset: 2px; }
.sr-shelf-rail {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
  gap: 1rem;
  padding: 0 1rem 1.25rem;
}
/* The bar everything hangs from. It runs the whole length, past the edge of the screen. */
.sr-shelf-rail::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0.5rem;
  height: 6px;
  background: var(--color-ink);
  box-shadow: 0 3px 0 var(--color-pipe);
}
.sr-shelf-item {
  position: relative;
  width: 9.75rem;
  flex: none;
  scroll-snap-align: start;
  scroll-margin-left: 1rem;
  padding-top: 0.25rem;
  transform-origin: 50% 0.6rem;
  transform: rotate(calc(var(--sr-shelf-sway, 0deg) * var(--sr-shelf-weight, 1)));
  /* Backwards only: once it has settled, the sway above takes over. */
  animation: sr-shelf-hang 1400ms cubic-bezier(0.3, 0.7, 0.3, 1) backwards;
  animation-delay: calc(var(--sr-shelf-i, 0) * 70ms);
  will-change: transform;
}
@media (min-width: 640px) { .sr-shelf-item { width: 11.5rem; } }
@keyframes sr-shelf-hang {
  0% { opacity: 0; transform: translateY(-0.5rem) rotate(calc(var(--sr-shelf-weight, 1) * 7deg)); }
  25% { opacity: 1; transform: rotate(calc(var(--sr-shelf-weight, 1) * -4deg)); }
  50% { transform: rotate(calc(var(--sr-shelf-weight, 1) * 2.4deg)); }
  75% { transform: rotate(calc(var(--sr-shelf-weight, 1) * -1deg)); }
  100% { opacity: 1; transform: rotate(0deg); }
}
.sr-shelf-nav:disabled { border-color: var(--color-line); background: var(--color-line); color: var(--color-muted); transform: none; }
.sr-shelf-hook { display: block; margin: 0 auto -2px; height: 2.6rem; width: 5.5rem; color: var(--color-fg); }
.sr-shelf-card { border: 2px solid var(--color-ink); background: var(--color-surface); }
.sr-shelf-piece { display: block; color: var(--color-fg); }
.sr-shelf-piece:focus-visible, .sr-shelf-by:focus-visible { outline: 2px solid var(--color-fg); outline-offset: -4px; }
.sr-shelf-piece img { transition: transform 600ms var(--ease-out-expo); }
.sr-shelf-piece:hover img { transform: scale(1.04); }
.sr-shelf-by {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  border-top: 2px solid var(--color-ink);
  padding: 0 0.6rem;
  font-size: 0.875rem;
  color: var(--color-muted);
}
a.sr-shelf-by span {
  color: var(--color-fg);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
a.sr-shelf-by:hover span { text-decoration-thickness: 4px; }
@media (prefers-reduced-motion: reduce) {
  .sr-shelf-item { animation: none; transform: none; }
  .sr-shelf-piece img { transition: none; }
  .sr-shelf-piece:hover img { transform: none; }
}
`;

/** A wire hanger: a hook over the rail and two arms down to the card. */
function Hanger() {
  return (
    <svg viewBox="0 0 88 42" className="sr-shelf-hook" aria-hidden="true" fill="none">
      <path
        d="M44 22v-5c0-3 5-3.5 5-8a5 5 0 0 0-10 0"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M44 22 6 41h76Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function Hung({ piece, index }: { piece: ShelfPiece; index: number }) {
  // Not every piece weighs the same, so they do not all swing the same.
  const weight = [1, 0.7, 1.25, 0.85, 1.1][index % 5] ?? 1;
  return (
    <li
      className="sr-shelf-item"
      style={{ "--sr-shelf-i": Math.min(index, 10), "--sr-shelf-weight": weight } as CSSProperties}
    >
      <Hanger />
      <div className="sr-shelf-card">
        <Link to="/rack/$slug" params={{ slug: piece.slug }} className="sr-shelf-piece">
          <span className="block overflow-hidden bg-bg">
            {piece.mockupUrl ? (
              <img
                src={piece.mockupUrl}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <span className="block aspect-[4/5] w-full" />
            )}
          </span>
          <span className="clamp-2 block min-h-[3.1rem] px-2.5 pt-2 pb-1.5 font-display text-sm leading-tight uppercase">
            {piece.title}
          </span>
        </Link>
        {piece.maker.handle ? (
          <Link to="/m/$handle" params={{ handle: piece.maker.handle }} className="sr-shelf-by">
            by&nbsp;<span className="truncate">{piece.maker.name}</span>
          </Link>
        ) : (
          <p className="sr-shelf-by">
            by&nbsp;<span className="truncate">{piece.maker.name}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export function CrownedShelf() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [edges, setEdges] = useState({ back: false, more: false });
  const scroller = useRef<HTMLDivElement | null>(null);

  const fetchShelf = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      setLoad({ state: "ready", pieces: await myShelf() });
    } catch {
      setLoad({ state: "error" });
    }
  }, []);

  useEffect(() => {
    if (userId) void fetchShelf();
  }, [userId, fetchShelf]);

  const count = load.state === "ready" ? load.pieces.length : 0;

  // Sliding the rail gives every hanger a push. A spring brings them back to rest.
  useEffect(() => {
    const node = scroller.current;
    if (!node || count === 0) return;

    const measure = () => {
      const room = node.scrollWidth - node.clientWidth;
      setEdges({ back: node.scrollLeft > 4, more: node.scrollLeft < room - 4 });
    };
    measure();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let angle = 0;
    let speed = 0;
    let last = node.scrollLeft;
    let frame = 0;

    const step = () => {
      speed += -angle * 0.09;
      speed *= 0.88;
      // A hard shove still only swings so far.
      angle = Math.max(-7, Math.min(7, angle + speed));
      if (Math.abs(angle) < 0.02 && Math.abs(speed) < 0.02) {
        angle = 0;
        speed = 0;
        frame = 0;
        node.style.setProperty("--sr-shelf-sway", "0deg");
        return;
      }
      node.style.setProperty("--sr-shelf-sway", `${angle.toFixed(2)}deg`);
      frame = requestAnimationFrame(step);
    };

    const onScroll = () => {
      const moved = node.scrollLeft - last;
      last = node.scrollLeft;
      measure();
      if (still) return;
      // The rail moves one way, so the clothes lag the other way.
      speed = Math.max(-2.4, Math.min(2.4, speed + moved * 0.035));
      if (!frame) frame = requestAnimationFrame(step);
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count]);

  if (isPending || !userId) return null;

  const slide = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({
      left: direction * Math.max(180, node.clientWidth * 0.8),
      behavior: still ? "auto" : "smooth",
    });
  };

  return (
    <section aria-labelledby="sr-shelf-title" className="min-w-0">
      <style>{STYLES}</style>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tag">Your crowns</p>
          <h2 id="sr-shelf-title" className="mt-3 font-display text-2xl leading-none">
            Crowned by you
          </h2>
        </div>
        {edges.back || edges.more ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="chip sr-shelf-nav w-11 px-0"
              aria-label="Slide the rail back"
              disabled={!edges.back}
              onClick={() => slide(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="chip sr-shelf-nav w-11 px-0"
              aria-label="Slide the rail along"
              disabled={!edges.more}
              onClick={() => slide(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </div>

      {load.state === "loading" ? (
        <div className="pending-pulse mt-5 flex gap-4 overflow-hidden" aria-label="Loading">
          {[0, 1, 2].map((slot) => (
            <span
              key={slot}
              className="block aspect-[4/5] w-[9.75rem] shrink-0 border-2 border-line bg-surface"
            />
          ))}
        </div>
      ) : null}

      {load.state === "error" ? (
        <div className="mt-5 border-2 border-pipe bg-surface p-4" role="status">
          <p>Your crowns did not load.</p>
          <button type="button" className="chip chip-on mt-3" onClick={() => void fetchShelf()}>
            Try again
          </button>
        </div>
      ) : null}

      {load.state === "ready" && load.pieces.length === 0 ? (
        <div className="empty-state mt-5">
          <p>No crowns given yet. Crown a piece on the rack and it hangs here.</p>
          <Link to="/rack" className="chip chip-on mt-3">
            Go to the rack
          </Link>
        </div>
      ) : null}

      {load.state === "ready" && load.pieces.length > 0 ? (
        <div
          ref={scroller}
          className="sr-shelf-scroll -mx-4 mt-4"
          role="region"
          aria-label={`Pieces you crowned, ${load.pieces.length}. Slides sideways.`}
          tabIndex={0}
        >
          <ul className="sr-shelf-rail">
            {load.pieces.map((piece, index) => (
              <Hung key={piece.slug} piece={piece} index={index} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
