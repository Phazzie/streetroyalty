import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BagDrawer } from "@/components/site/bag-drawer";
import { SiteFooter, SiteHeader } from "@/components/site/shell";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { getStudioConfig } from "@/lib/studio/api";

const LINKS = [
  { to: "/studio", label: "Studio", tone: "chip-pink" },
  { to: "/gallery", label: "Gallery", tone: "chip-violet" },
  { to: "/rack", label: "Rack", tone: "chip-orange" },
  { to: "/cart", label: "Cart", tone: "chip-blue" },
  { to: "/orders", label: "Orders", tone: "" },
] as const;

export function StudioShell({ current, children }: { current: string; children: ReactNode }) {
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
      <div className="border-b-2 border-pipe bg-bg">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="tag">{mode === "live" ? "Live print" : "Sandbox"}</span>
          <nav className="flex flex-wrap gap-2" aria-label="Studio">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={current === link.to ? "page" : undefined}
                className={`chip ${current === link.to ? "" : link.tone}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <UserButton />
            <SignedOut>
              <Link to="/login" className="chip chip-on">
                Sign in
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
      <main
        id="studio-main"
        className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-clip px-4 py-6"
      >
        {children}
      </main>
      <SiteFooter />
      <BagDrawer />
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
