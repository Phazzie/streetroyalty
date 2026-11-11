import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { getStudioConfig } from "@/lib/studio/api";

const LINKS = [
  { to: "/", label: "Lab" },
  { to: "/studio", label: "Studio" },
  { to: "/gallery", label: "Gallery" },
  { to: "/shop", label: "Shop" },
  { to: "/cart", label: "Cart" },
  { to: "/orders", label: "Orders" },
] as const;

export function StudioShell({ current, children }: { current: string; children: ReactNode }) {
  const [mode, setMode] = useState<"sandbox" | "live" | "">("");

  useEffect(() => {
    void getStudioConfig()
      .then((config) => setMode(config.podMode))
      .catch(() => setMode(""));
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b-2 border-pipe bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-xl leading-none tracking-tight text-fg">
            STREET ROYALTY
          </Link>
          <span className="tag">{mode === "live" ? "Live print" : "Sandbox"}</span>
          <nav className="flex flex-wrap gap-2" aria-label="Studio">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={current === link.to ? "page" : undefined}
                className="chip"
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
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 py-6">{children}</main>
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
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
