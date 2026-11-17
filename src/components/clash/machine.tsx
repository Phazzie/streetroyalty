import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ClashBadge } from "@/components/rack/clash-badge";
import { Tracksuit, type TracksuitView } from "@/components/garments/tracksuit";
import {
  addKept,
  clashScore,
  colorName,
  decodeColorway,
  describeColorway,
  encodeColorway,
  KEPT_KEY,
  louder,
  normalizeHex,
  paletteOf,
  parseKept,
  PRESETS,
  quieter,
  REEL_COLORS,
  REEL_KEYS,
  removeKept,
  type Colorway,
  type ReelKey,
} from "@/lib/clash";

/**
 * The clash machine: a slot machine for colourways. Three reels (body, panel, piping) roll, the
 * sweatsuit redraws as each one lands, and the score lands last. The colours are owned by the
 * caller (the address bar), so a colourway can be shared as a link.
 */

const CELL = 44;
/** The strip is the reel's colours repeated, so a spin can run forward a few turns without running out. */
const REPS = 6;
const HOME = 2;
const STEP_MS = 240;

const REEL_LABEL: Record<ReelKey, string> = { body: "Body", panel: "Panels", piping: "Piping" };

/** Each reel carries the same colours in a different order, plus one spare slot for a hand-picked colour. */
function buildStrip(shift: number, stride: number, spare: string): string[] {
  const count = REEL_COLORS.length;
  const out: string[] = [];
  for (let i = 0; i < count; i += 1)
    out.push(REEL_COLORS[(shift + i * stride) % count] ?? "#000000");
  return [...out, spare];
}

const STRIDE: Record<ReelKey, [number, number]> = { body: [0, 1], panel: [1, 5], piping: [2, 9] };
const SPARE: Record<ReelKey, string> = { body: "#d9cdf7", panel: "#e3d8c3", piping: "#d61fc4" };

type Reel = {
  strip: string[];
  /** Which cell sits on the payline, counted along the repeated strip. */
  pos: number;
  /** Transition time for the current move. 0 means jump. */
  ms: number;
};

type Reels = Record<ReelKey, Reel>;

