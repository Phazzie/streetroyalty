import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const SCENES = [
  {
    src: "/wild/scene-beam.mp4",
    poster: "/wild/scene-beam.jpg",
    label: "House model on the beam, coffee in hand, unfazed",
  },
  {
    src: "/wild/scene-moon.mp4",
    poster: "/wild/scene-moon.jpg",
    label: "House model on the moon, coffee in hand, unfazed",
  },
  {
    src: "/wild/scene-boat.mp4",
    poster: "/wild/scene-boat.jpg",
    label: "House model in the boat, coffee in hand, unfazed",
  },
  {
    src: "/wild/scene-flyer.mp4",
    poster: "/wild/scene-flyer.jpg",
    label: "House model at the flyer, hands in pockets, unfazed",
  },
] as const;

const STEPS = [copy.stepFace, copy.stepPieces, copy.stepWalk];

function Clip({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    video.muted = true;
    if (reduce) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      playsInline
      autoPlay
      loop
      preload="metadata"
      aria-label={label}
    />
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mess-field flex min-h-dvh justify-center">
      <div className="phone-frame safe-top relative flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream text-fg">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export function Header({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-cream px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight text-ink">{title}</h1>
        <nav className="flex gap-3 text-sm font-bold">
          <Link to="/studio" className="text-accent">
            Studio
          </Link>
          <Link to="/shop" className="text-ink">
            Shop
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
          {SCENES.map((scene) => (
            <Clip key={scene.src} {...scene} className="h-36 w-full object-cover object-top sm:h-44" />
          ))}
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
          <Link to="/studio" className="chip chip-on mb-2 w-full">
            Design studio
          </Link>
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
