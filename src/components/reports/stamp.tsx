import type { ReactNode } from "react";

/**
 * A rubber stamp that slams down, and the handful of styles the report dialog and
 * the queue share. Everything is prefixed sr-rep- and stands still under reduced motion.
 */
export function Stamp({ children, tone = "pink" }: { children: ReactNode; tone?: "pink" | "ink" }) {
  return (
    <span
      className={`sr-rep-stamp ${tone === "pink" ? "sr-rep-stamp-pink" : "sr-rep-stamp-ink"}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

const CSS = `
.sr-rep-stamp {
  display: inline-block;
  padding: 0.35rem 0.9rem 0.3rem;
  border: 4px solid currentColor;
  outline: 2px solid currentColor;
  outline-offset: 3px;
  font-family: var(--font-cond);
  font-stretch: 62%;
  font-weight: 900;
  font-style: italic;
  font-size: clamp(2rem, 9vw, 3rem);
  line-height: 0.9;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  transform: rotate(-9deg);
  /* Worn ink: the stamp never lands evenly. */
  -webkit-mask-image:
    radial-gradient(circle at 18% 30%, transparent 0 5%, #000 6%),
    radial-gradient(circle at 72% 78%, transparent 0 7%, #000 8%),
    repeating-linear-gradient(97deg, #000 0 7px, rgb(0 0 0 / 72%) 7px 9px);
  mask-image:
    radial-gradient(circle at 18% 30%, transparent 0 5%, #000 6%),
    radial-gradient(circle at 72% 78%, transparent 0 7%, #000 8%),
    repeating-linear-gradient(97deg, #000 0 7px, rgb(0 0 0 / 72%) 7px 9px);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  animation: sr-rep-slam 520ms cubic-bezier(0.2, 1.4, 0.3, 1) both;
}
.sr-rep-stamp-pink { color: var(--color-pipe); }
.sr-rep-stamp-ink { color: var(--color-fg); }

@keyframes sr-rep-slam {
  0% { transform: rotate(-22deg) scale(3.2); opacity: 0; }
  55% { transform: rotate(-7deg) scale(0.94); opacity: 1; }
  75% { transform: rotate(-10deg) scale(1.04); }
  100% { transform: rotate(-9deg) scale(1); opacity: 1; }
}

.sr-rep-scrim { animation: sr-rep-fade 200ms ease-out both; }
.sr-rep-sheet { animation: sr-rep-rise 380ms var(--ease-out-expo) both; }

@keyframes sr-rep-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sr-rep-rise {
  from { transform: translateY(2.5rem); opacity: 0; }
  to { transform: none; opacity: 1; }
}

/* The chosen reason gets a strip of pink piping down its edge. */
.sr-rep-reason { transition: border-color 140ms ease, box-shadow 140ms ease; }
.sr-rep-reason:hover { border-color: var(--color-subtle); }
.sr-rep-reason:has(:checked) {
  border-color: var(--color-ink);
  box-shadow: inset 6px 0 0 var(--color-pipe);
}
.sr-rep-reason:has(:focus-visible) {
  outline: 2px solid var(--color-fg);
  outline-offset: 2px;
}
.sr-rep-radio {
  appearance: none;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  border: 2px solid var(--color-ink);
  border-radius: 9999px;
  background: var(--color-surface);
  outline: none;
}
.sr-rep-radio:checked {
  background: radial-gradient(circle, var(--color-ink) 0 42%, var(--color-surface) 46%);
}

/* A slip of paper in a pile. Each one sits a little crooked. */
.sr-rep-slip { transform: rotate(var(--sr-rep-tilt, 0deg)); }

/* A settled docket folds shut after the stamp lands. */
.sr-rep-docket { transition: opacity 320ms ease 900ms, transform 420ms var(--ease-out-expo) 900ms; }
.sr-rep-docket[data-settled="true"] { opacity: 0; transform: translateX(2rem) rotate(1.2deg); }
.sr-rep-docket-in { animation: sr-rep-rise 520ms var(--ease-out-expo) both; animation-delay: var(--sr-rep-delay, 0ms); }

@media (prefers-reduced-motion: reduce) {
  .sr-rep-stamp, .sr-rep-scrim, .sr-rep-sheet, .sr-rep-docket-in { animation: none; }
  .sr-rep-reason, .sr-rep-docket { transition: none; }
  .sr-rep-docket[data-settled="true"] { transform: none; }
}
`;

export function ReportStyles() {
  return <style>{CSS}</style>;
}
