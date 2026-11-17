import { Moon, Radio, RotateCcw, Rows3, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SessionPhase } from "@/lib/risk/types";
import { useRiskStore } from "@/lib/risk/store";

const NAV: { id: SessionPhase; label: string; icon: typeof Sparkles }[] = [
  { id: "brief", label: "Brief", icon: Sparkles },
  { id: "roster", label: "Agents", icon: Radio },
  { id: "board", label: "Board", icon: Rows3 },
  { id: "overnight", label: "Overnight", icon: Moon },
];

export function DeskNav({ className }: { className?: string }) {
  const phase = useRiskStore((s) => s.phase);
  const setPhase = useRiskStore((s) => s.setPhase);
  const resetSession = useRiskStore((s) => s.resetSession);
  const lastAction = useRiskStore((s) => s.lastAction);

  if (phase === "landing") return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setPhase("landing")}
          className="group flex min-w-0 items-center gap-2 text-left"
        >
          <span className="font-display text-lg tracking-tight text-fg sm:text-xl">
            RISK<span className="text-accent">DESK</span>
          </span>
          <span className="hidden truncate text-xs text-muted sm:inline">AI Colab</span>
        </button>

        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = phase === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPhase(id)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-surface text-fg ring-1 ring-line"
                    : "text-muted hover:bg-surface/70 hover:text-fg",
                )}
              >
                <Icon className="size-3.5 opacity-80" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => resetSession()}
            className="ml-1 inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            aria-label="Reset session"
            title="Reset session"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </nav>
      </div>
      {lastAction ? (
        <div className="border-t border-line/50 bg-surface/40 px-4 py-1.5 text-center text-xs text-muted sm:px-6">
          {lastAction}
        </div>
      ) : null}
    </header>
  );
}

export function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div className="atmosphere-wash absolute inset-0" />
      <div className="atmosphere-grain absolute inset-0 opacity-[0.35]" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-drift" />
      <div className="absolute -right-16 bottom-20 h-80 w-80 rounded-full bg-stretch/10 blur-3xl animate-drift-delayed" />
    </div>
  );
}
