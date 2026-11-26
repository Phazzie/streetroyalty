import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { garmentFlatSvg } from "@/lib/gfx/garments";
import { houseBlank } from "@/lib/pod/house-blanks";

/** Four of the real blanks, in colours Printful really stocks, so the first screen shows only pieces you can order. */
const OPENERS = [
  { id: "hoodie-pullover", color: "lavender" },
  { id: "jogger-court", color: "black" },
  { id: "tee-heavy", color: "ivory" },
  { id: "crew-sweat", color: "vintage-black" },
] as const;

const STEPS = [copy.stepFace, copy.stepPieces, copy.stepWalk];

function openerArt({ id, color }: (typeof OPENERS)[number]) {
  const blank = houseBlank(id);
  const pick = blank?.colors.find((item) => item.code === color) ?? blank?.colors[0];
  return {
    key: id,
    alt: `${blank?.name ?? "Blank"} in ${pick?.name ?? "black"}`,
    src: garmentFlatSvg(blank?.shape ?? "hoodie", pick?.hex ?? "#111111"),
  };
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mess-field flex min-h-dvh justify-center">
      <div className="phone-frame safe-top relative flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream text-fg">
        <a
          href="#lab-main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
        >
          Skip to the work
        </a>
        <main id="lab-main" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

export function Header({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-cream px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight text-ink">{title}</h1>
        <nav className="flex items-center gap-3 text-sm font-bold" aria-label="Site">
          <Link to="/" aria-label="Home" className="grid h-8 w-8 place-items-center text-accent">
            <svg viewBox="0 0 32 22" className="h-4 w-auto" aria-hidden="true" fill="currentColor">
              <path d="M2 18.5 5.4 5.2l5.2 6.3L16 1l5.4 10.5 5.2-6.3L30 18.5Z" />
              <rect x="2" y="19.6" width="28" height="2.4" rx="0.5" />
            </svg>
          </Link>
          <Link to="/studio" className="text-accent">
            Studio
          </Link>
          <Link to="/rack" className="text-ink">
            Rack
          </Link>
        </nav>
      </div>
      {action ? <div className="flex flex-wrap justify-end gap-2">{action}</div> : null}
    </header>
  );
}

export function TextButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-full border-2 border-ink bg-cream px-4 text-sm font-bold text-ink transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
    >
      {children}
    </button>
  );
}

export function Splash({ onEnter }: { onEnter?: () => void }) {
  return (
    <main className="mess-field flex min-h-dvh items-center justify-center text-fg">
      <div className="phone-frame safe-top flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream">
        <div className="grid shrink-0 grid-cols-2">
          {OPENERS.map((opener) => {
            const art = openerArt(opener);
            return (
              <img
                key={art.key}
                src={art.src}
                alt={art.alt}
                className="h-36 w-full bg-[#1b1426] object-contain sm:h-44"
              />
            );
          })}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 *:shrink-0">
          <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight">{copy.title}</h1>
          <p className="text-lg italic">{copy.splashLead}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <div className="safe-bottom flex shrink-0 flex-col gap-2 border-t border-line px-5 pt-3">
          {onEnter ? (
            <Button className="w-full" size="lg" onClick={onEnter}>
              {copy.openIt}
            </Button>
          ) : (
            <p className="pb-3 text-sm text-muted">{copy.lab}</p>
          )}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Link to="/" className="chip w-full">
              Home
            </Link>
            <Link to="/studio" className="chip chip-on w-full">
              Design studio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export function Status({ text }: { text: string }) {
  return (
    <p aria-live="polite" className="text-sm text-muted">
      {text}
    </p>
  );
}
