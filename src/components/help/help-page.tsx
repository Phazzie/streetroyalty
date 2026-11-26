import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/shell";
import { cn } from "@/lib/cn";

/** Every help page, in the order the side list shows them. */
export const HELP_PAGES = [
  { to: "/shipping", label: "Shipping" },
  { to: "/returns", label: "Returns" },
  { to: "/sizes", label: "Size guide" },
  { to: "/contact", label: "Contact" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

export type HelpPath = (typeof HELP_PAGES)[number]["to"];

const HELP_CSS = `
.fine-sheet{position:relative;border:2px solid var(--color-ink);background:var(--color-surface);
  box-shadow:8px 8px 0 var(--color-ink)}
.fine-sheet::before,.fine-sheet::after{content:"";position:absolute;left:-2px;right:-2px;height:10px;
  background:radial-gradient(circle at 5px 0,var(--color-bg) 4px,transparent 4.5px) 0 0/10px 10px repeat-x}
.fine-sheet::before{top:-2px}
.fine-sheet::after{bottom:-2px;transform:scaleY(-1)}
.fine-rule{border-top:2px dashed var(--color-line)}
.fine-no{font-family:var(--font-display);font-size:0.72rem;letter-spacing:0.14em}
.fine-doc h2{font-family:var(--font-display);text-transform:uppercase;font-size:1.05rem;letter-spacing:0.04em}
.fine-doc p,.fine-doc li{font-size:1rem;line-height:1.6;max-width:62ch}
.fine-doc ul{list-style:none;padding:0;display:grid;gap:0.5rem}
.fine-doc li{padding-left:1.4rem;position:relative}
.fine-doc li::before{content:"";position:absolute;left:0;top:0.62em;width:0.62rem;height:0.62rem;
  background:var(--color-pipe);transform:rotate(45deg)}
.fine-doc a{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
`;

/**
 * The fine print, as one sheet torn off a receipt roll: a big plain-words title,
 * then numbered sections. The side list links every other help page.
 */
export function HelpPage({
  current,
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  current: HelpPath;
  eyebrow: string;
  title: string;
  lede: ReactNode;
  /** When the words last changed, as YYYY-MM-DD. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <SiteShell theme="paper">
      <style>{HELP_CSS}</style>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[13rem_1fr] md:py-16">
        <nav aria-label="Help" className="md:sticky md:top-24 md:self-start">
          <p className="eyebrow text-subtle">Help</p>
          <ul className="mt-3 flex flex-wrap gap-2 md:flex-col md:gap-1">
            {HELP_PAGES.map((page) => (
              <li key={page.to}>
                <Link
                  to={page.to}
                  aria-current={page.to === current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center border-2 px-3 font-display text-xs tracking-widest uppercase md:w-full md:border-0 md:border-l-4 md:px-3",
                    page.to === current
                      ? "border-ink bg-ink text-bg md:border-pipe md:bg-transparent md:text-fg"
                      : "border-line text-fg hover:border-ink md:border-transparent",
                  )}
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0">
          <p className="eyebrow text-subtle">{eyebrow}</p>
          <h1 className="display mt-3 text-6xl leading-[0.88] sm:text-7xl">{title}</h1>
          <div className="mt-5 max-w-2xl text-lg text-muted">{lede}</div>
          <div className="fine-sheet fine-doc mt-10 px-5 py-9 sm:px-9">
            {children}
            {updated ? (
              <p className="fine-rule mt-8 pt-4 text-sm text-subtle">Last changed {updated}.</p>
            ) : null}
          </div>
        </article>
      </div>
    </SiteShell>
  );
}

/** One numbered section of the fine print. */
export function FineSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className={cn("grid gap-3", n > 1 && "fine-rule mt-7 pt-7")}>
      <p className="fine-no text-subtle">{String(n).padStart(2, "0")}</p>
      <h2>{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
