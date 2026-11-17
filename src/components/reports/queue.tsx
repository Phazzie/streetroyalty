import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listReports, resolveReport } from "@/lib/social/reports-api";
import {
  REPORT_MESSAGES,
  reasonLabel,
  waitingFor,
  type ReportAction,
  type ReportGroup,
  type ReportQueue,
  type ReportReason,
} from "./reasons";
import { ReportStyles, Stamp } from "./stamp";

type Phase =
  | { name: "loading" }
  | { name: "closed" }
  | { name: "error"; message: string }
  | { name: "open"; queue: ReportQueue };

/** One colour per reason, so a pile's mix reads at a glance. None of them is lime. */
const REASON_COLOR: Record<ReportReason, string> = {
  stolen: "var(--color-orange)",
  hate: "var(--color-pink)",
  nudity: "var(--color-violet)",
  scam: "var(--color-blue)",
  other: "var(--color-subtle)",
};

const TILTS = ["-0.7deg", "0.5deg", "-0.3deg", "0.8deg"];
const SLIPS_SHOWN = 4;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function nameOf(group: ReportGroup): string {
  if (group.piece) return group.piece.title || "This piece";
  if (group.maker) return `@${group.maker.handle}`;
  return group.kind === "piece" ? "A deleted piece" : "A maker with no page";
}

/** What the two buttons say and do for this pile. A pile with nothing left to act on only clears. */
function choices(group: ReportGroup): {
  keep: string | null;
  remove: string;
  confirm: string | null;
  yes: string;
  stamp: string;
} {
  if (group.kind === "piece") {
    if (!group.piece || !group.piece.onRack) {
      return {
        keep: null,
        remove: "Clear these reports",
        confirm: null,
        yes: "",
        stamp: "Cleared",
      };
    }
    return {
      keep: "Keep it",
      remove: "Take it off the rack",
      confirm: "Take it down for everyone? Its maker keeps it as a draft.",
      yes: "Yes, take it off the rack",
      stamp: "Off the rack",
    };
  }
  if (!group.maker) {
    return { keep: null, remove: "Clear these reports", confirm: null, yes: "", stamp: "Cleared" };
  }
  if (!group.maker.bio) {
    return {
      keep: "Keep",
      remove: "Clear these reports",
      confirm: null,
      yes: "",
      stamp: "Cleared",
    };
  }
  return {
    keep: "Keep",
    remove: "Clear the bio",
    confirm: "Clear what they wrote about themselves? The account and the pieces stay.",
    yes: "Yes, clear the bio",
    stamp: "Bio cleared",
  };
}

