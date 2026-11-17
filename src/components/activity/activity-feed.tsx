import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  myActivity,
  type ActivityItem,
  type ActivityKind,
  type ActivityPart,
} from "@/lib/social/activity-api";
import { clock, groupByDay } from "./days";

/**
 * What happened to your pieces: crowns, followers, remixes, battles and street scans.
 * It fetches for itself and draws nothing for someone who is signed out.
 *
 * The look is a seam. A stitched line runs down the page and every piece of news is
 * a patch sewn onto it. Lime is only on the things you can tap.
 */

const KINDS: { kind: ActivityKind; label: string; patch: string }[] = [
  { kind: "crown", label: "Crowns", patch: "bg-amber" },
  { kind: "follow", label: "Followers", patch: "bg-violet" },
  { kind: "remix", label: "Remixes", patch: "bg-blue" },
  { kind: "battle", label: "Battles", patch: "bg-orange" },
  { kind: "scan", label: "Scans", patch: "bg-cyan" },
];

const KIND_NAME: Record<ActivityKind, string> = {
  crown: "Crown",
  follow: "New follower",
  remix: "Remix",
  battle: "Battles",
  scan: "Street scans",
};

type Load =
  { state: "loading" } | { state: "error" } | { state: "ready"; items: ActivityItem[]; now: Date };

/** Where this browser keeps the time of the newest news it has shown. Nothing personal. */
const SEEN_KEY = "sr-activity-seen";

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(when: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, when);
  } catch {
    // A private tab may refuse storage. Then nothing is marked new next time, which is fine.
  }
}

const STYLES = `
.sr-act-seam { position: relative; }
.sr-act-seam::before {
  content: "";
  position: absolute;
  left: calc(1.375rem - 1px);
  top: 0.25rem;
  bottom: 0.25rem;
  width: 2px;
  background: repeating-linear-gradient(to bottom, var(--color-pipe) 0 8px, transparent 8px 14px);
  animation: sr-act-sew 1100ms var(--ease-out-expo) both;
}
@keyframes sr-act-sew {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0 0 0 0); }
}
.sr-act-row {
  animation: sr-act-in 520ms var(--ease-out-expo) both;
  animation-delay: calc(var(--sr-act-i, 0) * 55ms);
}
@keyframes sr-act-in {
  from { opacity: 0; transform: translateX(-0.75rem); }
  to { opacity: 1; transform: none; }
}
.sr-act-patch {
  position: relative;
  transform: rotate(var(--sr-act-tilt, 0deg));
  animation: sr-act-stamp 460ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
  animation-delay: calc(var(--sr-act-i, 0) * 55ms + 80ms);
}
.sr-act-patch::after {
  content: "";
  position: absolute;
  inset: 3px;
  border: 1.5px dashed rgb(20 8 28 / 55%);
  pointer-events: none;
}
@keyframes sr-act-stamp {
  from { opacity: 0; transform: scale(1.9) rotate(calc(var(--sr-act-tilt, 0deg) * -5)); }
  to { opacity: 1; transform: rotate(var(--sr-act-tilt, 0deg)); }
}
.sr-act-link {
  font-weight: 700;
  color: var(--color-fg);
  text-decoration: underline;
  text-decoration-color: var(--color-accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  /* Inline padding grows the place a thumb can land without moving the line. */
  padding-block: 0.8rem;
  overflow-wrap: anywhere;
}
.sr-act-link:hover { text-decoration-thickness: 4px; }
/* The padding would make a tall outline. Flip the words themselves instead. */
.sr-act-link:focus-visible {
  outline: none;
  background: var(--color-fg);
  background-clip: content-box;
  color: var(--color-bg);
  text-decoration-color: var(--color-fg);
}
.sr-act-score { font-family: var(--font-display); line-height: 1; }
.sr-act-new {
  display: inline-block;
  margin-right: 0.15rem;
  border: 2px solid var(--color-ink);
  background: var(--color-pipe);
  color: #14081c;
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  padding: 0.18rem 0.3rem;
  vertical-align: 0.12em;
  transform: rotate(-4deg);
}
@media (prefers-reduced-motion: reduce) {
  .sr-act-seam::before, .sr-act-row, .sr-act-patch { animation: none; }
}
`;