function startReel(key: ReelKey, hex: string): Reel {
  const [shift, stride] = STRIDE[key];
  const strip = buildStrip(shift, stride, SPARE[key]);
  let index = strip.indexOf(hex);
  if (index < 0) {
    index = strip.length - 1;
    strip[index] = hex;
  }
  return { strip, pos: HOME * strip.length + index, ms: 0 };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

type Props = {
  colors: Colorway;
  onChange: (next: Colorway) => void;
};

export function ClashMachine({ colors, onChange }: Props) {
  const reduced = usePrefersReducedMotion();
  const [reels, setReels] = useState<Reels>(() => ({
    body: startReel("body", colors.body),
    panel: startReel("panel", colors.panel),
    piping: startReel("piping", colors.piping),
  }));
  /** The colours that have landed. The drawing and the score follow these, not the reels in flight. */
  const [shown, setShown] = useState<Colorway>(colors);
  const [locked, setLocked] = useState<Record<ReelKey, boolean>>({
    body: false,
    panel: false,
    piping: false,
  });
  const [rolling, setRolling] = useState(false);
  const [landings, setLandings] = useState(0);
  const [view, setView] = useState<TracksuitView>("set");
  const [kept, setKept] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const reelsRef = useRef(reels);
  reelsRef.current = reels;
  const pull = useRef(false);
  const timers = useRef<Partial<Record<ReelKey | "all", number>>>({});

  useEffect(() => {
    try {
      setKept(parseKept(window.localStorage.getItem(KEPT_KEY)));
    } catch {
      setKept([]);
    }
  }, []);

  const saveKept = useCallback((next: string[]) => {
    setKept(next);
    try {
      window.localStorage.setItem(KEPT_KEY, JSON.stringify(next));
    } catch {
      // Storage can be off or full. The list still works until the page is closed.
    }
  }, []);

  // Whenever the colours change, from a pull, a step, a pick, a preset or the back button, move the reels to them.
  useEffect(() => {
    const wasPull = pull.current;
    pull.current = false;
    const current = reelsRef.current;
    const next: Reels = { ...current };
    let longest = 0;

    REEL_KEYS.forEach((key, order) => {
      const reel = current[key];
      const hex = colors[key];
      const count = reel.strip.length;
      let strip = reel.strip;
      let index = strip.indexOf(hex);
      if (index < 0) {
        index = count - 1;
        strip = [...strip];
        strip[index] = hex;
      }
      const from = HOME * count + (((reel.pos % count) + count) % count);
      const forward = (index - (from % count) + count) % count;
      if (forward === 0 && strip === reel.strip) {
        next[key] = { strip, pos: from, ms: 0 };
        return;
      }
      window.clearTimeout(timers.current[key]);
      if (reduced) {
        next[key] = { strip, pos: HOME * count + index, ms: 0 };
        setShown((before) => ({ ...before, [key]: hex }));
        return;
      }
      const spin = wasPull && forward > 0;
      const ms = spin ? 820 + order * 380 : STEP_MS;
      const turns = spin ? (order === 2 ? 2 : 1) : 0;
      const back = forward - count;
      const delta = spin ? turns * count + forward : forward <= count / 2 ? forward : back;
      next[key] = { strip, pos: from + delta, ms };
      longest = Math.max(longest, ms);
      timers.current[key] = window.setTimeout(() => {
        setReels((before) => ({ ...before, [key]: { strip, pos: HOME * count + index, ms: 0 } }));
        setShown((before) => ({ ...before, [key]: hex }));
      }, ms + 30);
    });

    setReels(next);
    window.clearTimeout(timers.current.all);
    if (longest > 0) {
      if (wasPull) setRolling(true);
      timers.current.all = window.setTimeout(() => {
        setRolling(false);
        setLandings((count) => count + 1);
        // A phone gives a small knock when the last reel stops, and a harder one for a riot.
        if (wasPull && typeof navigator.vibrate === "function") {
          const landed = clashScore([colors.body, colors.panel, colors.piping]).score;
          navigator.vibrate(landed >= 80 ? [28, 40, 28, 40, 60] : landed >= 60 ? [24, 40, 24] : 14);
        }
      }, longest + 40);
    } else {
      setRolling(false);
      setLandings((count) => count + 1);
    }
  }, [colors.body, colors.panel, colors.piping, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const held = timers.current;
    return () => {
      for (const id of Object.values(held)) window.clearTimeout(id);
    };
  }, []);

  const result = clashScore(paletteOf(shown));
  const code = encodeColorway(colors);
  const isKept = kept.includes(code);
  const allLocked = REEL_KEYS.every((key) => locked[key]);

  function roll() {
    if (rolling || allLocked) return;
    const next: Colorway = { ...colors };
    for (const key of REEL_KEYS) {
      if (locked[key]) continue;
      const strip = reels[key].strip;
      const choices = strip.filter((hex) => hex !== colors[key]);
      next[key] = choices[Math.floor(Math.random() * choices.length)] ?? colors[key];
    }
    pull.current = true;
    setNote("");
    onChange(next);
  }

  function step(key: ReelKey, by: 1 | -1) {
    if (rolling) return;
    const reel = reels[key];
    const count = reel.strip.length;
    const at = reel.strip.indexOf(colors[key]);
    const hex = reel.strip[((((at < 0 ? 0 : at) + by) % count) + count) % count];
    if (hex) onChange({ ...colors, [key]: hex });
  }

  function nudge(direction: "louder" | "quieter") {
    if (rolling) return;
    const palette = paletteOf(colors);
    const held = REEL_KEYS.map((key) => locked[key]);
    const moved = direction === "louder" ? louder(palette, held) : quieter(palette, held);
    const next = decodeColorway(moved.map((hex) => hex.replace("#", "")).join("-"));
    if (!next || encodeColorway(next) === code) {
      setNote(
        direction === "louder"
          ? "That is as loud as these colours go."
          : "That is as quiet as these colours go.",
      );
      return;
    }
    setNote("");
    onChange(next);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied. Anyone who opens it gets this colourway.");
    } catch {
      setNote("Copy the address from the bar at the top. The colours are in it.");
    }
  }

  const pullLabel = rolling ? "Rolling" : allLocked ? "All three are locked" : "Pull";

  // The score label prints out of register in the three colours, further off the louder it gets.
  const offset = (result.score / 100) * 5;
  const scoreStyle = {
    "--cm-a": shown.body,
    "--cm-b": shown.piping,
    "--cm-k": `${offset.toFixed(2)}px`,
  } as CSSProperties;

  return (
    <div className="cm-root">
      <style>{CSS}</style>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* Stage: the drawing on cream paper, like the product pictures, with the score beside it. */}
        <section className="paper relative border-2 border-ink" aria-label="The colourway">
          <div
            key={landings}
            className={`cm-score px-3 pt-3 ${rolling ? "cm-rolling" : "cm-landed"} ${result.score >= 60 ? "cm-shake" : ""}`}
            style={scoreStyle}
          >
            <div className="flex items-end justify-between gap-3">
              <p className="display cm-label text-[2.9rem] sm:text-6xl">{result.label}</p>
              <p className="shrink-0 pb-0.5 text-right font-display leading-none">
                <span className="block text-3xl tabular-nums sm:text-4xl">{result.score}</span>
                <span className="mt-1 block text-[0.62rem] tracking-[0.14em] text-muted uppercase">
                  out of 100
                </span>
              </p>
            </div>
          </div>
          <p className="min-h-11 px-3 pt-2 text-sm text-muted" aria-live="polite">
            <span className="sr-only">
              {rolling ? "" : `${result.label}, ${result.score} out of 100. `}
            </span>
            {rolling ? "Rolling" : sentence(result.reasons.slice(0, 2).join(", and "))}
          </p>
          <Tracksuit
            colors={shown}
            view={view}
            title={`A drawing of the sweatsuit in ${describeColorway(shown)}`}
            className="mx-auto block h-[214px] w-full px-2 pb-2 sm:h-[340px] lg:h-[400px]"
          />
          <div
            className="grid grid-cols-3 border-t-2 border-ink"
            role="group"
            aria-label="Which piece to show"
          >
            {(["set", "hoodie", "jogger"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`cm-view ${view === option ? "cm-view-on" : ""}`}
              >
                {option === "set" ? "Set" : option === "hoodie" ? "Hoodie" : "Jogger"}
              </button>
            ))}
          </div>
        </section>

        <section className="border-2 border-ink bg-surface p-3" aria-label="The machine">
          <div className="grid grid-cols-3 gap-2">
            {REEL_KEYS.map((key) => (
              <ReelColumn
                key={key}
                id={key}
                reel={reels[key]}
                hex={colors[key]}
                locked={locked[key]}
                disabled={rolling}
                onStep={(by) => step(key, by)}
                onLock={() => setLocked((before) => ({ ...before, [key]: !before[key] }))}
                onPick={(hex) => onChange({ ...colors, [key]: hex })}
              />
            ))}
          </div>

          <Button
            size="lg"
            className="mt-4 hidden w-full font-display tracking-wide uppercase lg:inline-flex"
            disabled={rolling || allLocked}
            onClick={roll}
          >
            {pullLabel}
          </Button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" disabled={rolling} onClick={() => nudge("quieter")}>
              Quieter
            </Button>
            <Button variant="ghost" disabled={rolling} onClick={() => nudge("louder")}>
              Louder
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-display text-[0.68rem] tracking-[0.14em] text-subtle uppercase">
              House
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip gap-2"
                disabled={rolling}
                aria-pressed={encodeColorway(preset.colors) === code}
                onClick={() => {
                  setNote("");
                  onChange(preset.colors);
                }}
              >
                <span className="flex" aria-hidden="true">
                  {paletteOf(preset.colors).map((hex) => (
                    <span
                      key={hex}
                      className="-ml-px block size-3 border border-ink first:ml-0"
                      style={{ background: hex }}
                    />
                  ))}
                </span>
                {preset.name}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              disabled={rolling || isKept}
              onClick={() => {
                saveKept(addKept(kept, colors));
                setNote("Kept. It is in your list below, on this device.");
              }}
            >
              {isKept ? "Kept" : "Keep this colourway"}
            </Button>
            <Button variant="ghost" onClick={() => void copyLink()}>
              Copy link
            </Button>
          </div>
          <p className="mt-2 min-h-5 text-sm text-muted" role="status">
            {note}
          </p>
        </section>
      </div>

      {/* On a phone the lever rides the bottom of the screen, so the first tap is always in reach. */}
      <div className="cm-lever sticky bottom-0 z-10 -mx-4 border-t-2 border-ink bg-bg px-4 pt-3 lg:hidden">
        <Button
          size="lg"
          className="w-full font-display tracking-wide uppercase"
          disabled={rolling || allLocked}
          onClick={roll}
        >
          {pullLabel}
        </Button>
      </div>

      <p className="mt-4 max-w-xl border-2 border-ink bg-surface px-3 py-2 text-sm text-muted">
        This is a colour toy, and the sweatsuit is a drawing. The full garment designer is being
        built, so nothing here can be ordered yet.
      </p>

      <section className="mt-8" aria-labelledby="cm-kept-title">
        <h2 id="cm-kept-title" className="font-display text-xl leading-none">
          Kept colourways
        </h2>
        {kept.length === 0 ? (
          <p className="empty-state mt-3 text-muted">
            Nothing kept yet. Pull until something stops you, then keep it.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kept.map((entry) => {
              const saved = decodeColorway(entry);
              if (!saved) return null;
              const name = describeColorway(saved);
              return (
                <li key={entry} className="flex min-w-0 flex-col border-2 border-ink bg-surface">
                  <div className="paper border-b-2 border-ink">
                    <Tracksuit colors={saved} view="set" className="block h-28 w-full p-1" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
                    <ClashBadge palette={paletteOf(saved)} size="sm" />
                    <p className="text-sm text-muted first-letter:uppercase">{name}</p>
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="chip px-1"
                        disabled={rolling}
                        aria-label={`Load ${name}`}
                        onClick={() => {
                          setNote("");
                          onChange(saved);
                          window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
                        }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="chip px-1"
                        aria-label={`Remove ${name}`}
                        onClick={() => saveKept(removeKept(kept, entry))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-subtle">
          Kept colourways stay on this device. To send one to somebody, load it and copy the link.
        </p>
      </section>
    </div>
  );
}

function sentence(text: string): string {
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function ReelColumn({
  id,
  reel,
  hex,
  locked,
  disabled,
  onStep,
  onLock,
  onPick,
}: {
  id: ReelKey;
  reel: Reel;
  hex: string;
  locked: boolean;
  disabled: boolean;
  onStep: (by: 1 | -1) => void;
  onLock: () => void;
  onPick: (hex: string) => void;
}) {
  const label = REEL_LABEL[id];
  const name = colorName(hex);
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cells: string[] = [];
  for (let rep = 0; rep < REPS; rep += 1) cells.push(...reel.strip);

  return (
    <div
      className="flex min-w-0 flex-col items-stretch gap-2"
      role="group"
      aria-label={`${label} reel`}
    >
      <p className="font-display text-[0.7rem] tracking-[0.14em] uppercase">{label}</p>
      <div className={`cm-window ${locked ? "cm-window-locked" : ""}`}>
        <div
          className="cm-strip"
          aria-hidden="true"
          style={{
            transform: `translateY(${-(reel.pos - 1) * CELL}px)`,
            transition:
              reel.ms > 0 ? `transform ${reel.ms}ms cubic-bezier(0.16, 1, 0.3, 1)` : "none",
          }}
        >
          {cells.map((cell, index) => (
            <div key={index} className="cm-cell" style={{ background: cell }} />
          ))}
        </div>
        <span className="cm-payline" aria-hidden="true" />
        <button
          type="button"
          className="cm-step cm-step-up"
          disabled={disabled}
          onClick={() => onStep(-1)}
          aria-label={`${label}: colour before`}
        >
          <Arrow up />
        </button>
        <button
          type="button"
          className="cm-step cm-step-down"
          disabled={disabled}
          onClick={() => onStep(1)}
          aria-label={`${label}: colour after`}
        >
          <Arrow />
        </button>
      </div>
      <p className="truncate text-center text-sm" aria-live="off">
        <span className="sr-only">{label} is </span>
        {name}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          className={`cm-tool ${locked ? "cm-tool-on" : ""}`}
          aria-pressed={locked}
          aria-label={locked ? `Unlock ${label.toLowerCase()}` : `Lock ${label.toLowerCase()}`}
          title={locked ? "Locked. Pull will not change it." : "Lock this reel"}
          onClick={onLock}
        >
          <Padlock closed={locked} />
        </button>
        <label className="cm-tool cm-pick" title="Pick an exact colour">
          <span className="sr-only">Pick an exact {label.toLowerCase()} colour</span>
          <input
            type="color"
            value={draft ?? hex}
            disabled={disabled}
            onChange={(event) => {
              const picked = normalizeHex(event.target.value);
              if (!picked) return;
              // A colour well fires on every drag. Wait for the hand to settle before moving the reel.
              setDraft(picked);
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => {
                setDraft(null);
                onPick(picked);
              }, 140);
            }}
          />
          <Dropper />
        </label>
      </div>
    </div>
  );
}

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 10"
      width="16"
      height="10"
      aria-hidden="true"
      style={up ? { transform: "rotate(180deg)" } : undefined}
    >
      <path
        d="M1.5 1.5 8 8l6.5-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Padlock({ closed }: { closed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path
        d={closed ? "M6 9V6.5a4 4 0 0 1 8 0V9" : "M6 9V6.5a4 4 0 0 1 7.6-1.7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="4" y="9" width="12" height="9" fill="currentColor" />
    </svg>
  );
}

function Dropper() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path
        d="m3 17 1-4 7-7 3 3-7 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m11.5 3.5 5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const CSS = `
.cm-lever { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
.cm-window {
  position: relative;
  height: ${CELL * 3}px;
  overflow: hidden;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
}
.cm-window-locked { box-shadow: 4px 4px 0 var(--color-pipe); }
.cm-strip { will-change: transform; }
.cm-cell {
  height: ${CELL}px;
  box-shadow: inset 0 -2px 0 rgb(20 8 28 / 85%);
}
/* The payline: the middle cell is the colour you have. The cells above and below wait behind a veil. */
.cm-payline {
  position: absolute;
  inset: ${CELL}px 0;
  pointer-events: none;
  box-shadow:
    0 0 0 2px var(--color-ink),
    0 -${CELL}px 0 0 rgb(11 6 20 / 46%),
    0 ${CELL}px 0 0 rgb(11 6 20 / 46%);
}
.cm-step {
  position: absolute;
  left: 0;
  right: 0;
  height: ${CELL}px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  filter: drop-shadow(0 0 1px #14081c) drop-shadow(0 1px 0 #14081c);
}
.cm-step-up { top: 0; }
.cm-step-down { bottom: 0; }
.cm-step:disabled { opacity: 0.35; }
.cm-step:focus-visible,
.cm-tool:focus-visible,
.cm-pick:focus-within,
.cm-view:focus-visible {
  outline: 2px solid var(--color-fg);
  outline-offset: 2px;
}
.cm-step:focus-visible { outline-offset: -4px; outline-color: #fff; }
.cm-step:active { transform: scale(0.9); }
.cm-tool {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
  color: var(--color-fg);
}
.cm-tool-on { background: var(--color-fg); color: var(--color-bg); }
.cm-pick { cursor: pointer; }
.cm-pick input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.cm-view {
  min-height: 44px;
  padding: 0 0.6rem;
  border-right: 2px solid var(--color-ink);
  background: var(--color-surface);
  color: var(--color-fg);
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cm-view:last-child { border-right: 0; }
.cm-view-on { background: var(--color-fg); color: var(--color-bg); }
.cm-view:focus-visible { outline-offset: -4px; }
.cm-label {
  text-shadow:
    calc(var(--cm-k) * -1) 0 0 var(--cm-a),
    var(--cm-k) var(--cm-k) 0 var(--cm-b);
  -webkit-text-stroke: 0.5px var(--color-fg);
  transform-origin: left bottom;
}
.cm-rolling { opacity: 0.3; }
.cm-landed .cm-label { animation: cm-stamp 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.cm-landed.cm-shake .cm-label { animation: cm-stamp 420ms cubic-bezier(0.16, 1, 0.3, 1) both, cm-buzz 1.1s steps(2, end) 420ms 3; }
@keyframes cm-stamp {
  from { transform: scale(1.5) rotate(-5deg); opacity: 0; }
  60% { opacity: 1; }
  to { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes cm-buzz {
  0% { transform: translate(0, 0); }
  25% { transform: translate(1.5px, -1px); }
  50% { transform: translate(-1.5px, 1px); }
  75% { transform: translate(1px, 1px); }
  100% { transform: translate(0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .cm-strip { transition: none !important; }
  .cm-landed .cm-label,
  .cm-landed.cm-shake .cm-label { animation: none; }
  .cm-step:active { transform: none; }
}
`;
