import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import type { BoardView } from "@/lib/golive/board.server";
import {
  SERVICES,
  TEST_ORDER_STEPS,
  VARIABLE_IN_ONE_LINE,
  VERCEL_STEPS,
  type ServiceId,
  type ServiceSpec,
} from "@/lib/golive/services";
import type { Lamp, ServiceReport } from "@/lib/golive/switchboard";

/** What the page hands the panel. Null modes mean the server could not be read. */
export type PanelView =
  BoardView | { view: "public"; signedIn: boolean; podMode: null; paymentsMode: null };

/** A cover sits over every switch until a shop admin is looking. */
type Face = Lamp | "covered";

const STATE_WORD: Record<Face, string> = {
  on: "On",
  partly: "Partly",
  off: "Off",
  covered: "Cover on",
};

const CSS = `
.gl-box {
  position: relative;
  border: 2px solid var(--color-ink);
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 3%) 0 1px, transparent 1px 5px),
    var(--color-surface);
}
.gl-rivet {
  position: absolute;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 9999px;
  border: 2px solid var(--color-ink);
  background: var(--color-line);
}
.gl-plate {
  border-bottom: 2px solid var(--color-ink);
  background: var(--color-bg);
}
.gl-row {
  position: relative;
  border-top: 2px solid var(--color-line);
  padding: 1.1rem 0.75rem 1.25rem;
  scroll-margin-top: 5rem;
}
.gl-row:first-child { border-top: 0; }
/* The bus bar. Each breaker owns the stretch that runs behind it. */
.gl-row::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(0.75rem + 1.375rem - 3px);
  width: 6px;
  background: var(--color-line);
}
.gl-row[data-face="on"]::before {
  background: repeating-linear-gradient(180deg, var(--color-pipe) 0 9px, transparent 9px 14px);
  background-size: 100% 14px;
  animation: gl-flow 0.9s linear infinite;
}
.gl-row[data-face="partly"]::before {
  background: repeating-linear-gradient(180deg, var(--color-amber) 0 4px, transparent 4px 14px);
}
.gl-head {
  position: relative;
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0.9rem;
  align-items: start;
}
.gl-slot {
  position: relative;
  width: 2.75rem;
  height: 4.75rem;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
}
.gl-slot::before,
.gl-slot::after {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: 0.56rem;
  line-height: 1;
  color: var(--color-subtle);
}
.gl-slot::before { content: "I"; top: 3px; }
.gl-slot::after { content: "O"; bottom: 3px; }
.gl-handle {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 13px;
  height: 1.5rem;
  border: 2px solid var(--color-ink);
  background:
    repeating-linear-gradient(180deg, transparent 0 4px, rgb(20 8 28 / 55%) 4px 6px),
    var(--gl-fill, var(--color-line));
  transform: translateY(var(--gl-y, 22px));
  animation: gl-throw 620ms var(--ease-out-expo) both;
  animation-delay: calc(var(--gl-i, 0) * 80ms + 200ms);
}
[data-face="on"] .gl-handle { --gl-y: 0px; --gl-fill: var(--color-fg); }
[data-face="partly"] .gl-handle { --gl-y: 11px; --gl-fill: var(--color-amber); }
[data-face="off"] .gl-handle { --gl-y: 22px; --gl-fill: var(--color-line); }
/* Under the cover there is no handle to read, only the hatch of the plate. */
[data-face="covered"] .gl-slot {
  background: repeating-linear-gradient(135deg, var(--color-line) 0 4px, var(--color-bg) 4px 9px);
}
[data-face="covered"] .gl-slot::before,
[data-face="covered"] .gl-slot::after,
[data-face="covered"] .gl-handle { display: none; }
.gl-lamp {
  position: relative;
  flex: none;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 9999px;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
}
[data-face="on"] .gl-lamp { background: var(--color-cyan); }
[data-face="on"] .gl-lamp::after {
  content: "";
  position: absolute;
  inset: -8px;
  border-radius: 9999px;
  background: repeating-conic-gradient(var(--color-cyan) 0 7deg, transparent 7deg 30deg);
  -webkit-mask: radial-gradient(circle, transparent 0 64%, #000 65%);
  mask: radial-gradient(circle, transparent 0 64%, #000 65%);
  animation: gl-spin 12s linear infinite;
}
[data-face="partly"] .gl-lamp {
  background: linear-gradient(90deg, var(--color-amber) 0 50%, var(--color-bg) 50%);
  animation: gl-blink 2s steps(1, end) infinite;
}
[data-face="off"] .gl-lamp::after {
  content: "";
  position: absolute;
  inset: 3px 45%;
  background: var(--color-subtle);
  transform: rotate(45deg);
}
[data-face="covered"] .gl-lamp { display: none; }
.gl-state {
  display: inline-flex;
  align-items: center;
  border: 2px solid var(--color-ink);
  padding: 0.1rem 0.45rem;
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--color-bg);
  color: var(--color-fg);
}
[data-face="on"] .gl-state { background: var(--color-cyan); color: #14081c; }
[data-face="partly"] .gl-state { background: var(--color-amber); color: #14081c; }
[data-face="covered"] .gl-state { color: var(--color-muted); border-style: dashed; }
.gl-num {
  font-size: 2.6rem;
  color: var(--color-subtle);
}
.gl-body { padding-left: 3.65rem; }
.gl-name {
  display: inline-block;
  max-width: 100%;
  border: 2px solid var(--color-line);
  background: var(--color-bg);
  padding: 0.55rem 0.6rem;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
  user-select: all;
}
.gl-fuse[data-set="false"] .gl-name { border-color: var(--color-ink); }
.gl-pill {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border: 2px solid var(--color-ink);
}
.gl-fuse[data-set="true"] .gl-pill { background: var(--color-cyan); color: #14081c; }
.gl-fuse[data-set="false"] .gl-pill { background: var(--color-bg); color: var(--color-fg); }
.gl-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  min-width: 5.75rem;
  padding: 0 0.8rem;
  border: 2px solid var(--color-ink);
  background: var(--color-surface);
  color: var(--color-fg);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: transform 160ms ease;
}
.gl-copy:hover { transform: translateY(-2px); }
.gl-copy:active { transform: translateY(1px); }
.gl-copy[data-done="true"] { background: var(--color-fg); color: var(--color-bg); }
.gl-how > summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  list-style: none;
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.gl-how > summary::-webkit-details-marker { display: none; }
.gl-how > summary::before {
  content: "+";
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
  font-size: 1rem;
  line-height: 1;
}
.gl-how[open] > summary::before { content: "\\2212"; }
.gl-steps { counter-reset: gl-step; }
.gl-steps > li {
  counter-increment: gl-step;
  position: relative;
  padding-left: 2.1rem;
}
.gl-steps > li::before {
  content: counter(gl-step);
  position: absolute;
  left: 0;
  top: 0.1rem;
  width: 1.45rem;
  height: 1.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid currentColor;
  font-family: var(--font-display);
  font-size: 0.7rem;
}
.gl-needle {
  transform-box: view-box;
  transform-origin: 110px 108px;
  transform: rotate(var(--gl-angle, -62deg));
  animation: gl-swing 1100ms var(--ease-out-expo) both;
  animation-delay: 250ms;
}
.gl-caps th,
.gl-caps td { padding: 0.35rem 0.5rem; text-align: left; border-top: 2px solid var(--color-line); }
.gl-caps thead th { border-top: 0; font-weight: 400; color: var(--color-muted); font-size: 0.8rem; }
@keyframes gl-flow { to { background-position: 0 14px; } }
@keyframes gl-spin { to { transform: rotate(360deg); } }
@keyframes gl-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.35; } }
@keyframes gl-throw { from { transform: translateY(22px); } }
@keyframes gl-swing { from { transform: rotate(-62deg); } }
@media (min-width: 640px) {
  .gl-row { padding: 1.4rem 1.25rem 1.6rem; }
  .gl-row::before { left: calc(1.25rem + 1.375rem - 3px); }
  .gl-body { padding-left: 4.15rem; }
  .gl-head { gap: 1.4rem; }
}
@media (prefers-reduced-motion: reduce) {
  .gl-handle,
  .gl-needle,
  .gl-lamp,
  .gl-lamp::after,
  .gl-row::before { animation: none !important; }
  .gl-copy { transition: none; }
  .gl-copy:hover,
  .gl-copy:active { transform: none; }
}
`;