function Mark({ kind }: { kind: ActivityKind }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-6 w-6",
    "aria-hidden": true,
    fill: "none",
    stroke: "#14081c",
    strokeWidth: 2.2,
    strokeLinecap: "square" as const,
  };
  if (kind === "crown") {
    return (
      <svg {...common} fill="#14081c" stroke="none">
        <path d="M2.5 17.5 5 6.5l4 4.8L12 3l3 8.3 4-4.8 2.5 11Z" />
        <rect x="2.5" y="18.8" width="19" height="2.2" />
      </svg>
    );
  }
  if (kind === "follow") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.4" fill="#14081c" stroke="none" />
        <path d="M3 21v-2.5c0-2.5 2.6-4.3 6-4.3s6 1.8 6 4.3V21Z" fill="#14081c" stroke="none" />
        <path d="M19 5v7M15.5 8.5h7" />
      </svg>
    );
  }
  if (kind === "remix") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="12" height="12" fill="#14081c" stroke="none" />
        <rect x="9" y="9" width="12" height="12" />
      </svg>
    );
  }
  if (kind === "battle") {
    return (
      <svg {...common} strokeWidth={3}>
        <path d="M4 4l16 16M20 4 4 20" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="#14081c" stroke="none">
      <path d="M3 3h8v8H3Zm2.6 2.6v2.8h2.8V5.6ZM13 3h8v8h-8Zm2.6 2.6v2.8h2.8V5.6ZM3 13h8v8H3Zm2.6 2.6v2.8h2.8v-2.8Z" />
      <path d="M13 13h3v3h-3Zm5 0h3v3h-3Zm-2.5 4h3v4h-3Zm4 2h1.5v2H19.5Z" />
    </svg>
  );
}

function Part({ part }: { part: ActivityPart }) {
  if ("to" in part && part.to === "maker") {
    return (
      <Link to="/m/$handle" params={{ handle: part.handle }} className="sr-act-link">
        {part.text}
      </Link>
    );
  }
  if ("to" in part && part.to === "piece") {
    return (
      <Link to="/rack/$slug" params={{ slug: part.slug }} className="sr-act-link">
        {part.text}
      </Link>
    );
  }
  return <>{part.text}</>;
}

