import { Flame, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ROLE_LABELS,
  VERDICT_LABELS,
  type CritiqueVerdict,
  type Proposal,
} from "@/lib/risk/types";
import { useRiskStore } from "@/lib/risk/store";

const VERDICT_STYLE: Record<CritiqueVerdict, string> = {
  too_conservative: "bg-sand/15 text-sand ring-sand/30",
  true_stretch: "bg-stretch/15 text-stretch ring-stretch/35",
  cheap_bait: "bg-bait/15 text-bait ring-bait/35",
};

function RiskDial({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2" title="% past model comfort">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-elevated ring-1 ring-line">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            value >= 65 ? "bg-stretch" : value < 40 ? "bg-sand" : "bg-accent",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono text-xs text-fg">{value}%</span>
    </div>
  );
}

function ProposalCard({
  proposal,
  agentName,
  agentRole,
}: {
  proposal: Proposal;
  agentName: string;
  agentRole: string;
}) {
  return (
    <article className="animate-card flex flex-col rounded-lg border border-line bg-surface/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-subtle">
            {agentRole} · {agentName} · r{proposal.round}
          </p>
          <h3 className="mt-1 font-display text-xl leading-snug text-fg">{proposal.title}</h3>
        </div>
        <RiskDial value={proposal.riskPastComfort} />
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{proposal.body}</p>

      {proposal.critiques.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-line/80 pt-4">
          {proposal.critiques.map((c) => (
            <li key={c.id} className="rounded-md bg-bg/60 p-3 ring-1 ring-line/60">
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-[0.7rem] font-medium ring-1",
                  VERDICT_STYLE[c.verdict],
                )}
              >
                {VERDICT_LABELS[c.verdict]}
              </span>
              <p className="mt-2 text-sm text-fg/90">{c.comment}</p>
              {c.rewrite ? (
                <p className="mt-2 border-l-2 border-accent/70 pl-3 text-sm text-muted">
                  <span className="font-medium text-accent">Push harder · </span>
                  {c.rewrite}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function BoardPanel() {
  const proposals = useRiskStore((s) => s.proposals);
  const agents = useRiskStore((s) => s.agents);
  const overdrive = useRiskStore((s) => s.overdrive);
  const setOverdrive = useRiskStore((s) => s.setOverdrive);
  const runPropose = useRiskStore((s) => s.runPropose);
  const runPushHarder = useRiskStore((s) => s.runPushHarder);
  const rerunWithOverdrive = useRiskStore((s) => s.rerunWithOverdrive);
  const queueOvernight = useRiskStore((s) => s.queueOvernight);
  const setPhase = useRiskStore((s) => s.setPhase);
  const councilBusy = useRiskStore((s) => s.councilBusy);
  const round = useRiskStore((s) => s.round);
  const brief = useRiskStore((s) => s.brief);

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-tight text-fg sm:text-4xl">Proposal board</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Round {round || "—"} · {brief.goal || "Set a goal in Brief"} · peer review tags
            conservative / stretch / bait
          </p>
        </div>

        <div className="w-full max-w-sm rounded-lg border border-line bg-surface/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-subtle">
              <Flame className="size-3.5 text-accent" aria-hidden />
              Overdrive
            </span>
            <span className="font-mono text-sm text-accent">{overdrive}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={overdrive}
            onChange={(e) => setOverdrive(Number(e.target.value))}
            className="risk-slider mt-3 w-full"
            aria-label="Overdrive ambition"
            data-testid="overdrive-slider"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={councilBusy}
              onClick={() => rerunWithOverdrive()}
              data-testid="crank-overdrive"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-display text-accent-fg disabled:opacity-40"
            >
              <Zap className="size-3.5" aria-hidden />
              Crank & re-run
            </button>
            <button
              type="button"
              disabled={councilBusy || proposals.length === 0}
              onClick={() => runPushHarder()}
              data-testid="push-harder"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-fg px-3 text-xs font-display text-bg disabled:opacity-40"
            >
              Push harder
            </button>
          </div>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={councilBusy}
          onClick={() => runPropose()}
          data-testid="propose-again"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-elevated px-3 text-sm text-fg ring-1 ring-line disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3.5", councilBusy && "animate-spin")} aria-hidden />
          {proposals.length ? "Fresh proposals" : "Propose"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("roster")}
          className="inline-flex h-10 items-center rounded-md px-3 text-sm text-muted ring-1 ring-line"
        >
          Agents
        </button>
        <button
          type="button"
          onClick={() => queueOvernight()}
          data-testid="queue-overnight"
          className="inline-flex h-10 items-center rounded-md px-3 text-sm text-stretch ring-1 ring-stretch/40"
        >
          Stash overnight
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
          <p className="font-display text-2xl text-fg">Empty board</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Run the council from Agents — pitches land here with risk dials and peer verdicts.
          </p>
          <button
            type="button"
            onClick={() => runPropose()}
            disabled={councilBusy}
            className="mt-6 inline-flex h-11 items-center rounded-md bg-accent px-4 font-display text-sm text-accent-fg"
          >
            Run first proposal round
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {proposals.map((p) => {
            const agent = agentMap[p.agentId];
            return (
              <ProposalCard
                key={p.id}
                proposal={p}
                agentName={agent?.name ?? "Agent"}
                agentRole={agent ? ROLE_LABELS[agent.role] : "Role"}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
