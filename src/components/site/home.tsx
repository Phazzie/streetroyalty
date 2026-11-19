import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { SiteShell } from "@/components/site/shell";
import type { StoreCatalog } from "@/lib/storefront/types";

const TAPE = [
  "Two sets",
  "Lilac and mint",
  "Made to order",
  "Try it on your own face",
  "Design your own piece",
];

const LAB_STEPS = [
  {
    n: "01",
    title: "Lock your face",
    body: "Three photos: front, side, three-quarter. They stay on your phone.",
  },
  {
    n: "02",
    title: "Name the pieces",
    body: "Say it or type it. A hoodie, cargo trousers, a long coat. The lab builds each one.",
  },
  {
    n: "03",
    title: "Walk it",
    body: "Put the pieces on you, then send the look down the runway. The crowd cheers or boos.",
  },
];

const PROCESS = [
  {
    image: "/brand/detail-sketch.webp",
    alt: "Sketchbook with hoodie and jogger drawings beside lilac, mint, cream and orange fabric swatches",
    title: "Blocked",
    body: "Each set is one colour held by two others. Lilac with cream and orange. Mint with peach and blue.",
  },
  {
    image: "/brand/detail-piping.webp",
    alt: "Close view of orange piping being stitched between lilac fleece and a cream panel",
    title: "Piped",
    body: "A thin line of piping traces every panel, so the block reads from across the street.",
  },
  {
    image: "/brand/detail-label.webp",
    alt: "Black woven neck label with a cream crown inside a mint hoodie",
    title: "Crowned",
    body: "No logo on the chest. The crown sits on the neck label, where only you see it.",
  },
];

const SCENES = [
  {
    src: "/wild/scene-moon.mp4",
    poster: "/wild/scene-moon.jpg",
    label: "The Mint Set on the moon",
  },
  {
    src: "/wild/scene-boat.mp4",
    poster: "/wild/scene-boat.jpg",
    label: "The Lilac Set in the boat",
  },
  {
    src: "/wild/scene-beam.mp4",
    poster: "/wild/scene-beam.jpg",
    label: "The Lilac Set on the beam",
  },
  {
    src: "/wild/scene-flyer.mp4",
    poster: "/wild/scene-flyer.jpg",
    label: "The Lilac Set at the flyer",
  },
];

/** A muted loop that only plays while it is on screen, and not at all when motion is reduced. */
function LoopClip({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="none"
      aria-label={label}
    />
  );
}

function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow text-subtle">{eyebrow}</p>
        <h2 className="display mt-3 text-6xl sm:text-7xl lg:text-8xl">{title}</h2>
      </div>
      {children}
    </Reveal>
  );
}

function TextLink({
  to,
  children,
}: {
  to: "/shop" | "/lab" | "/studio" | "/rack";
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-11 items-center gap-2 self-start font-display text-sm tracking-wider text-fg uppercase md:self-auto"
    >
      <span className="border-b-2 border-fg pb-0.5">{children}</span>
      <ArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
        strokeWidth={3}
      />
    </Link>
  );
}

