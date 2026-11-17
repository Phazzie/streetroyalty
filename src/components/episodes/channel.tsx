import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatTimecode, STATUS_LABEL } from "@/lib/episodes/helpers";
import type { EpisodeStatus } from "@/lib/episodes/types";

/**
 * The look of the label's late-night channel: slate, timecode, test card, lamp.
 * Every class is prefixed ep- and lives in this one style element.
 */
const CSS = `
.ep-tc {
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 1;
  letter-spacing: 0.06em;
}
.ep-slate {
  border: 2px solid var(--color-ink);
  background:
    repeating-linear-gradient(-55deg, var(--color-ink) 0 22px, transparent 22px 44px) top / 100% 14px no-repeat,
    var(--color-surface);
  padding-top: 14px;
}
.ep-slate-cell {
  border-top: 2px solid var(--color-ink);
  border-right: 2px solid var(--color-ink);
  padding: 0.6rem 0.8rem;
  min-width: 0;
}
.ep-slate-cell:last-child { border-right: 0; }
.ep-lamp {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border: 2px solid var(--color-line);
  background: var(--color-cream);
  color: var(--color-subtle);
  padding: 0.55rem 0.9rem;
  font-family: var(--font-display);
  font-size: 0.95rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  line-height: 1;
}
.ep-lamp-bulb {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
  border: 2px solid currentColor;
}
.ep-lamp[data-on="true"] {
  border-color: var(--color-ink);
  background: var(--color-pipe);
  color: #14081c;
}
.ep-lamp[data-on="true"] .ep-lamp-bulb { background: #14081c; }
.ep-lamp[data-on="true"]::after {
  content: "";
  position: absolute;
  inset: -2px;
  border: 2px solid var(--color-pipe);
  animation: ep-ring 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  pointer-events: none;
}
@keyframes ep-ring {
  from { transform: scale(1); opacity: 0.7; }
  to { transform: scale(1.18, 1.5); opacity: 0; }
}
.ep-card {
  position: relative;
  overflow: hidden;
  background: #0b0614;
  isolation: isolate;
}
.ep-bars {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: 1fr 14%;
}
.ep-bars > span { display: block; }
.ep-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: repeating-linear-gradient(0deg, rgb(11 6 20 / 0.28) 0 1px, transparent 1px 4px);
  pointer-events: none;
}
.ep-card::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -12%;
  height: 12%;
  z-index: 1;
  background: linear-gradient(180deg, transparent, rgb(246 241 255 / 0.22) 45%, rgb(11 6 20 / 0.3) 55%, transparent);
  animation: ep-track 7s linear infinite;
  pointer-events: none;
}
@keyframes ep-track {
  from { transform: translateY(0); }
  to { transform: translateY(950%); }
}
.ep-burn {
  background: rgb(11 6 20 / 0.86);
  color: #f6f1ff;
  padding: 0.3rem 0.55rem;
  line-height: 1.1;
}
.ep-plate {
  background: #0b0614;
  color: #f6f1ff;
  border: 2px solid #f6f1ff;
}
.ep-reel {
  position: relative;
  height: 4.25rem;
  border: 2px solid var(--color-ink);
  background: var(--color-cream);
  touch-action: none;
}
.ep-reel:focus-within { outline: 2px solid var(--color-fg); outline-offset: 3px; }
.ep-reel-scene {
  position: absolute;
  top: 0;
  bottom: 0;
  border-right: 2px solid var(--color-ink);
  display: flex;
  align-items: flex-end;
  padding: 0.25rem 0.4rem;
  overflow: hidden;
  transition: background-color 200ms ease;
}
.ep-reel-scene[data-now="true"] { background: var(--color-surface); }
.ep-reel-scene:nth-child(even) { background-image: linear-gradient(rgb(127 127 127 / 0.12), rgb(127 127 127 / 0.12)); }
.ep-reel-ticks {
  position: absolute;
  inset: 0 0 auto 0;
  height: 0.7rem;
  background: repeating-linear-gradient(90deg, var(--color-ink) 0 2px, transparent 2px var(--ep-tick, 5%));
  opacity: 0.55;
  pointer-events: none;
}
.ep-reel-head {
  position: absolute;
  top: -0.5rem;
  bottom: -0.5rem;
  width: 0;
  border-left: 3px solid var(--color-pipe);
  pointer-events: none;
  z-index: 2;
}
.ep-reel-head::before {
  content: "";
  position: absolute;
  top: -2px;
  left: -9px;
  border: 7.5px solid transparent;
  border-top: 10px solid var(--color-pipe);
}
.ep-reel input[type="range"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
  z-index: 3;
}
.ep-in { animation: ep-in 520ms var(--ease-out-expo) both; animation-delay: var(--ep-delay, 0ms); }
@keyframes ep-in {
  from { opacity: 0; transform: translateX(1.25rem) skewX(-4deg); }
  to { opacity: 1; transform: none; }
}
.ep-cut { animation: ep-cut 360ms steps(3, end) both; }
@keyframes ep-cut {
  0% { clip-path: inset(0 0 100% 0); }
  100% { clip-path: inset(0 0 0 0); }
}
.ep-pick {
  position: relative;
  display: block;
  width: 100%;
  text-align: left;
  border: 2px solid var(--color-ink);
  background: var(--color-surface);
  color: var(--color-fg);
  font-family: var(--font-sans);
  transition: transform 160ms ease, box-shadow 160ms ease;
}
.ep-pick:hover { transform: translate(-1px, -2px); }
.ep-pick[aria-pressed="true"] { box-shadow: 5px 5px 0 var(--color-pipe); transform: translate(-2px, -2px); }
.ep-pick:disabled { border-color: var(--color-line); color: var(--color-muted); cursor: not-allowed; }
.ep-pick:disabled:hover { transform: none; }
.ep-pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 0.86rem;
  line-height: 1.55;
}
@media (prefers-reduced-motion: reduce) {
  .ep-lamp[data-on="true"]::after,
  .ep-card::after { animation: none; }
  .ep-card::after { display: none; }
  .ep-in, .ep-cut { animation: none; }
  .ep-pick, .ep-reel-scene { transition: none; }
  .ep-pick:hover, .ep-pick[aria-pressed="true"] { transform: none; }
}
`;

