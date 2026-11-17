import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Crown } from "@/components/site/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { toggleCrown } from "@/lib/social/api";

const STYLE = `
.crb { position: relative; transition: background 160ms ease, transform 160ms ease; }
.crb:active { transform: scale(0.96); }
.crb-mark { transform-origin: 50% 90%; }
.crb[data-fresh="true"] .crb-mark { animation: crb-drop 620ms cubic-bezier(0.2, 1.4, 0.36, 1); }
.crb[data-fresh="true"] { animation: crb-stamp 620ms cubic-bezier(0.22, 1, 0.36, 1); }
.crb-spark { position: absolute; left: 50%; top: 50%; width: 3px; height: 10px; background: var(--color-pipe); opacity: 0; pointer-events: none; }
.crb[data-fresh="true"] .crb-spark { animation: crb-spark 560ms ease-out; }
@keyframes crb-drop {
  0% { transform: translateY(-22px) rotate(-28deg) scale(1.5); }
  55% { transform: translateY(2px) rotate(9deg) scale(0.92); }
  78% { transform: translateY(-2px) rotate(-4deg) scale(1.04); }
  100% { transform: none; }
}
@keyframes crb-stamp {
  0% { box-shadow: 0 0 0 0 var(--color-pipe); }
  45% { box-shadow: 5px 5px 0 0 var(--color-pipe); }
  100% { box-shadow: 0 0 0 0 var(--color-pipe); }
}
@keyframes crb-spark {
  0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--crb-turn)) translateY(-10px) scaleY(0.4); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--crb-turn)) translateY(-30px) scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .crb, .crb-mark, .crb-spark { animation: none !important; transition: none; }
}
`;

/** Tap to crown a piece, tap again to take it back. Shows the change at once and undoes it if the save fails. */
export function CrownButton({
  designId,
  crowns,
  crowned,
  size = "sm",
  className,
  onChange,
}: {
  designId: string;
  crowns: number;
  crowned: boolean;
  size?: "sm" | "md";
  className?: string;
  onChange?: (next: { crowned: boolean; crowns: number }) => void;
}) {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState({ crowned, crowns });
  const [fresh, setFresh] = useState(false);
  const [problem, setProblem] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    setState({ crowned, crowns });
  }, [crowned, crowns, designId]);

  async function tap() {
    if (busy.current || isPending) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    const before = state;
    const want = !before.crowned;
    const next = { crowned: want, crowns: Math.max(0, before.crowns + (want ? 1 : -1)) };
    busy.current = true;
    setProblem("");
    setState(next);
    setFresh(want);
    try {
      const saved = await toggleCrown({ data: { designId, want } });
      setState(saved);
      onChange?.(saved);
    } catch (reason: unknown) {
      setState(before);
      setFresh(false);
      if (reason instanceof Error && reason.message === "Unauthorized") {
        void navigate({ to: "/login" });
      } else {
        setProblem("The crown did not save. Try again.");
      }
    } finally {
      busy.current = false;
    }
  }

  const label = state.crowned
    ? `Take your crown back. ${state.crowns} ${state.crowns === 1 ? "crown" : "crowns"}`
    : `Crown this piece. ${state.crowns} ${state.crowns === 1 ? "crown" : "crowns"}`;

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      {/* One copy in the page however many crowns are on it. */}
      <style href="sr-crown-button" precedence="default">
        {STYLE}
      </style>
      <button
        type="button"
        aria-pressed={state.crowned}
        aria-label={label}
        data-fresh={fresh}
        onClick={() => void tap()}
        onAnimationEnd={(event) => {
          if (event.animationName === "crb-stamp") setFresh(false);
        }}
        className={cn(
          "crb inline-flex items-center justify-center gap-2 border-2 border-ink font-display tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg",
          size === "md" ? "min-h-12 min-w-24 px-4 text-lg" : "min-h-11 min-w-16 px-2.5 text-sm",
          state.crowned ? "bg-accent text-accent-fg" : "bg-surface text-fg hover:bg-cream",
        )}
      >
        <Crown className={cn("crb-mark", size === "md" ? "h-5 w-7" : "h-4 w-5")} />
        <span>{state.crowns}</span>
        {size === "md" ? (
          <span className="text-xs tracking-wide uppercase">
            {state.crowned ? "Crowned" : "Crown it"}
          </span>
        ) : null}
        {[-50, -16, 16, 50].map((turn) => (
          <span
            key={turn}
            className="crb-spark"
            style={{ ["--crb-turn" as string]: `${turn}deg` }}
          />
        ))}
      </button>
      <span
        role="status"
        className={
          problem ? "max-w-44 border-2 border-ink bg-surface px-2 py-1 text-xs text-fg" : "sr-only"
        }
      >
        {problem}
      </span>
    </span>
  );
}