export function HomePage({ catalog }: { catalog: StoreCatalog }) {
  const featured = catalog.products.filter((product) => !product.soldOut).slice(0, 4);

  return (
    <SiteShell overlayHeader>
      <Hero />

      <div
        className="overflow-hidden border-y-2 border-ink bg-accent py-3 text-accent-fg"
        aria-hidden="true"
      >
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {[...TAPE, ...TAPE].map((word, index) => (
                <span key={`${copy}-${index}`} className="display flex items-center text-2xl">
                  <span className="px-6">{word}</span>
                  <span className="h-2 w-2 rotate-45 bg-accent-fg" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {featured.length > 0 ? (
        <section className="paper">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionHead
              eyebrow={catalog.source === "demo" ? "Preview drop" : "In the shop now"}
              title="The drop"
            >
              <TextLink to="/shop">See everything</TextLink>
            </SectionHead>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {featured.map((product, index) => (
                <Reveal as="li" key={product.id} delay={index * 80}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="night relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:py-28">
          <div>
            <Reveal>
              <p className="eyebrow text-accent">Outfit Lab</p>
              <h2 className="display mt-3 text-6xl sm:text-7xl lg:text-8xl">
                Put it on <span className="text-lilac-soft">you</span> first.
              </h2>
              <p className="mt-6 max-w-lg text-lg text-muted">
                The lab dresses your face, not a model's. Build a look out loud and see it on you
                before a single piece is made.
              </p>
            </Reveal>
            <ol className="mt-10 flex flex-col">
              {LAB_STEPS.map((step, index) => (
                <Reveal
                  as="li"
                  key={step.n}
                  delay={index * 90}
                  className="flex gap-5 border-t border-line py-5"
                >
                  <span className="display text-3xl text-accent">{step.n}</span>
                  <div>
                    <p className="font-display text-lg uppercase">{step.title}</p>
                    <p className="mt-1 text-muted">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <Reveal className="mt-8">
              <Link
                to="/lab"
                className="sticker-shadow inline-flex h-14 items-center gap-2 border-2 border-ink bg-accent px-6 font-display text-sm tracking-wider text-accent-fg uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                Open the lab
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </Link>
            </Reveal>
          </div>
          <Reveal className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3 sm:gap-4 lg:max-w-none">
            <LoopClip
              src="/wild/walk-lilac.mp4"
              poster="/wild/side-lilac.jpg"
              label="A runway walk in the Lilac Set"
              className="aspect-2/3 w-full translate-y-8 border-2 border-lilac-soft object-cover"
            />
            <LoopClip
              src="/wild/walk-mint.mp4"
              poster="/wild/side-mint.jpg"
              label="A runway walk in the Mint Set"
              className="aspect-2/3 w-full border-2 border-mint-soft object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section className="paper">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHead eyebrow="How a set is drawn" title="The block" />
          <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {PROCESS.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 90}>
                <img
                  src={step.image}
                  alt={step.alt}
                  width={1248}
                  height={832}
                  loading="lazy"
                  decoding="async"
                  className="aspect-3/2 w-full object-cover"
                />
                <h3 className="display mt-5 text-4xl">{step.title}</h3>
                <p className="mt-2 max-w-sm text-muted">{step.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="night">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHead eyebrow="Unfazed" title="Wear it anywhere">
            <p className="max-w-sm text-muted">
              Same set, same coffee. The scene is the only thing that changes.
            </p>
          </SectionHead>
          {/* On a phone this strip scrolls sideways. It takes focus so the arrow keys can scroll it. */}
          <ul
            tabIndex={0}
            aria-label="Scenes"
            className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0"
          >
            {SCENES.map((scene, index) => (
              <Reveal
                as="li"
                key={scene.src}
                delay={index * 70}
                className="w-[68vw] shrink-0 snap-center sm:w-auto"
              >
                <LoopClip
                  src={scene.src}
                  poster={scene.poster}
                  label={scene.label}
                  className="aspect-2/3 w-full object-cover"
                />
                <p className="eyebrow mt-3 text-subtle">{scene.label}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="night border-t border-line">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <Reveal>
            <img
              src="/brand/detail-print.webp"
              alt="Black t-shirt on a print table with a fresh lime crown on the chest"
              width={1248}
              height={832}
              loading="lazy"
              decoding="async"
              className="aspect-3/2 w-full object-cover"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="eyebrow text-accent">Design studio</p>
            <h2 className="display mt-3 text-6xl sm:text-7xl">Make your own piece.</h2>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Pick a blank, place your art and type inside the print area, and pull a mockup before
              it goes on the rack. A look from the lab can go straight onto a tee.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/studio"
                className="sticker-shadow inline-flex h-14 items-center gap-2 border-2 border-ink bg-accent px-6 font-display text-sm tracking-wider text-accent-fg uppercase transition-transform duration-150 active:scale-[0.98]"
              >
                Open the studio
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </Link>
              <Link
                to="/rack"
                className="inline-flex h-14 items-center border-2 border-fg/70 px-6 font-display text-sm tracking-wider text-fg uppercase transition-colors duration-150 hover:bg-fg/10"
              >
                See the rack
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}