export function EpisodesStyle() {
  return <style>{CSS}</style>;
}

/**
 * The studio lamp. It is lit only when an episode is out and can be watched.
 * Until then it sits dark and says so.
 */
export function OnAirLamp({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={cn("ep-lamp", className)} data-on={on ? "true" : "false"} role="status">
      <span className="ep-lamp-bulb" aria-hidden="true" />
      {on ? "On air" : "Off air"}
    </span>
  );
}

export function StatusLine({ status, className }: { status: EpisodeStatus; className?: string }) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex min-h-7 items-center border-2 border-ink px-2",
        status === "out" ? "bg-ink text-bg" : "bg-transparent text-fg",
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** A clapper slate: a row of labelled cells under a striped stick. */
export function Slate({
  cells,
  className,
}: {
  cells: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn("ep-slate grid", className)}
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="ep-slate-cell">
          <dt className="eyebrow text-subtle">{cell.label}</dt>
          <dd className="ep-tc mt-1 truncate text-lg sm:text-2xl">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The visitor's own clock as a running timecode. It is the real time on their
 * device, nothing more. With motion reduced it ticks once a second, without frames.
 */
export function StationClock({ className }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const read = () => {
      const date = new Date();
      setNow(
        date.getHours() * 3600 +
          date.getMinutes() * 60 +
          date.getSeconds() +
          (calm ? 0 : date.getMilliseconds() / 1000),
      );
    };
    read();
    const timer = window.setInterval(read, calm ? 1000 : 83);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className={cn("ep-tc", className)} aria-hidden="true">
      {now === null ? "--:--:--:--" : formatTimecode(now, { fps: 24 }).padStart(11, "0")}
    </span>
  );
}

/** Garment colours of the two sets, standing in for the bars of a broadcast test card. */
const BARS = ["#b9a3ee", "#f3ead9", "#ff8a3c", "#a5dccb", "#f7c3a4", "#3d7eff", "#20182c"];
const FOOT = ["#20182c", "#f6f1ff", "#20182c", "#ff2d95", "#20182c", "#f3ead9", "#0b0614"];

/**
 * A test card. It fills the screen where a picture would be, so nobody takes a
 * placeholder for a frame from the show.
 */
export function TestCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("ep-card", className)}>
      <div className="ep-bars" aria-hidden="true">
        {BARS.map((color) => (
          <span key={color} style={{ background: color }} />
        ))}
        {FOOT.map((color, index) => (
          <span key={`${color}-${index}`} style={{ background: color }} />
        ))}
      </div>
      <div className="relative z-[2] h-full w-full">{children}</div>
    </div>
  );
}
