import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { Reveal } from "@/components/site/reveal";
import { SiteShell } from "@/components/site/shell";
import { garmentMockupSvg } from "@/lib/gfx/garments";
import { blankDrawShape, houseBlank } from "@/lib/pod/house-blanks";

function labPiece(id: string, colorCode: string, text: string, ink: string) {
  const blank = houseBlank(id);
  const color = blank?.colors.find((item) => item.code === colorCode) ?? blank?.colors[0];
  return {
    alt: `${blank?.name ?? "Blank"} in ${color?.name ?? "black"}, with ${text} printed on the front`,
    src: garmentMockupSvg({
      shape: blank ? blankDrawShape(blank) : "hoodie",
      colorHex: color?.hex ?? "#111111",
      placement: "front",
      layers: [
        {
          id: "lab",
          type: "text",
          text,
          font: "Archivo Black",
          color: ink,
          x: 0.5,
          y: 0.32,
          scale: 1,
          rotation: 0,
        },
      ],
    }),
  };
}

/** Two real pieces a person could put on in the lab and then order. */
const LAB_PIECES = [
  labPiece("hoodie-pullover", "lavender", "DO BETTER", "#17101f"),
  labPiece("jogger-court", "black", "SR", "#d6ff3c"),
];

const TAPE = [
  "Six real blanks",
  "Art on every spot",
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
    title: "Pick the pieces",
    body: "The six blanks or anything on the rack. Only pieces you can really order.",
  },
  {
    n: "03",
    title: "Walk it",
    body: "Put the pieces on you, then send the look down the runway. The crowd cheers or boos.",
  },
];

const PROCESS = [
  {
    n: "01",
    title: "Pick a real blank",
    body: "A tee, hoodie, crewneck, long-sleeve, sweatpants or tote. Only the colours and sizes Printful really has.",
  },
  {
    n: "02",
    title: "Art on every spot",
    body: "Front, back, sleeves, down each leg. Each spot holds its own art, and each extra one shows what it adds to the price.",
  },
  {
    n: "03",
    title: "Printed after you pay",
    body: "Nothing is made until it is bought. Printful prints it straight onto the blank and ships it.",
  },
];

/** The newer rooms, listed like the back of a record. */
const SIDE_B = [
  { to: "/battles", title: "Battles", line: "Two pieces, one vote. The throne keeps score." },
  { to: "/say", title: "Say it", line: "Say what you want on it. It lays the piece out for you." },
  {
    to: "/patterns",
    title: "Pattern lab",
    line: "Chain link, flames, bandana. Drawn fresh on every roll.",
  },
  {
    to: "/rack",
    title: "Makers",
    line: "Every piece on the rack carries its maker's name. Follow the ones you rate.",
  },
  {
    to: "/math",
    title: "Do the math",
    line: "Price a piece yourself and see where every dollar goes.",
  },
  {
    to: "/made",
    title: "How it's made",
    line: "Printing, in plain words. And where the money goes.",
  },
] as const;

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

export function HomePage() {
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
            {LAB_PIECES.map((piece, index) => (
              <img
                key={piece.alt}
                src={piece.src}
                alt={piece.alt}
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                className={`aspect-2/3 w-full border-2 bg-surface object-contain ${index === 0 ? "translate-y-8 border-lilac-soft" : "border-mint-soft"}`}
              />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="paper">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHead eyebrow="How a piece is made" title="No mystery">
            <Link to="/made" className="font-display text-sm tracking-wider uppercase underline">
              How it's made, in plain words
            </Link>
          </SectionHead>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {PROCESS.map((step, index) => (
              <Reveal as="li" key={step.n} delay={index * 90} className="border-t-2 border-ink pt-5">
                <span className="display text-5xl text-subtle">{step.n}</span>
                <h3 className="display mt-3 text-4xl">{step.title}</h3>
                <p className="mt-2 max-w-sm text-muted">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="paper">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHead eyebrow="Side B" title="The street decides">
            <p className="max-w-sm text-muted">
              Six more doors. Every one works without knowing a thing about design.
            </p>
          </SectionHead>
          <ol className="mt-10 border-t-2 border-ink">
            {SIDE_B.map((track, index) => (
              <Reveal as="li" key={track.to} delay={index * 50}>
                <Link
                  to={track.to}
                  className="group grid grid-cols-[2.75rem_1fr_auto] items-baseline gap-x-3 border-b-2 border-ink py-4 transition-colors duration-150 hover:bg-fg hover:text-bg focus-visible:bg-fg focus-visible:text-bg sm:grid-cols-[4rem_minmax(0,22rem)_1fr_auto] sm:px-3 sm:py-5"
                >
                  <span className="font-display text-sm tracking-widest text-subtle tabular-nums group-hover:text-bg group-focus-visible:text-bg">
                    B{index + 1}
                  </span>
                  <span className="display text-4xl sm:text-5xl">{track.title}</span>
                  <span className="col-start-2 text-muted group-hover:text-bg group-focus-visible:text-bg sm:col-start-3">
                    {track.line}
                  </span>
                  <ArrowRight
                    className="col-start-3 row-start-1 h-5 w-5 self-center transition-transform duration-200 group-hover:translate-x-1 sm:col-start-4"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </Link>
              </Reveal>
            ))}
          </ol>
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
