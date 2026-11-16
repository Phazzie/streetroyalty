import { PIPELINE_STAGES, pipelineFor } from "@/lib/moon/drops";
import type { OrderSummary } from "@/lib/studio/models";

/**
 * Production is the tracking page. An order is never just "processing" —
 * it stands somewhere on this board, or it is honestly blocked.
 */
export function Pipeline({ order }: { order: OrderSummary }) {
  const state = pipelineFor(order);
  return (
    <div className="mt-3">
      <ol className="flex flex-wrap items-center gap-1" aria-label={`Production: ${state.label}`}>
        {PIPELINE_STAGES.map((stage, index) => {
          const done = index < state.stageIndex;
          const here = index === state.stageIndex;
          return (
            <li key={stage} className="flex items-center gap-1">
              <span
                className={`border-2 px-2 py-1 font-display text-[0.65rem] tracking-wide uppercase ${
                  state.blocked && here
                    ? "border-pipe bg-pipe text-[#14081c]"
                    : done
                      ? "border-lime bg-lime text-[#14081c]"
                      : here
                        ? "border-ink bg-accent text-accent-fg"
                        : "border-line text-subtle"
                }`}
              >
                {stage}
              </span>
              {index < PIPELINE_STAGES.length - 1 ? <span aria-hidden="true">→</span> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-sm text-muted">{state.label}</p>
    </div>
  );
}
