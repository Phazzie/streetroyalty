import { Link2, Unplug } from "lucide-react";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, type ConnectorKind } from "@/lib/risk/types";
import { useRiskStore } from "@/lib/risk/store";

const COLOR: Record<string, string> = {
  ember: "bg-accent/20 text-accent",
  teal: "bg-stretch/20 text-stretch",
  sand: "bg-sand/20 text-sand",
  steel: "bg-steel/25 text-steel",
  rose: "bg-bait/20 text-bait",
};

export function RosterPanel() {
  const agents = useRiskStore((s) => s.agents);
  const toggleAgent = useRiskStore((s) => s.toggleAgent);
  const setConnector = useRiskStore((s) => s.setConnector);
  const runPropose = useRiskStore((s) => s.runPropose);
  const setPhase = useRiskStore((s) => s.setPhase);
  const councilBusy = useRiskStore((s) => s.councilBusy);
  const connected = agents.filter((a) => a.connected).length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-tight text-fg sm:text-4xl">Agent roster</h2>
          <p className="mt-2 max-w-xl text-muted">
            Mock personas run locally. Switch a connector to paste-in or webhook for real agents later.
          </p>
        </div>
        <p className="font-mono text-sm text-stretch">{connected} connected</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <li
            key={agent.id}
            className={cn(
              "rounded-lg border border-line bg-surface/80 p-4 transition-opacity duration-200",
              !agent.connected && "opacity-55",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={cn(
                    "inline-flex rounded px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider",
                    COLOR[agent.color],
                  )}
                >
                  {ROLE_LABELS[agent.role]}
                </span>
                <h3 className="mt-2 font-display text-xl text-fg">{agent.name}</h3>
                <p className="mt-1 text-sm text-muted">{agent.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
                  agent.connected
                    ? "bg-stretch/15 text-stretch ring-1 ring-stretch/40"
                    : "bg-elevated text-muted ring-1 ring-line",
                )}
                aria-pressed={agent.connected}
              >
                {agent.connected ? <Link2 className="size-3.5" /> : <Unplug className="size-3.5" />}
                {agent.connected ? "On" : "Off"}
              </button>
            </div>

            <p className="mt-3 line-clamp-2 text-xs text-subtle">{agent.personaPrompt}</p>

            <div className="mt-4 space-y-2 border-t border-line/70 pt-3">
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                Connector
                <select
                  value={agent.connector.kind}
                  onChange={(e) =>
                    setConnector(agent.id, {
                      ...agent.connector,
                      kind: e.target.value as ConnectorKind,
                    })
                  }
                  className="h-10 rounded-md border border-line bg-bg px-2 text-sm text-fg"
                >
                  <option value="mock">Mock (local persona)</option>
                  <option value="paste">Paste-in reply</option>
                  <option value="webhook">Webhook URL</option>
                </select>
              </label>
              {agent.connector.kind === "webhook" ? (
                <input
                  type="url"
                  placeholder="https://…"
                  value={agent.connector.webhookUrl ?? ""}
                  onChange={(e) =>
                    setConnector(agent.id, {
                      ...agent.connector,
                      webhookUrl: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded-md border border-line bg-bg px-2 text-sm text-fg"
                />
              ) : null}
              {agent.connector.kind === "paste" ? (
                <textarea
                  rows={2}
                  placeholder="Paste agent reply for next round…"
                  value={agent.connector.lastPasteReply ?? ""}
                  onChange={(e) =>
                    setConnector(agent.id, {
                      ...agent.connector,
                      lastPasteReply: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-line bg-bg px-2 py-2 text-sm text-fg"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={councilBusy || connected < 2}
          onClick={() => runPropose()}
          data-testid="run-council"
          className="inline-flex h-12 items-center rounded-md bg-accent px-5 font-display text-sm text-accent-fg disabled:opacity-40"
        >
          {councilBusy ? "Council running…" : "Run council — propose"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("brief")}
          className="inline-flex h-12 items-center rounded-md px-4 text-sm text-muted ring-1 ring-line"
        >
          Edit brief
        </button>
      </div>
    </section>
  );
}
