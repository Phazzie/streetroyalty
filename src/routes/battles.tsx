import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Arena } from "@/components/battles/arena";
import { Throne } from "@/components/battles/throne";
import { StudioShell } from "@/components/studio/shell";
import { throne } from "@/lib/social/battles-api";
import type { ThroneRow } from "@/lib/social/battles";

export const Route = createFileRoute("/battles")({ component: BattlesPage });

function BattlesPage() {
  const [rows, setRows] = useState<ThroneRow[] | null>(null);
  const [error, setError] = useState("");
  const latest = useRef(0);

  const loadThrone = useCallback(() => {
    const call = (latest.current += 1);
    void (throne() as Promise<ThroneRow[]>)
      .then((next) => {
        if (call !== latest.current) return;
        setRows(next);
        setError("");
      })
      .catch((reason: unknown) => {
        if (call !== latest.current) return;
        setError(reason instanceof Error ? reason.message : "The throne did not load.");
      });
  }, []);

  useEffect(() => {
    loadThrone();
  }, [loadThrone]);

  return (
    <StudioShell current="/battles">
      <p className="tag">Battles</p>
      <h1 className="mt-3 font-display text-4xl leading-none">Which one would you wear</h1>
      <p className="mt-2 mb-5 max-w-xl text-muted">
        Two pieces off the rack. Tap the one you would wear. Nobody sees the split until they have
        picked.
      </p>
      <Arena onVoted={loadThrone} />
      <Throne rows={rows} error={error} />
    </StudioShell>
  );
}
