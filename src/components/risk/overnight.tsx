import { Check, Moon, Play, Pause } from "lucide-react";
import { MEDIUM_LABELS } from "@/lib/risk/types";
import { useRiskStore } from "@/lib/risk/store";

export function OvernightPanel() {
  const queue = useRiskStore((s) => s.overnightQueue);
  const queueOvernight = useRiskStore((s) => s.queueOvernight);
  const setOvernightStatus = useRiskStore((s) => s.setOvernightStatus);
  const brief = useRiskStore((s) => s.brief);
  const setPhase = useRiskStore((s) => s.setPhase);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h2 className="font-display text-3xl tracking-tight text-fg sm:text-4xl">Overnight queue</h2>
        <p className="mt-2 text-muted">
          Stash a brief for unattended runs. Boldness target travels with the job.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-line bg-surface/80 p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-subtle">Current brief</p>
        <p className="mt-2 font-display text-lg text-fg">
          {MEDIUM_LABELS[brief.medium]} · {brief.boldnessTarget}% target
        </p>
        <p className="mt-1 text-sm text-muted">{brief.goal || "No goal yet — add one in Brief."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => queueOvernight()}
            data-testid="stash-overnight"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-stretch px-4 font-display text-sm text-bg"
          >
            <Moon className="size-3.5" aria-hidden />
            Stash this session
          </button>
          <button
            type="button"
            onClick={() => setPhase("brief")}
            className="inline-flex h-11 items-center rounded-md px-3 text-sm text-muted ring-1 ring-line"
          >
            Edit brief
          </button>
        </div>
      </div>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          No overnight jobs yet. Stash a session when you leave the desk.
        </p>
      ) : (
        <ul className="space-y-3">
          {queue.map((job) => (
            <li
              key={job.id}
              className="rounded-lg border border-line bg-bg/50 p-4"
              data-testid="overnight-job"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-subtle">
                    {job.status} · {MEDIUM_LABELS[job.brief.medium]}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-fg">
                    {job.brief.goal || "Untitled overnight"}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{job.notes}</p>
                </div>
                <span className="font-mono text-xs text-stretch">
                  {job.brief.boldnessTarget}%
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.status === "queued" || job.status === "paused" ? (
                  <button
                    type="button"
                    onClick={() => setOvernightStatus(job.id, "running")}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-elevated px-3 text-xs text-fg ring-1 ring-line"
                  >
                    <Play className="size-3" aria-hidden /> Mark running
                  </button>
                ) : null}
                {job.status === "running" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOvernightStatus(job.id, "paused")}
                      className="inline-flex h-9 items-center gap-1 rounded-md bg-elevated px-3 text-xs text-fg ring-1 ring-line"
                    >
                      <Pause className="size-3" aria-hidden /> Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => setOvernightStatus(job.id, "done")}
                      className="inline-flex h-9 items-center gap-1 rounded-md bg-stretch/20 px-3 text-xs text-stretch ring-1 ring-stretch/40"
                    >
                      <Check className="size-3" aria-hidden /> Complete
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