function CopyName({ name, onCopied }: { name: string; onCopied: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className="gl-copy"
      data-done={state === "done"}
      aria-label={`Copy the name ${name}`}
      onClick={() => {
        void navigator.clipboard
          .writeText(name)
          .then(() => {
            setState("done");
            onCopied(`Copied ${name}. Paste it into Key in Vercel.`);
          })
          .catch(() => {
            setState("failed");
            onCopied(`Could not copy. Tap the name ${name} to select it.`);
          })
          .finally(() => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setState("idle"), 1800);
          });
      }}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Tap the name" : "Copy name"}
    </button>
  );
}

function Fuse({
  name,
  what,
  set,
  onCopied,
}: {
  name: string;
  what: string;
  /** Null when this viewer is not shown live status. */
  set: boolean | null;
  onCopied: (text: string) => void;
}) {
  return (
    <li className="gl-fuse" data-set={set === null ? undefined : set}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="gl-name">{name}</code>
        {set === null ? null : <span className="gl-pill">{set ? "In" : "Missing"}</span>}
        {set === true ? null : <CopyName name={name} onCopied={onCopied} />}
      </div>
      <p className="mt-1 max-w-prose text-sm text-muted">{what}</p>
    </li>
  );
}

/** An analog meter: how many of the switches are fully on. Parked at zero under the cover. */
function Gauge({ on, total, covered }: { on: number; total: number; covered: boolean }) {
  const angle = covered ? -62 : -62 + (on / total) * 124;
  const ticks = Array.from({ length: total + 1 }, (_, index) => -62 + (index / total) * 124);
  return (
    <svg
      viewBox="0 0 220 150"
      className="h-auto w-full max-w-[15rem]"
      role="img"
      aria-label={
        covered ? "Meter under cover" : `Meter reading ${on} of ${total} switches fully on`
      }
    >
      <rect
        x="1"
        y="1"
        width="218"
        height="148"
        fill="var(--color-bg)"
        stroke="var(--color-ink)"
        strokeWidth="2"
      />
      {ticks.map((tick, index) => (
        <g key={tick} transform={`rotate(${tick} 110 108)`}>
          <line
            x1="110"
            y1="26"
            x2="110"
            y2={index === 0 || index === total ? 44 : 38}
            stroke={!covered && index <= on && index > 0 ? "var(--color-cyan)" : "var(--color-fg)"}
            strokeWidth={index === 0 || index === total ? 4 : 3}
          />
        </g>
      ))}
      <text
        x="110"
        y="139"
        textAnchor="middle"
        fill="var(--color-muted)"
        style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.16em" }}
      >
        {covered ? "COVER ON" : "SWITCHES ON"}
      </text>
      <g className="gl-needle" style={{ "--gl-angle": `${angle}deg` } as CSSProperties}>
        <line x1="110" y1="108" x2="110" y2="32" stroke="var(--color-pipe)" strokeWidth="4" />
      </g>
      <circle cx="110" cy="108" r="9" fill="var(--color-fg)" />
      <circle cx="110" cy="108" r="3" fill="var(--color-bg)" />
    </svg>
  );
}

