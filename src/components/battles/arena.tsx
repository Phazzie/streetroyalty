import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { castVote, nextBattle } from "@/lib/social/battles-api";
import {
  splitPercent,
  type BattleSide,
  type NextBattle,
  type VoteTally,
} from "@/lib/social/battles";
import { ARENA_CSS } from "./arena-css";

type SideName = "left" | "right";
type Phase = "loading" | "enter" | "ready" | "voting" | "reveal" | "leave" | "over" | "failed";

/** How long the split stays up before the next pair comes in by itself. */
const REVEAL_MS = 2800;
const ENTER_MS = 720;
const LEAVE_MS = 260;
/** The seam never closes a side completely, however one-sided the vote. */
const MIN_SHARE = 32;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

/** Counts up to the target once it is switched on. Jumps straight there with motion reduced. */
function useCountUp(target: number, on: boolean): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!on) {
      setShown(0);
      return;
    }
    if (reducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 620);
      setShown(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, on]);
  return shown;
}

function crowdLine(tally: VoteTally): string {
  if (tally.total === 1) return "First vote on this pair. Yours.";
  if (tally.winnerVotes === tally.loserVotes) return "Dead even.";
  return tally.winnerVotes > tally.loserVotes
    ? "You went with the crowd."
    : "You went against the crowd.";
}

function Side({
  name,
  side,
  share,
  revealed,
  picked,
  lost,
  busy,
  signedIn,
  onPick,
}: {
  name: SideName;
  side: BattleSide;
  share: number;
  revealed: boolean;
  picked: boolean;
  lost: boolean;
  busy: boolean;
  signedIn: boolean;
  onPick: () => void;
}) {
  const shown = useCountUp(share, revealed);
  return (
    <button
      type="button"
      className={`btl-side btl-side-${name}`}
      data-lost={revealed && lost ? "true" : undefined}
      data-picked={picked ? "true" : undefined}
      aria-disabled={busy || undefined}
      aria-label={
        revealed
          ? `${side.title} by ${side.maker.name}: ${share} percent`
          : `Pick ${side.title} by ${side.maker.name}`
      }
      onClick={onPick}
    >
      <span className="btl-shot">
        {side.mockupUrl ? (
          <img src={side.mockupUrl} alt="" decoding="async" draggable={false} />
        ) : (
          <span className="btl-noshot">No picture yet</span>
        )}
      </span>
      <span className="btl-key" aria-hidden="true">
        {name === "left" ? "←" : "→"}
      </span>
      {picked ? <span className="tape btl-mine">Your pick</span> : null}
      {revealed ? (
        <span className="btl-pct display" aria-hidden="true">
          <span>
            {shown}
            <small>%</small>
          </span>
        </span>
      ) : null}
      <span className="btl-plate">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm uppercase sm:text-base">
            {side.title}
          </span>
          <span className="block truncate text-sm text-muted">by {side.maker.name}</span>
        </span>
        {revealed ? null : (
          <span className="btl-go" data-quiet={busy ? "true" : undefined}>
            {busy ? "Locked in" : signedIn ? "Wear this" : "Sign in to pick"}
          </span>
        )}
      </span>
    </button>
  );
}

function PieceLinks({ side }: { side: BattleSide }) {
  return (
    <div className="flex min-w-0 flex-col items-start text-sm text-muted">
      <Link
        to="/rack/$slug"
        params={{ slug: side.slug }}
        className="inline-flex min-h-11 items-center font-display text-fg uppercase underline decoration-2 underline-offset-4"
      >
        <span className="clamp-2">{side.title}</span>
      </Link>
      {side.maker.handle ? (
        <Link
          to="/m/$handle"
          params={{ handle: side.maker.handle }}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          by {side.maker.name}
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center">by {side.maker.name}</span>
      )}
    </div>
  );
}

/**
 * The arena. Two published pieces, one tap. The split only shows once the vote is in,
 * then the seam slides to it and the next pair crashes in.
 */
