import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { SlideStage } from "@/lib/gl/slides";

type Slide = {
  id: string;
  wide: string;
  tall: string;
  /** Subject position in the wide photo, 0..1 from the top left. */
  focus: [number, number];
  alt: string;
  kicker: string;
  lines: string[];
  body: string;
  cta: { label: string; to: "/shop" | "/lab" };
  side: "left" | "right";
};

const SLIDES: Slide[] = [
  {
    id: "lilac",
    wide: "/brand/hero-night-lilac.webp",
    tall: "/brand/hero-night-lilac-tall.webp",
    focus: [0.3, 0.5],
    alt: "The Lilac Set on a rain-slick crosswalk at night, coffee in hand",
    kicker: "The Lilac Set",
    lines: ["Crown never", "came off."],
    body: "Lilac fleece, cream panels, orange piping. Hoodie and jogger, cut to be worn together.",
    cta: { label: "Shop the drop", to: "/shop" },
    side: "right",
  },
  {
    id: "mint",
    wide: "/brand/hero-night-mint.webp",
    tall: "/brand/hero-night-mint-tall.webp",
    focus: [0.715, 0.5],
    alt: "The Mint Set, leaning on a black coupe under a street lamp",
    kicker: "The Mint Set",
    lines: ["Just", "dressing it."],
    body: "Mint fleece with a peach stripe and blue piping. The second set, same block.",
    cta: { label: "Shop the drop", to: "/shop" },
    side: "left",
  },
  {
    id: "lab",
    wide: "/brand/hero-throne.webp",
    tall: "/brand/hero-throne-tall.webp",
    focus: [0.5, 0.45],
    alt: "The Lilac Set, seated on a concrete block under one spotlight",
    kicker: "Outfit Lab",
    lines: ["Your face.", "Our fits."],
    body: "Lock your face with three photos, name the pieces, and watch yourself walk the runway.",
    cta: { label: "Open the lab", to: "/lab" },
    side: "left",
  },
];

