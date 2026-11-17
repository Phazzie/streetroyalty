import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { MEDIUM_LABELS, type Medium } from "@/lib/risk/types";
import { useRiskStore } from "@/lib/risk/store";

const MEDIUMS = Object.keys(MEDIUM_LABELS) as Medium[];

export function BriefPanel() {
  const brief = useRiskStore((s) => s.brief);
  const setMedium = useRiskStore((s) => s.setMedium);
  const patchBrief = useRiskStore((s) => s.patchBrief);
  const setBoldnessTarget = useRiskStore((s) => s.setBoldnessTarget);
  const setPhase = useRiskStore((s) => s.setPhase);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h2 className="font-display text-3xl tracking-tight text-fg sm:text-4xl">Session brief</h2>
        <p className="mt-2 text-muted">
          Medium, goal, constraints — then the council pitches past comfort.
        </p>
      </header>

      <div className="space-y-8">
        <fieldset>
          <legend className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Medium
          </legend>
          <div className="flex flex-wrap gap-2">
            {MEDIUMS.map((m) => {
              const active = brief.medium === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedium(m)}
                  className={cn(
                    "h-11 rounded-md px-3.5 text-sm transition-colors duration-200",
                    active
                      ? "bg-accent text-accent-fg"
                      : "bg-surface text-fg ring-1 ring-line hover:bg-elevated",
                  )}
                >
                  {MEDIUM_LABELS[m]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">Goal</span>
          <textarea
            value={brief.goal}
            onChange={(e) => patchBrief({ goal: e.target.value })}
            rows={3}
            placeholder="What artistic excellence are you hunting tonight?"
            className="w-full resize-y rounded-md border border-line bg-surface px-3 py-3 text-fg placeholder:text-subtle focus:border-stretch focus:outline-none"
            data-testid="brief-goal"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            Constraints <span className="normal-case tracking-normal text-muted">(optional)</span>
          </span>
          <textarea
            value={brief.constraints}
            onChange={(e) => patchBrief({ constraints: e.target.value })}
            rows={2}
            placeholder="Runtime, tone bans, instruments, stack limits…"
            className="w-full resize-y rounded-md border border-line bg-surface px-3 py-3 text-fg placeholder:text-subtle focus:border-stretch focus:outline-none"
          />
        </label>

        <label className="block space-y-3">
          <div className="flex items-end justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              Boldness target
            </span>
            <span className="font-mono text-sm text-stretch">{brief.boldnessTarget}% past comfort</span>
          </div>
          <input
            type="range"
            min={20}
            max={95}
            value={brief.boldnessTarget}
            onChange={(e) => setBoldnessTarget(Number(e.target.value))}
            className="risk-slider w-full"
            aria-label="Boldness target"
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPhase("roster")}
            data-testid="to-roster"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-fg px-5 font-display text-sm text-bg"
          >
            Connect agents
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPhase("board")}
            className="inline-flex h-12 items-center rounded-md px-4 text-sm text-muted ring-1 ring-line hover:text-fg"
          >
            Skip to board
          </button>
        </div>
      </div>
    </section>
  );
}