export function ReportsQueue() {
  const { user, isPending } = useCurrentUserState();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [settled, setSettled] = useState<Record<string, string>>({});
  const [said, setSaid] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);

  const load = useCallback(async () => {
    try {
      const queue = await listReports();
      setPhase({ name: "open", queue });
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "";
      if (message === REPORT_MESSAGES.staffOnly || message === "Unauthorized") {
        setPhase({ name: "closed" });
      } else {
        setPhase({ name: "error", message: message || "The queue did not load." });
      }
    }
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setPhase({ name: "closed" });
      return;
    }
    void load();
  }, [isPending, user, load]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  /** The stamp lands, the docket folds away, then it leaves the list. */
  function onSettled(group: ReportGroup, stamp: string, line: string) {
    setSettled((current) => ({ ...current, [group.ticket]: stamp }));
    setSaid(line);
    timers.current.push(
      window.setTimeout(() => {
        setPhase((current) =>
          current.name === "open"
            ? {
                name: "open",
                queue: {
                  groups: current.queue.groups.filter((item) => item.ticket !== group.ticket),
                  open: Math.max(0, current.queue.open - group.count),
                },
              }
            : current,
        );
        heading.current?.focus();
      }, 1500),
    );
  }

  if (phase.name === "closed") {
    return <p>{REPORT_MESSAGES.staffOnly}</p>;
  }

  return (
    <div>
      <ReportStyles />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tag">Back room</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-3 font-display text-4xl leading-none focus:outline-none"
          >
            Reports
          </h1>
        </div>
        {phase.name === "open" ? (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setPhase({ name: "loading" });
              void load();
            }}
          >
            Check again
          </button>
        ) : null}
      </div>
      <p className="mt-2 max-w-xl text-muted">
        What people flagged, piled by what it is about. Biggest pile first. Nothing comes down until
        you say so.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>

      {phase.name === "loading" ? (
        <p className="pending-pulse mt-6 text-muted">Opening the back room.</p>
      ) : null}

      {phase.name === "error" ? (
        <div className="mt-6 border-2 border-pipe bg-surface p-4">
          <p role="alert">{phase.message}</p>
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              setPhase({ name: "loading" });
              void load();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {phase.name === "open" ? (
        <>
          <p className="mt-5 font-display text-sm tracking-wide uppercase">
            {plural(phase.queue.groups.length, "pile", "piles")}
            <span className="text-subtle"> / </span>
            {plural(phase.queue.open, "open report", "open reports")}
          </p>
          {phase.queue.groups.length === 0 ? (
            <p className="empty-state mt-3">No open reports. Nothing is waiting on you.</p>
          ) : (
            <ol className="mt-3 grid gap-5 lg:grid-cols-2">
              {phase.queue.groups.map((group, index) => (
                <li key={group.ticket} className="min-w-0">
                  <Docket
                    group={group}
                    index={index}
                    stamp={settled[group.ticket] ?? null}
                    onSettled={onSettled}
                  />
                </li>
              ))}
            </ol>
          )}
          <p className="mt-8 max-w-xl text-sm text-subtle">
            A report never takes anything down by itself. Off the rack means the piece goes back to
            its maker as a draft. Nothing on this page deletes an account.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Docket({
  group,
  index,
  stamp,
  onSettled,
}: {
  group: ReportGroup;
  index: number;
  stamp: string | null;
  onSettled: (group: ReportGroup, stamp: string, line: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [all, setAll] = useState(false);
  const choice = choices(group);
  const name = nameOf(group);
  const slips = all ? group.slips : group.slips.slice(0, SLIPS_SHOWN);

  async function settle(action: ReportAction) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await resolveReport({ data: { ticket: group.ticket, action } });
      const reports = plural(result.settled, "report", "reports");
      if (action === "keep") {
        onSettled(group, "Kept", `${name} stays. ${reports} settled.`);
      } else {
        onSettled(
          group,
          choice.stamp,
          `${name}: ${choice.stamp.toLowerCase()}. ${reports} settled.`,
        );
      }
    } catch (cause: unknown) {
      setError(
        cause instanceof Error && cause.message ? cause.message : "That did not go through.",
      );
      setAsking(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="sr-rep-docket sr-rep-docket-in relative border-2 border-ink bg-surface"
      data-settled={stamp ? "true" : "false"}
      style={{ "--sr-rep-delay": `${Math.min(index, 8) * 70}ms` } as CSSProperties}
      aria-label={`${name}, ${plural(group.count, "report", "reports")}`}
    >
      <header className="flex gap-3 border-b-2 border-line p-3">
        {group.kind === "piece" ? (
          group.piece?.mockupUrl ? (
            <img
              src={group.piece.mockupUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-20 shrink-0 border-2 border-ink bg-bg object-cover"
            />
          ) : (
            <div className="aspect-[4/5] w-20 shrink-0 border-2 border-dashed border-line bg-bg" />
          )
        ) : (
          <div
            className="display grid aspect-[4/5] w-20 shrink-0 place-items-center border-2 border-ink bg-bg text-5xl"
            aria-hidden
          >
            {group.maker?.handle.charAt(0) ?? "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.7rem] tracking-widest text-muted uppercase">
            {group.kind === "piece" ? "Piece" : "Maker"}
            <span className="text-subtle"> / </span>
            waiting {waitingFor(group.firstAt)}
          </p>
          <h2 className="mt-1 font-display text-xl leading-tight break-words uppercase">{name}</h2>
          <TargetLine group={group} />
        </div>
        <p className="shrink-0 text-right leading-none">
          <span className="display block text-6xl">{group.count}</span>
          <span className="font-display text-[0.7rem] tracking-widest text-muted uppercase">
            {group.count === 1 ? "report" : "reports"}
          </span>
        </p>
      </header>

      <div className="border-b-2 border-line p-3">
        <div className="flex h-3 w-full overflow-hidden border-2 border-ink" aria-hidden>
          {group.reasons.map((item) => (
            <span
              key={item.reason}
              style={{ flexGrow: item.count, backgroundColor: REASON_COLOR[item.reason] }}
            />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {group.reasons.map((item) => (
            <li key={item.reason} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 border-2 border-ink"
                style={{ backgroundColor: REASON_COLOR[item.reason] }}
                aria-hidden
              />
              <span>
                {reasonLabel(item.reason, "short")}{" "}
                <span className="font-display tabular-nums">{item.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid gap-3 p-3 sm:grid-cols-2">
        {slips.map((slip, slipIndex) => (
          <li
            key={`${slip.at}-${slipIndex}`}
            className="paper sr-rep-slip min-w-0 border-2 border-ink p-3"
            style={{ "--sr-rep-tilt": TILTS[slipIndex % TILTS.length] } as CSSProperties}
          >
            <p className="font-display text-[0.7rem] tracking-widest uppercase">
              {reasonLabel(slip.reason, "short")}
            </p>
            {slip.note ? (
              <p className="mt-1 break-words">{slip.note}</p>
            ) : (
              <p className="mt-1 text-muted">No note.</p>
            )}
            <p className="mt-2 text-sm text-muted">
              {slip.by ? (
                <>
                  from{" "}
                  <Link
                    to="/m/$handle"
                    params={{ handle: slip.by }}
                    className="underline underline-offset-2"
                  >
                    @{slip.by}
                  </Link>
                </>
              ) : (
                "from someone with no maker page"
              )}
              <span> / {waitingFor(slip.at)}</span>
            </p>
          </li>
        ))}
      </ul>
      {group.slips.length > SLIPS_SHOWN ? (
        <div className="px-3 pb-3">
          <button type="button" className="chip" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${group.slips.length}`}
          </button>
        </div>
      ) : null}

      <div className="border-t-2 border-line p-3">
        {error ? (
          <p role="alert" className="mb-3 border-2 border-pipe bg-bg px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
        {asking && choice.confirm ? (
          <div>
            <p className="mb-3">{choice.confirm}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                autoFocus
                className="sm:flex-1"
                disabled={busy}
                onClick={() => void settle("remove")}
              >
                {busy ? "Working" : choice.yes}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            {choice.keep ? (
              <Button
                variant="ghost"
                className="sm:flex-1"
                disabled={busy || Boolean(stamp)}
                onClick={() => void settle("keep")}
              >
                {choice.keep}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="sm:flex-1"
              disabled={busy || Boolean(stamp)}
              onClick={() => (choice.confirm ? setAsking(true) : void settle("remove"))}
            >
              {choice.remove}
            </Button>
          </div>
        )}
      </div>

      {stamp ? (
        <div className="absolute inset-0 grid place-items-center overflow-hidden bg-bg/85">
          <Stamp tone={stamp === "Kept" ? "ink" : "pink"}>{stamp}</Stamp>
        </div>
      ) : null}
    </article>
  );
}

function TargetLine({ group }: { group: ReportGroup }) {
  const link =
    "inline-flex min-h-11 items-center underline decoration-2 underline-offset-4 hover:decoration-fg";
  const row = "flex flex-wrap items-center gap-x-4 text-sm text-muted";
  if (group.kind === "piece") {
    if (!group.piece) return <p className="mt-1 text-sm text-muted">Its maker deleted it.</p>;
    return (
      <p className={row}>
        {group.piece.maker ? (
          <span>
            by{" "}
            <Link to="/m/$handle" params={{ handle: group.piece.maker.handle }} className={link}>
              @{group.piece.maker.handle}
            </Link>
          </span>
        ) : null}
        {group.piece.onRack ? (
          <Link to="/rack/$slug" params={{ slug: group.piece.slug }} className={link}>
            See it on the rack
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center">Already off the rack</span>
        )}
      </p>
    );
  }
  if (!group.maker) return <p className="mt-1 text-sm text-muted">No maker page any more.</p>;
  return (
    <div className="text-sm text-muted">
      <p className={row}>
        <span>{group.maker.name}</span>
        <Link to="/m/$handle" params={{ handle: group.maker.handle }} className={link}>
          See their page
        </Link>
      </p>
      {group.maker.bio ? (
        <p className="border-l-4 border-pipe pl-2 break-words text-fg">{group.maker.bio}</p>
      ) : (
        <p>The bio is empty.</p>
      )}
    </div>
  );
}
