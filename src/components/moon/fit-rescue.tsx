import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FIT_PROBLEMS, rescueFor } from "@/lib/moon/fitting";

/**
 * Fit Rescue — the PSA parody as a product flow. Name what is wrong with
 * the fit; the lab re-cuts it. Deadpan on purpose.
 */
export function FitRescue() {
  const [problemId, setProblemId] = useState(FIT_PROBLEMS[0]!.id);
  const rescue = rescueFor(problemId);
  return (
    <section aria-label="Fit rescue" className="mx-auto max-w-6xl px-4 py-10">
      <p className="tag">A public service announcement</p>
      <h2 className="mt-3 font-display text-4xl leading-none uppercase">Fit Rescue</h2>
      <p className="mt-2 max-w-xl text-muted">
        Every day, good people walk out in bad fits. This is the intervention — pick the problem,
        get the re-cut.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {FIT_PROBLEMS.map((problem) => (
          <button
            key={problem.id}
            type="button"
            aria-pressed={problemId === problem.id}
            onClick={() => setProblemId(problem.id)}
            className={`chip ${problemId === problem.id ? "chip-on" : ""}`}
          >
            {problem.label}
          </button>
        ))}
      </div>
      <div className="mt-4 border-2 border-pipe bg-surface p-4">
        <p className="font-display text-xl leading-tight">“{rescue.psa}”</p>
        <p className="mt-2 max-w-2xl text-muted">{rescue.fix}</p>
        <Link to="/studio" className="chip chip-on mt-3">
          Re-cut it on a {rescue.targetType}
        </Link>
      </div>
    </section>
  );
}