/** Up to twelve little squares: solid for a win, hollow for a loss. */
function Tally({ won, lost }: { won: number; lost: number }) {
  const cells = [
    ...Array.from({ length: won }, () => true),
    ...Array.from({ length: lost }, () => false),
  ];
  const shown = cells.slice(0, 12);
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1" aria-hidden="true">
      {shown.map((win, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 border-2 border-ink ${win ? "bg-fg" : "bg-transparent"}`}
        />
      ))}
      {cells.length > shown.length ? (
        <span className="text-xs text-muted">and {cells.length - shown.length} more</span>
      ) : null}
    </span>
  );
}

function Aside({ item }: { item: ActivityItem }) {
  if (item.kind === "battle") {
    return (
      <span className="sr-act-score text-lg" aria-hidden="true">
        {item.won ?? 0}
        <span className="text-muted"> to </span>
        {item.lost ?? 0}
      </span>
    );
  }
  if (item.kind === "scan") {
    return (
      <span className="sr-act-score text-lg" aria-hidden="true">
        ×{item.scans ?? 0}
      </span>
    );
  }
  return (
    <time dateTime={item.when} className="text-sm whitespace-nowrap text-muted">
      {clock(item.when)}
    </time>
  );
}

function Row({ item, index, fresh }: { item: ActivityItem; index: number; fresh: boolean }) {
  const tone = KINDS.find((entry) => entry.kind === item.kind)?.patch ?? "bg-surface";
  const tilt = [-5, 3, -2, 6, -4, 2][index % 6] ?? 0;
  return (
    <li
      className="sr-act-row flex items-start gap-3 py-2.5"
      style={{ "--sr-act-i": Math.min(index, 12), "--sr-act-tilt": `${tilt}deg` } as CSSProperties}
    >
      <span
        className={`sr-act-patch grid h-11 w-11 shrink-0 place-items-center border-2 border-ink ${tone}`}
      >
        <Mark kind={item.kind} />
        <span className="sr-only">{KIND_NAME[item.kind]}: </span>
      </span>
      <span className="min-w-0 flex-1 self-center">
        <span className="block leading-snug">
          {fresh ? (
            <>
              <span className="sr-act-new">New</span>{" "}
            </>
          ) : null}
          {item.parts.map((part, at) => (
            <Part key={at} part={part} />
          ))}
        </span>
        {item.kind === "battle" ? <Tally won={item.won ?? 0} lost={item.lost ?? 0} /> : null}
      </span>
      <span className="shrink-0 self-center pl-1 text-right">
        <Aside item={item} />
      </span>
    </li>
  );
}

export function ActivityFeed() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [only, setOnly] = useState<ActivityKind | null>(null);
  const busy = useRef(false);
  // The newest thing this browser showed last visit. Anything after it is marked new.
  const [seen, setSeen] = useState<string | null>(null);
  const seenRead = useRef(false);

  const fetchFeed = useCallback(async (quiet: boolean) => {
    if (busy.current) return;
    busy.current = true;
    if (!quiet) setLoad({ state: "loading" });
    try {
      const items = await myActivity();
      if (!seenRead.current) {
        seenRead.current = true;
        setSeen(readSeen());
      }
      const newest = items[0]?.when;
      if (newest) writeSeen(newest);
      setLoad({ state: "ready", items, now: new Date() });
    } catch {
      // A quiet refresh that fails leaves what is on screen alone.
      if (!quiet) setLoad({ state: "error" });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void fetchFeed(false);
    // Coming back to the tab is when someone wants to know what happened while they were gone.
    const onShow = () => {
      if (document.visibilityState === "visible") void fetchFeed(true);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [userId, fetchFeed]);

  const items = load.state === "ready" ? load.items : null;
  const counts = useMemo(() => {
    const tally = new Map<ActivityKind, number>();
    for (const item of items ?? []) tally.set(item.kind, (tally.get(item.kind) ?? 0) + 1);
    return tally;
  }, [items]);
  const present = KINDS.filter((entry) => counts.has(entry.kind));
  const filter = only && counts.has(only) ? only : null;
  const groups = useMemo(() => {
    if (load.state !== "ready") return [];
    const shown = filter ? load.items.filter((item) => item.kind === filter) : load.items;
    // Each group knows how many rows came before it, so the rows stamp in one after another.
    let before = 0;
    return groupByDay(shown, load.now).map((group) => {
      const start = before;
      before += group.items.length;
      return { ...group, start };
    });
  }, [load, filter]);

  const freshCount = seen ? (items ?? []).filter((item) => item.when > seen).length : 0;

  if (isPending || !userId) return null;

  return (
    <section aria-labelledby="sr-act-title" className="min-w-0">
      <style>{STYLES}</style>
      <p className="tag">On your pieces</p>
      <h2 id="sr-act-title" className="mt-3 font-display text-2xl leading-none">
        What happened
      </h2>

      {load.state === "loading" ? (
        <ul className="mt-5" aria-label="Loading what happened">
          {[0, 1, 2].map((row) => (
            <li key={row} className="pending-pulse flex items-center gap-3 py-2.5">
              <span className="h-11 w-11 shrink-0 border-2 border-line bg-surface" />
              <span className="h-4 flex-1 bg-surface" />
            </li>
          ))}
        </ul>
      ) : null}

      {load.state === "error" ? (
        <div className="mt-5 border-2 border-pipe bg-surface p-4" role="status">
          <p>This did not load.</p>
          <button type="button" className="chip chip-on mt-3" onClick={() => void fetchFeed(false)}>
            Try again
          </button>
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <div className="empty-state mt-5">
          <p>Nothing yet. Publish a piece and it starts here.</p>
          <Link to="/studio" className="chip chip-on mt-3">
            Open the studio
          </Link>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <>
          {present.length > 1 ? (
            <div
              className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
              role="group"
              aria-label="Show only one kind of news"
            >
              <button
                type="button"
                className={`chip shrink-0 ${filter === null ? "chip-on" : ""}`}
                aria-pressed={filter === null}
                onClick={() => setOnly(null)}
              >
                All {items.length}
              </button>
              {present.map((entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  className={`chip shrink-0 ${filter === entry.kind ? "chip-on" : ""}`}
                  aria-pressed={filter === entry.kind}
                  onClick={() => setOnly(entry.kind)}
                >
                  {entry.label} {counts.get(entry.kind)}
                </button>
              ))}
            </div>
          ) : null}

          {freshCount > 0 ? (
            <p className="mt-4 text-sm text-muted" role="status">
              {freshCount} new since you last looked.
            </p>
          ) : null}

          <div className="sr-act-seam mt-5 max-w-2xl" key={filter ?? "all"}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label} className="pb-4">
                <h3 className="tape relative mb-1 ml-0.5">{group.label}</h3>
                <ul>
                  {group.items.map((item, at) => (
                    <Row
                      key={item.id}
                      item={item}
                      index={group.start + at}
                      fresh={seen !== null && item.when > seen}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {items.length >= 40 ? (
            <p className="text-sm text-muted">That is the last 40. Older news rolls off.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
