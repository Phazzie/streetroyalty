import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { garmentMockupSvg } from "@/lib/gfx/garments";
import { HOUSE_BLANKS, blankDrawShape, type HouseBlank } from "@/lib/pod/house-blanks";
import type { DesignLayer } from "@/lib/pod/types";

/** How long each blank holds a colour before it moves to the next real one. */
const TURN_MS = 2600;

const INK_ON_DARK = "#d6ff3c";
const INK_ON_LIGHT = "#17101f";

function lightness(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16) || 0;
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
}

/** The house mark, the way a maker would set it in the studio. */
function mark(text: string, colorHex: string): DesignLayer[] {
  return [
    {
      id: "mark",
      type: "text",
      text,
      font: "Archivo Black",
      color: lightness(colorHex) > 140 ? INK_ON_LIGHT : INK_ON_DARK,
      x: 0.5,
      y: 0.32,
      scale: 1,
      rotation: 0,
    },
  ];
}

const MARK: Record<HouseBlank["shape"], string> = {
  tee: "CROWN",
  hoodie: "DO BETTER",
  crew: "ROYALTY",
  joggers: "SR",
  tote: "KING",
};

const SHORT: Record<string, string> = {
  "tee-heavy": "Tee",
  "hoodie-pullover": "Hoodie",
  "crew-sweat": "Crewneck",
  "longsleeve-block": "Long-sleeve",
  "jogger-court": "Sweatpants",
  "tote-corner": "Tote",
};

function frontSpot(blank: HouseBlank): string {
  return blank.placements[0]?.placement ?? "front";
}

/** One real blank, stepping through the colours Printful really stocks it in. */
function Piece({ blank, step }: { blank: HouseBlank; step: number }) {
  const color = blank.colors[step % blank.colors.length] ?? blank.colors[0];
  const hex = color?.hex ?? "#111111";
  const art = useMemo(
    () =>
      garmentMockupSvg({
        shape: blankDrawShape(blank),
        colorHex: hex,
        placement: frontSpot(blank),
        layers: mark(MARK[blank.shape], hex),
      }),
    [blank, hex],
  );
  return (
    <li className="min-w-0">
      <Link
        to="/studio"
        className="group block border-2 border-line bg-surface transition-colors duration-150 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
      >
        <img
          src={art}
          alt={`${blank.name} in ${color?.name ?? "black"}`}
          width={400}
          height={400}
          className="aspect-square w-full object-cover"
        />
        <span className="block border-t-2 border-line px-2.5 py-2">
          <span className="block truncate font-display text-xs tracking-wide uppercase">
            {SHORT[blank.id] ?? blank.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 border border-fg/40"
              style={{ background: hex }}
              aria-hidden="true"
            />
            <span className="truncate">
              {color?.name} · {blank.colors.length} colours
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function Hero() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStep((now) => now + 1), TURN_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="night relative isolate overflow-hidden border-b-2 border-ink">
      <div
        className="pointer-events-none absolute -top-40 -right-40 -z-10 h-[36rem] w-[36rem] rounded-full bg-lilac-soft/15 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-28 pb-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14 lg:pt-32 lg:pb-20">
        <div>
          <p className="eyebrow text-accent">Street Royalty · made to order</p>
          <h1 className="display mt-4 text-[clamp(3.4rem,11vw,8rem)] text-fg">
            Crown never
            <br />
            came off.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Six real blanks, in the colours they really come in. Put your art on every spot they
            print: front, back, sleeves, down the leg. Printful makes it after you pay.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/studio"
              className="sticker-shadow inline-flex h-14 items-center gap-2 border-2 border-ink bg-accent px-6 font-display text-sm tracking-wider text-accent-fg uppercase transition-transform duration-150 active:scale-[0.98]"
            >
              Make your piece
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </Link>
            <Link
              to="/rack"
              className="inline-flex h-14 items-center border-2 border-fg/70 px-6 font-display text-sm tracking-wider text-fg uppercase transition-colors duration-150 hover:bg-fg/10"
            >
              See the rack
            </Link>
          </div>
        </div>
        <div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="The six blanks">
            {HOUSE_BLANKS.map((blank, index) => (
              <Piece key={blank.id} blank={blank} step={step + index} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Drawings of the real blanks. Every colour shown is one Printful stocks.
          </p>
        </div>
      </div>
    </section>
  );
}