function Breaker({
  spec,
  report,
  index,
  open,
  names,
  onCopied,
}: {
  spec: ServiceSpec;
  report: ServiceReport | null;
  index: number;
  open: boolean;
  names: Record<ServiceId, string>;
  onCopied: (text: string) => void;
}) {
  const face: Face = report ? report.lamp : "covered";
  const needed = spec.variables.filter((variable) => variable.need === "needed");
  const optional = spec.variables.filter((variable) => variable.need === "optional");
  const isSet = (name: string): boolean | null =>
    report ? (report.variables.find((variable) => variable.name === name)?.set ?? false) : null;

  return (
    <li
      id={`sw-${spec.id}`}
      className="gl-row"
      data-face={face}
      style={{ "--gl-i": index } as CSSProperties}
    >
      <div className="gl-head">
        <div className="gl-slot" aria-hidden="true">
          <span className="gl-handle" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="display gl-num" aria-hidden="true">
              {String(index).padStart(2, "0")}
            </span>
            <h2 className="tape">{spec.name}</h2>
            <span className="flex items-center gap-2">
              <span className="gl-lamp" aria-hidden="true" />
              <span className="gl-state">
                <span className="sr-only">Status: </span>
                {STATE_WORD[face]}
              </span>
            </span>
          </div>
          <p className="mt-2 max-w-prose text-lg leading-snug">{spec.unlocks}</p>
        </div>
      </div>

      <div className="gl-body mt-3 grid gap-3 lg:grid-cols-2 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="max-w-prose text-muted">
            {report ? report.now : `While it is off: ${lowerFirst(spec.without)}`}
          </p>
          {report?.notes.map((note) => (
            <p key={note} className="max-w-prose border-2 border-amber bg-bg px-3 py-2 text-sm">
              {note}
            </p>
          ))}
          {report && report.waitsOn.length > 0 ? (
            <p className="text-sm">
              Waiting on{" "}
              {report.waitsOn.map((id) => (
                <a
                  key={id}
                  href={`#sw-${id}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {names[id]}
                </a>
              ))}
              .
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {needed.map((variable) => (
              <Fuse
                key={variable.name}
                name={variable.name}
                what={variable.what}
                set={isSet(variable.name)}
                onCopied={onCopied}
              />
            ))}
          </ul>
        </div>
        <details className="gl-how min-w-0" open={open}>
          <summary>{face === "on" ? "How it was switched on" : "How to switch it on"}</summary>
          <div className="mt-2 flex flex-col gap-4 border-l-2 border-line pl-3">
            <ol className="gl-steps flex max-w-prose flex-col gap-2 text-sm">
              {spec.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {spec.provider ? (
              <p>
                <a className="chip" href={spec.provider.url} target="_blank" rel="noreferrer">
                  Open {spec.provider.name}
                  <span className="sr-only"> in a new tab</span>
                </a>
              </p>
            ) : null}
            {optional.length > 0 ? (
              <div>
                <p className="eyebrow mb-2 text-muted">Fine tuning. All optional.</p>
                <ul className="flex flex-col gap-3">
                  {optional.map((variable) => (
                    <Fuse
                      key={variable.name}
                      name={variable.name}
                      what={variable.what}
                      set={null}
                      onCopied={onCopied}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </li>
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function GoLivePanel({ view }: { view: PanelView }) {
  const [said, setSaid] = useState("");
  const admin = view.view === "admin";
  const board = view.view === "admin" ? view.board : null;
  const visitor = view.view === "public" ? view : null;
  const names = Object.fromEntries(SERVICES.map((spec) => [spec.id, spec.name])) as Record<
    ServiceId,
    string
  >;
  const onCount = board ? board.services.filter((service) => service.lamp === "on").length : 0;
  const nextId: ServiceId | null = board ? board.next : "admins";
  const verdict = board
    ? board.canPay
      ? "People can pay."
      : "Nobody can pay yet."
    : "The live readings are under a cover.";

  return (
    <div className="gl-root">
      <style>{CSS}</style>
      <p className="tag">Owner's room</p>
      <h1 className="display mt-4 text-6xl sm:text-7xl">Go live</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">
        One board. What is on, what is off and what to do next. Work down it from the top.
      </p>

      <section className="gl-box mt-6" aria-label="Reading">
        <span className="gl-rivet top-1.5 left-1.5" aria-hidden="true" />
        <span className="gl-rivet top-1.5 right-1.5" aria-hidden="true" />
        <div className="grid items-center gap-5 p-5 pt-6 sm:grid-cols-[15rem_minmax(0,1fr)] sm:p-7">
          <Gauge on={onCount} total={SERVICES.length} covered={!admin} />
          <div className="min-w-0">
            <p className="display text-4xl sm:text-5xl">{verdict}</p>
            {board ? (
              <>
                <p className="mt-3 max-w-prose text-muted">
                  {onCount} of {SERVICES.length} switches fully on. Printing is{" "}
                  {board.podMode === "live" ? "live" : "in sandbox"}. Payments are{" "}
                  {board.paymentsMode === "live" ? "live" : "in sandbox"}.
                  {nextId ? null : " Place a test order to prove it."}
                </p>
                <p className="mt-4">
                  <a href={`#sw-${nextId ?? "test"}`} className="chip chip-on">
                    Next: {nextId ? lowerFirst(names[nextId]) : "the test order"}
                  </a>
                </p>
              </>
            ) : visitor ? (
              <>
                <p className="mt-3 max-w-prose text-muted">
                  Only the shop's own email can lift it. Anyone can read the checklist below.
                  {visitor.podMode && visitor.paymentsMode
                    ? ` What every visitor can already see: printing is ${
                        visitor.podMode === "live" ? "live" : "in sandbox"
                      } and payments are ${visitor.paymentsMode === "live" ? "live" : "in sandbox"}.`
                    : ""}
                </p>
                <p className="mt-3 max-w-prose">
                  {visitor.signedIn
                    ? "You are signed in, but this email does not lift the cover. If the shop is yours, switch 00 is your first step."
                    : "If the shop is yours, sign in, then do switch 00. It puts your email on the list."}
                </p>
                {visitor.signedIn ? null : (
                  <p className="mt-4">
                    <Link to="/login" className="chip chip-on">
                      Sign in
                    </Link>
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="paper mt-6 border-2 border-ink p-5 sm:p-7" aria-labelledby="gl-first">
        <p className="eyebrow">Read this first</p>
        <h2 id="gl-first" className="display mt-2 text-3xl sm:text-4xl">
          Every switch is a setting
        </h2>
        <p className="mt-3 max-w-prose">{VARIABLE_IN_ONE_LINE}</p>
        <p className="mt-4 font-display text-sm tracking-wide uppercase">
          Where each one goes, every time
        </p>
        <ol className="gl-steps mt-2 flex max-w-prose flex-col gap-2 text-sm">
          {VERCEL_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-4 max-w-prose text-sm text-muted">
          This board only knows whether a setting is there. It never shows what is in one, and it
          cannot tell a right key from a wrong one. The test order at the bottom does that.
        </p>
      </section>

      <section className="gl-box mt-6" aria-label="Switches">
        <div className="gl-plate flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="eyebrow">Street Royalty main panel</p>
          <p className="eyebrow text-muted">I is on. O is off. Halfway is partly.</p>
        </div>
        <ol>
          {SERVICES.map((spec, index) => (
            <Breaker
              key={spec.id}
              spec={spec}
              index={index}
              report={board?.services.find((service) => service.id === spec.id) ?? null}
              open={spec.id === nextId}
              names={names}
              onCopied={setSaid}
            />
          ))}
          <li
            id="sw-test"
            className="gl-row"
            data-face={board ? (board.canPay ? "on" : "off") : "covered"}
            style={{ "--gl-i": SERVICES.length } as CSSProperties}
          >
            <div className="gl-head">
              <div className="gl-slot" aria-hidden="true">
                <span className="gl-handle" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="display gl-num" aria-hidden="true">
                    {String(SERVICES.length).padStart(2, "0")}
                  </span>
                  <h2 className="tape">The test order</h2>
                  {board ? (
                    <span className="gl-state">{board.canPay ? "Ready to try" : "Not yet"}</span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-prose text-lg leading-snug">
                  The only proof the board is wired right: one real piece, paid for and made.
                </p>
              </div>
            </div>
            <div className="gl-body mt-3 flex flex-col gap-3">
              <ol className="gl-steps flex max-w-prose flex-col gap-2 text-sm">
                {TEST_ORDER_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {board && !board.canPay ? (
                <p className="max-w-prose text-sm text-muted">
                  Until payments and printing are both live, an order from the studio is practice:
                  no charge, nothing made.
                </p>
              ) : null}
              <p>
                <Link to="/studio" className={`chip ${board?.canPay ? "chip-on" : ""}`}>
                  Open the studio
                </Link>
              </p>
            </div>
          </li>
        </ol>
        {board ? (
          <div className="border-t-2 border-ink p-4 sm:p-6">
            <h2 className="font-display text-sm tracking-wide uppercase">
              Daily caps on pictures and video
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              What the site will allow today. The fine tuning under switch 05 changes these.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="gl-caps w-full max-w-md text-sm">
                <thead>
                  <tr>
                    <th scope="col">Kind</th>
                    <th scope="col">Each visitor</th>
                    <th scope="col">Everyone</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Pictures", board.caps.image],
                      ["Videos", board.caps.video],
                      ["Written answers", board.caps.text],
                    ] as const
                  ).map(([label, cap]) => (
                    <tr key={label}>
                      <th scope="row" className="font-normal">
                        {label}
                      </th>
                      <td>{cap.visitor} a day</td>
                      <td>{cap.global} a day</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <span className="gl-rivet bottom-1.5 left-1.5" aria-hidden="true" />
        <span className="gl-rivet right-1.5 bottom-1.5" aria-hidden="true" />
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