const HOLD_MS = 6500;

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<SlideStage | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  // The slide the WebGL stage is showing, or -1 while only the plain photos can be trusted.
  const [stageSlide, setStageSlide] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Unknown until the browser is asked, so a phone never loads the wide crops first.
  const [tall, setTall] = useState<boolean | null>(null);
  const indexRef = useRef(0);
  const hover = useRef(false);
  // True once every photo has either loaded into the stage or failed to.
  const settled = useRef(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shape = window.matchMedia("(max-aspect-ratio: 4/5)");
    const sync = () => {
      setReduced(motion.matches);
      setTall(shape.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    shape.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      shape.removeEventListener("change", sync);
    };
  }, []);

  // WebGL stage. The plain photos underneath stay as the fallback and the first paint.
  // It is rebuilt when the screen flips between tall and wide, because each has its own crops.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced || tall === null) return;
    const stage = new SlideStage(canvas, {
      // A lost context leaves a stale frame on the canvas, so hand the hero back to the photos.
      onLost: () => setStageSlide(-1),
    });
    if (!stage.ok) return;
    stageRef.current = stage;
    let alive = true;
    const source = (slide: Slide) =>
      tall
        ? { src: slide.tall, focus: [0.5, 0.5] as [number, number] }
        : { src: slide.wide, focus: slide.focus };

    const onResize = () => stage.resize();
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      stage.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      );
    };
    const visible = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !document.hidden) stage.start();
      else stage.stop();
    });
    const onVisibility = () => {
      if (document.hidden) stage.stop();
      else stage.start();
    };

    void (async () => {
      // Load the slide on screen first, then the rest in order.
      const order = [
        indexRef.current,
        ...SLIDES.map((_, at) => at).filter((at) => at !== indexRef.current),
      ];
      let started = false;
      settled.current = false;
      for (const at of order) {
        const loaded = await stage.load(at, source(SLIDES[at]));
        if (!alive || !stage.ok) return;
        if (!loaded) continue;
        if (!started) {
          stage.resize();
          stage.start();
          visible.observe(canvas);
          started = true;
        }
        // If the visitor is looking at this slide and the stage is not, catch the stage up.
        if (at === indexRef.current && stage.showing() !== at) {
          stage.cut(at);
          setStageSlide(at);
        }
      }
      settled.current = true;
    })();

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      visible.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      stage.destroy();
      stageRef.current = null;
      setStageSlide(-1);
    };
  }, [reduced, tall]);

  const go = useCallback((next: number) => {
    const target = (next + SLIDES.length) % SLIDES.length;
    const stage = stageRef.current;
    indexRef.current = target;
    setIndex(target);
    // A photo the stage has not loaded yet is shown by the plain image until the loader catches up.
    setStageSlide(stage?.ok && stage.show(target) ? target : -1);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      if (hover.current || document.hidden) return;
      const target = (indexRef.current + 1) % SLIDES.length;
      const stage = stageRef.current;
      // Wait a beat rather than advance to a photo the stage is still loading. A photo that
      // failed to load is not waited for: the plain image shows that slide instead.
      if (stage?.ok && !stage.has(target) && !settled.current) return;
      go(target);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [go, paused, reduced]);

  const slide = SLIDES[index];
  const stageShows = stageSlide === index;

  return (
    <section
      ref={rootRef}
      className="night relative isolate flex min-h-svh flex-col justify-end overflow-hidden"
      aria-roledescription="carousel"
      aria-label="The drop"
      onPointerEnter={() => {
        hover.current = true;
      }}
      onPointerLeave={() => {
        hover.current = false;
      }}
      onFocusCapture={() => {
        hover.current = true;
      }}
      onBlurCapture={() => {
        hover.current = false;
      }}
    >
      <div className="absolute inset-0 -z-10">
        {SLIDES.map((item, at) => (
          <picture key={item.id}>
            <source media="(max-aspect-ratio: 4/5)" srcSet={item.tall} />
            <img
              src={item.wide}
              alt={at === index ? item.alt : ""}
              loading={at === 0 ? "eager" : "lazy"}
              fetchPriority={at === 0 ? "high" : "auto"}
              decoding="async"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
                at === index ? "opacity-100" : "opacity-0",
              )}
              style={{ objectPosition: `${item.focus[0] * 100}% ${item.focus[1] * 100}%` }}
            />
          </picture>
        ))}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-500",
            stageShows ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="absolute inset-0 bg-linear-to-t from-night via-night/35 to-night/30" />
        <div
          className={cn(
            "absolute inset-0 hidden transition-opacity duration-700 md:block",
            slide.side === "right" ? "bg-linear-to-l" : "bg-linear-to-r",
            "from-night/75 via-night/10 to-transparent",
          )}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-28 pb-8 sm:px-6 md:pb-12">
        <div
          key={slide.id}
          className={cn(
            "flex max-w-xl flex-col",
            slide.side === "right" ? "md:ml-auto md:items-end md:text-right" : "",
          )}
        >
          <p
            className="eyebrow hero-fade text-accent"
            style={{ "--line-delay": "80ms" } as CSSProperties}
          >
            {slide.kicker}
          </p>
          <h1 className="display mt-4 text-[clamp(3.6rem,13vw,9.5rem)] text-fg">
            {slide.lines.map((line, at) => (
              <span key={line} className="hero-line">
                <span style={{ "--line-delay": `${140 + at * 110}ms` } as CSSProperties}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p
            className="hero-fade mt-5 max-w-md text-lg text-muted"
            style={{ "--line-delay": "420ms" } as CSSProperties}
          >
            {slide.body}
          </p>
          <div
            className={cn(
              "hero-fade mt-7 flex flex-wrap gap-3",
              slide.side === "right" ? "md:justify-end" : "",
            )}
            style={{ "--line-delay": "520ms" } as CSSProperties}
          >
            <Link
              to={slide.cta.to}
              className="sticker-shadow inline-flex h-14 items-center gap-2 border-2 border-ink bg-accent px-6 font-display text-sm tracking-wider text-accent-fg uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              {slide.cta.label}
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </Link>
            <Link
              to={slide.cta.to === "/lab" ? "/shop" : "/lab"}
              className="inline-flex h-14 items-center border-2 border-fg/70 px-6 font-display text-sm tracking-wider text-fg uppercase transition-colors duration-150 hover:bg-fg/10"
            >
              {slide.cta.to === "/lab" ? "Shop the drop" : "Try it on in the lab"}
            </Link>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <div className="flex flex-1 gap-2" role="group" aria-label="Slides">
            {SLIDES.map((item, at) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(at)}
                aria-label={`Show ${item.kicker}`}
                aria-current={at === index ? "true" : undefined}
                className="group flex h-11 flex-1 items-center sm:max-w-28"
              >
                <span className="relative block h-0.5 w-full overflow-hidden bg-fg/30">
                  <span
                    key={`${item.id}-${at === index ? index : "idle"}-${paused || reduced ? "held" : "run"}`}
                    className={cn(
                      "absolute inset-y-0 left-0 bg-accent",
                      at === index ? (paused || reduced ? "w-full" : "hero-progress") : "w-0",
                    )}
                    style={{ animationDuration: `${HOLD_MS}ms` }}
                  />
                </span>
              </button>
            ))}
          </div>
          {reduced ? null : (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="grid h-11 w-11 place-items-center rounded-full text-fg hover:bg-fg/10"
              aria-label={paused ? "Play the slides" : "Pause the slides"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
