import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/shell";
import { getStudioConfig } from "@/lib/studio/api";

/**
 * The studio pages share the site's one menu. In sandbox a single line says so,
 * because nothing bought there is printed or charged.
 */
export function StudioShell({ children }: { current?: string; children: ReactNode }) {
  const [mode, setMode] = useState<"sandbox" | "live" | "">("");

  useEffect(() => {
    void getStudioConfig()
      .then((config) => setMode(config.podMode))
      .catch(() => setMode(""));
  }, []);

  return (
    <div className="night flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#studio-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to the work
      </a>
      <SiteHeader />
      <main
        id="studio-main"
        className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-clip px-4 py-6"
      >
        {mode === "sandbox" ? (
          <p className="mb-4 flex items-center gap-3 text-xs text-subtle">
            <span className="tag shrink-0">Sandbox</span>
            <span>Test mode. Orders here are not charged or printed.</span>
          </p>
        ) : null}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="studio-card border-2 border-ink bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-sm tracking-wide uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border-2 border-pipe bg-surface px-3 py-2 text-sm text-fg">
      {children}
    </p>
  );
}