export function Arena({ onVoted }: { onVoted?: () => void }) {
  const [battle, setBattle] = useState<NextBattle | null>(null);
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [picked, setPicked] = useState<SideName | null>(null);
  const [tally, setTally] = useState<VoteTally | null>(null);
  const [problem, setProblem] = useState("");
  const [asked, setAsked] = useState(0);

  const phaseRef = useRef<Phase>("loading");
  const battleRef = useRef<NextBattle | null>(null);
  const pickedRef = useRef<SideName | null>(null);
  const upNext = useRef<Promise<NextBattle> | null>(null);
  const stepped = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const signInRef = useRef<HTMLAnchorElement | null>(null);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const later = useCallback((run: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (alive.current) run();
    }, ms);
  }, []);

  const show = useCallback(
    (next: NextBattle) => {
      battleRef.current = next;
      pickedRef.current = null;
      setBattle(next);
      setPicked(null);
      setTally(null);
      if (!next.pair) {
        setPhase("over");
        return;
      }
      setPhase("enter");
      later(() => setPhase("ready"), reducedMotion() ? 0 : ENTER_MS);
    },
    [later, setPhase],
  );

  const fetchNext = useCallback(
    () =>
      nextBattle({
        data: { skip: stepped.current, after: battleRef.current?.pair?.key ?? "" },
      }) as Promise<NextBattle>,
    [],
  );

  const bringNext = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const coming = upNext.current ?? fetchNext();
    upNext.current = null;
    setPhase("leave");
    const waited = new Promise<void>((resolve) => {
      setTimeout(resolve, reducedMotion() ? 0 : LEAVE_MS);
    });
    void Promise.all([coming, waited])
      .then(([next]) => {
        if (alive.current) show(next);
      })
      .catch((reason: unknown) => {
        if (!alive.current) return;
        setProblem(messageOf(reason, "The next pair did not load."));
        setPhase("failed");
      });
  }, [fetchNext, setPhase, show]);

  const send = useCallback(
    (side: SideName) => {
      const pair = battleRef.current?.pair;
      if (!pair) return;
      const winner = side === "left" ? pair.left : pair.right;
      const loser = side === "left" ? pair.right : pair.left;
      if (timer.current) clearTimeout(timer.current);
      pickedRef.current = side;
      setPicked(side);
      setProblem("");
      setPhase("voting");
      void (castVote({ data: { winnerId: winner.id, loserId: loser.id } }) as Promise<VoteTally>)
        .then((result) => {
          if (!alive.current) return;
          setTally(result);
          setPhase("reveal");
          upNext.current = fetchNext();
          // A failed look-ahead is dealt with when the pair is asked for.
          upNext.current.catch(() => undefined);
          onVoted?.();
          if (!reducedMotion()) later(bringNext, REVEAL_MS);
        })
        .catch((reason: unknown) => {
          if (!alive.current) return;
          pickedRef.current = null;
          setPicked(null);
          setTally(null);
          setProblem(messageOf(reason, "That vote did not go through. Try again."));
          setPhase("ready");
        });
    },
    [bringNext, fetchNext, later, onVoted, setPhase],
  );

  const pick = useCallback(
    (side: SideName) => {
      if (phaseRef.current === "reveal") {
        bringNext();
        return;
      }
      if (phaseRef.current !== "ready") return;
      if (!battleRef.current?.signedIn) {
        setAsked((count) => count + 1);
        signInRef.current?.focus();
        return;
      }
      send(side);
    },
    [bringNext, send],
  );

  const skip = useCallback(() => {
    const pair = battleRef.current?.pair;
    if (phaseRef.current !== "ready" || !pair) return;
    stepped.current = [...stepped.current, pair.key].slice(-40);
    upNext.current = null;
    bringNext();
  }, [bringNext]);

  const switchPick = useCallback(() => {
    if (phaseRef.current !== "reveal" || !pickedRef.current) return;
    send(pickedRef.current === "left" ? "right" : "left");
  }, [send]);

  const reload = useCallback(() => {
    setProblem("");
    setPhase("loading");
    void fetchNext()
      .then((next) => {
        if (alive.current) show(next);
      })
      .catch((reason: unknown) => {
        if (!alive.current) return;
        setProblem(messageOf(reason, "The battle did not load."));
        setPhase("failed");
      });
  }, [fetchNext, setPhase, show]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (phaseRef.current !== "ready" && phaseRef.current !== "reveal") return;
      event.preventDefault();
      pick(event.key === "ArrowLeft" ? "left" : "right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  const pair = battle?.pair ?? null;
  const signedIn = battle?.signedIn ?? false;
  const revealed = (phase === "reveal" || phase === "leave") && tally !== null && picked !== null;
  const busy = phase === "voting";

  let leftShare = 50;
  let rightShare = 50;
  if (revealed && tally && picked) {
    const [mine, theirs] = splitPercent(tally.winnerVotes, tally.loserVotes);
    leftShare = picked === "left" ? mine : theirs;
    rightShare = 100 - leftShare;
  }
  const leftGrow = Math.min(100 - MIN_SHARE, Math.max(MIN_SHARE, leftShare));

  return (
    <section aria-label="The arena">
      <style>{ARENA_CSS}</style>

      {phase === "loading" ? (
        <div className="btl-arena btl-wait" aria-busy="true">
          <p className="display text-4xl text-muted">Pulling two off the rack</p>
        </div>
      ) : null}

      {phase === "failed" ? (
        <div className="empty-state" role="alert">
          <p className="font-display uppercase">{problem || "The battle did not load."}</p>
          <button type="button" className="chip chip-on mt-4" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {phase === "over" && battle ? <Over battle={battle} /> : null}

      {pair && phase !== "loading" && phase !== "failed" && phase !== "over" ? (
        <>
          <div
            className="btl-arena"
            data-phase={phase}
            style={{
              ["--btl-left" as string]: leftGrow,
              ["--btl-right" as string]: 100 - leftGrow,
            }}
          >
            <Side
              name="left"
              side={pair.left}
              share={leftShare}
              revealed={revealed}
              picked={picked === "left"}
              lost={leftShare < rightShare}
              busy={busy && picked === "left"}
              signedIn={signedIn}
              onPick={() => pick("left")}
            />
            <div className="btl-seam" aria-hidden="true">
              <span className="btl-vs display">VS</span>
            </div>
            <Side
              name="right"
              side={pair.right}
              share={rightShare}
              revealed={revealed}
              picked={picked === "right"}
              lost={rightShare < leftShare}
              busy={busy && picked === "right"}
              signedIn={signedIn}
              onPick={() => pick("right")}
            />
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {revealed && tally
              ? `${pair.left.title} ${leftShare} percent, ${pair.right.title} ${rightShare} percent. ${tally.total} ${tally.total === 1 ? "vote" : "votes"} so far. ${crowdLine(tally)}`
              : ""}
          </p>

          <div className="mt-4 flex min-h-12 flex-wrap items-center gap-3">
            {revealed && tally ? (
              <>
                <button key="next" type="button" className="btl-next" onClick={bringNext}>
                  Next pair
                  <span className="btl-fuse" aria-hidden="true" key={`${tally.winnerId}-fuse`} />
                </button>
                <button key="switch" type="button" className="chip" onClick={switchPick}>
                  Switch my pick
                </button>
                <p className="text-sm text-muted">
                  <span className="font-display text-fg uppercase">{crowdLine(tally)}</span>{" "}
                  {tally.total} {tally.total === 1 ? "vote" : "votes"} on this pair so far.
                </p>
              </>
            ) : signedIn ? (
              <>
                <button
                  key="skip"
                  type="button"
                  className="chip"
                  onClick={skip}
                  aria-disabled={phase !== "ready" || undefined}
                >
                  Skip this pair
                </button>
                <p className="text-sm text-muted">
                  {battle?.pairsLeft
                    ? `${battle.pairsLeft} ${battle.pairsLeft === 1 ? "pair" : "pairs"} left for you to judge. `
                    : ""}
                  The split shows after you pick.
                </p>
              </>
            ) : (
              <div className="btl-ask" key={asked} data-asked={asked > 0 ? "true" : undefined}>
                <p className="min-w-0 flex-1 basis-56 text-sm" role="status">
                  <span className="font-display uppercase">You are looking, not voting.</span>{" "}
                  <span className="text-muted">Sign in and your pick counts.</span>
                </p>
                <Link ref={signInRef} to="/login" className="chip chip-on">
                  Sign in
                </Link>
                <button
                  type="button"
                  className="chip"
                  onClick={skip}
                  aria-disabled={phase !== "ready" || undefined}
                >
                  Another pair
                </button>
              </div>
            )}
          </div>

          {problem ? (
            <p role="alert" className="mt-3 border-2 border-pipe bg-surface px-3 py-2 text-sm">
              {problem}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-4 border-t-2 border-line pt-2">
            <p className="eyebrow col-span-2 pt-2 text-subtle">See them on the rack</p>
            <PieceLinks side={pair.left} />
            <PieceLinks side={pair.right} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function Over({ battle }: { battle: NextBattle }) {
  if (battle.reason === "few") {
    return (
      <div className="empty-state">
        <p className="display text-4xl">Not enough to fight over</p>
        <p className="mt-3 max-w-md text-muted">
          A battle needs two pieces on the rack. Publish one from the studio and it steps in.
        </p>
        <Link to="/studio" className="chip chip-on mt-4">
          Open the studio
        </Link>
      </div>
    );
  }
  if (battle.reason === "own") {
    return (
      <div className="empty-state">
        <p className="display text-4xl">Nothing here you can judge</p>
        <p className="mt-3 max-w-md text-muted">
          You cannot vote on your own pieces, and there are not two from other makers yet. Come back
          when the rack grows.
        </p>
        <Link to="/rack" className="chip mt-4">
          See the rack
        </Link>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <p className="display text-4xl">Every pair judged</p>
      <p className="mt-3 max-w-md text-muted">
        You have judged every pair. Come back when the rack grows.
      </p>
      <Link to="/rack" className="chip mt-4">
        See the rack
      </Link>
    </div>
  );
}
