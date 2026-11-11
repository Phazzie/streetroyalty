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
    video.muted = true;
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
      preload="auto"
      aria-label={label}
    />
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mess-field flex min-h-dvh justify-center">
      <div className="phone-frame relative flex h-dvh w-full max-w-md flex-col overflow-hidden bg-cream text-fg">
        <div className="edge-gutter relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <Marquee />
          <LabLinks />
          {children}
        </div>
        <Edges />
      </div>
    </div>
  );
}

function Edges() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      <Clip {...SCENES[0]} className="edge-clip edge-still-left" />
      <Clip {...SCENES[1]} className="edge-clip edge-still-right" />
    </div>
  );
}

function LabLinks() {
  return (
    <div className="flex gap-2 border-b border-line bg-bg px-3 py-2">
      <Link to="/studio" className="chip chip-on">
        Studio
      </Link>
      <Link to="/shop" className="chip">
        Shop
      </Link>
    </div>
  );
}

function Marquee() {
  const line = "Street royalty  ·  Print the piece  ·  Crown stays on  ·  ";
  return (
    <div className="mash-bar edge-b overflow-hidden text-cream">
      <div className="marquee-track py-1.5 font-display text-xs font-bold tracking-widest uppercase">
        <span className="px-3">{line}</span>
        <span className="px-3" aria-hidden="true">
          {line}
        </span>
      </div>
    </div>
  );
}

export function Header({ action }: { action?: ReactNode }) {
  return (
    <header className="banner-head safe-top flex flex-col gap-2 px-4 pb-3">
      <div>
        <p className="font-display text-xs font-bold tracking-widest text-ink uppercase">{copy.lab}</p>
        <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-ink">{copy.title}</p>
      </div>
      {action ? <div className="flex flex-wrap gap-1">{action}</div> : null}
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
      className="h-11 rounded-full bg-cream px-3 text-sm font-bold text-ink transition-opacity duration-150 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </button>
  );
}

export function Splash({ onEnter }: { onEnter?: () => void }) {
  return (
    <main className="mess-field flex min-h-dvh items-center justify-center text-fg">
      <div className="phone-frame flex h-dvh w-full max-w-md flex-col overflow-hidden bg-cream">
        <div className="grid shrink-0 grid-cols-2">
          {SCENES.map((scene) => (
            <Clip key={scene.src} {...scene} className="h-44 w-full object-cover object-top" />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <p className="font-display text-3xl font-extrabold leading-none tracking-tight">{copy.title}</p>
          <p className="italic">{copy.splashLead}</p>
          <p>{copy.splashSteps}</p>
        </div>
        <div className="safe-bottom flex flex-col gap-2 border-t border-line px-5 pt-3">
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
    <p aria-live="polite" className="min-h-6 px-4 text-center text-base text-muted">
      {text}
    </p>
  );
}
