import type { ReactNode, SVGProps } from "react";
import type { EntryId } from "@/lib/made/glossary";

/**
 * One set of drawings, one rule: the garment is drawn in ink, and whatever the method
 * adds to it (ink, thread, dye) is drawn in pink. Dotted lines mean "not there yet".
 */
export const DIAGRAM_CSS = `
.mw-plate{display:block;width:100%;height:auto;color:var(--color-fg)}
.mw-pink{stroke:var(--color-pipe)}
.mw-fill{fill:var(--color-pipe);stroke:none}
.mw-ground{fill:var(--color-surface)}
.mw-text{font-family:var(--font-display);font-size:8.5px;fill:currentColor;stroke:none;letter-spacing:0.05em;text-transform:uppercase}
.mw-slide{animation:mw-slide 2.8s ease-in-out infinite alternate}
@keyframes mw-slide{from{transform:translateX(-15px)}to{transform:translateX(15px)}}
.mw-bob{animation:mw-bob 0.8s ease-in-out infinite alternate}
@keyframes mw-bob{from{transform:translateY(-11px)}to{transform:translateY(0)}}
.mw-rise{transform-box:fill-box;transform-origin:50% 100%;animation:mw-rise 2.6s ease-in-out infinite alternate}
@keyframes mw-rise{from,15%{transform:scaleY(0.2)}70%,to{transform:scaleY(1)}}
.mw-join{animation:mw-join 2.4s ease-in-out infinite alternate}
@keyframes mw-join{from,10%{transform:translateX(9px)}80%,to{transform:translateX(-12px)}}
.mw-pull{animation:mw-pull 2.8s ease-in-out infinite alternate}
@keyframes mw-pull{from,8%{transform:translateX(0)}92%,to{transform:translateX(66px)}}
.mw-press{animation:mw-press 2.2s ease-in-out infinite alternate}
@keyframes mw-press{from,20%{transform:translateY(-7px)}75%,to{transform:translateY(5px)}}
@media (prefers-reduced-motion: reduce){
  .mw-slide,.mw-bob,.mw-rise,.mw-join,.mw-pull,.mw-press{animation:none}
}
`;

const TEE =
  "M52 34 L68 24 Q80 33 92 24 L108 34 L128 48 L118 64 L106 57 V100 H54 V57 L42 64 L32 48 Z";

function Tee(props: SVGProps<SVGPathElement>) {
  return <path d={TEE} vectorEffect="non-scaling-stroke" {...props} />;
}

function Plate({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 110"
      role="img"
      aria-label={label}
      className="mw-plate"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Arrow({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} h14 m-5 -5 l5 5 l-5 5`} />;
}

function Heat({ x, y }: { x: number; y: number }) {
  return (
    <path
      strokeWidth="1.8"
      d={`M${x} ${y} q3 3 0 6 q-3 3 0 6 M${x + 10} ${y} q3 3 0 6 q-3 3 0 6 M${x + 20} ${y} q3 3 0 6 q-3 3 0 6`}
    />
  );
}

/** A quarter circle on a six by six grid, the way a small picture looks blown up. */
const BLOCKS: [number, number][] = [];
for (let row = 0; row < 6; row += 1) {
  for (let col = 0; col < 6; col += 1) {
    if ((col + 0.5) ** 2 + (5 - row + 0.5) ** 2 <= 24) BLOCKS.push([col, row]);
  }
}

export function Diagram({ id, label }: { id: EntryId; label: string }) {
  switch (id) {
    case "dtg":
      return (
        <Plate label={label}>
          <g transform="translate(8 20) scale(0.9)">
            <Tee />
            <rect className="mw-fill" x="64" y="46" width="32" height="14" />
            <rect
              x="64"
              y="46"
              width="32"
              height="34"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <path d="M14 13 H146" />
          <g className="mw-slide">
            <rect className="mw-ground" x="64" y="5" width="32" height="16" rx="2" />
            <circle className="mw-fill" cx="72" cy="27" r="2" />
            <circle className="mw-fill" cx="80" cy="33" r="2" />
            <circle className="mw-fill" cx="88" cy="27" r="2" />
          </g>
        </Plate>
      );
    case "dtf":
      return (
        <Plate label={label}>
          <path d="M10 30 H44 L54 40 V86 H10 Z M44 30 V40 H54" />
          <path
            className="mw-fill"
            d="M32 46 l4 9 h10 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 h10 z"
          />
          <Arrow x={60} y={60} />
          <g transform="translate(64 30) scale(0.7)">
            <Tee />
            <path
              className="mw-fill"
              d="M80 52 l4 9 h10 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 h10 z"
            />
          </g>
          <g className="mw-press">
            <path d="M92 20 H148" strokeWidth="6" />
            <path d="M120 17 V8" />
            <Heat x={108} y={26} />
          </g>
        </Plate>
      );
    case "embroidery":
      return (
        <Plate label={label}>
          <ellipse cx="80" cy="78" rx="64" ry="22" />
          <ellipse cx="80" cy="78" rx="56" ry="16" strokeWidth="1.5" />
          <path
            className="mw-pink"
            d="M34 80 q26 -14 62 -4"
            strokeWidth="4"
            strokeDasharray="8 5"
          />
          <g className="mw-bob">
            <path d="M96 6 V64 M93 64 L96 75 L99 64" />
            <ellipse cx="96" cy="56" rx="1.6" ry="3.2" strokeWidth="1.5" />
            <path className="mw-pink" d="M126 4 C120 30 104 44 96 56" strokeWidth="2" />
          </g>
        </Plate>
      );
    case "puff":
      return (
        <Plate label={label}>
          <path d="M8 84 H152" />
          <path d="M8 91 H152" strokeWidth="1.5" strokeDasharray="2 5" />
          <rect className="mw-fill" x="18" y="78" width="42" height="6" />
          <Arrow x={68} y={66} />
          <Heat x={65} y={40} />
          <path
            className="mw-fill mw-rise"
            d="M98 84 V66 Q98 52 112 52 H126 Q140 52 140 66 V84 Z"
          />
          <text className="mw-text" x="39" y="104" textAnchor="middle">
            Flat
          </text>
          <text className="mw-text" x="119" y="104" textAnchor="middle">
            Raised
          </text>
        </Plate>
      );
    case "all-over":
      return (
        <Plate label={label}>
          <defs>
            <pattern
              id="mw-stripes"
              width="11"
              height="11"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect className="mw-fill" width="5" height="11" />
            </pattern>
          </defs>
          <rect x="8" y="12" width="144" height="86" fill="url(#mw-stripes)" />
          <g strokeDasharray="5 4" className="mw-ground" fillOpacity="0.55">
            <path d="M22 22 H40 Q52 31 64 22 H82 V88 H22 Z" />
            <path d="M94 22 L142 30 L138 52 L94 50 Z" />
            <path d="M94 60 L138 62 L142 86 L94 88 Z" />
          </g>
        </Plate>
      );
    case "cut-and-sew":
      return (
        <Plate label={label}>
          <path d="M22 18 H42 Q52 26 62 18 H82 V92 H22 Z" />
          <path className="mw-pink" d="M82 24 V62" strokeWidth="3" strokeDasharray="4 4" />
          <g className="mw-join">
            <path d="M100 24 L144 36 L138 66 L100 62 Z" />
            <path className="mw-pink" d="M100 26 V60" strokeWidth="3" strokeDasharray="4 4" />
          </g>
          <circle cx="112" cy="96" r="5" />
          <circle cx="128" cy="96" r="5" />
          <path d="M115 92 L136 76 M125 92 L104 76" />
        </Plate>
      );
    case "screen":
      return (
        <Plate label={label}>
          <defs>
            <pattern id="mw-mesh" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M0 0 H5 M0 0 V5" strokeWidth="0.7" stroke="currentColor" />
            </pattern>
          </defs>
          <rect x="24" y="10" width="112" height="50" fill="url(#mw-mesh)" />
          <path className="mw-pink" d="M34 18 V52" strokeWidth="6" />
          <g className="mw-pull">
            <rect className="mw-ground" x="40" y="5" width="9" height="60" />
          </g>
          {[20, 44, 68, 92].map((x) => (
            <g key={x} transform={`translate(${x} 64) scale(0.36)`}>
              <Tee className="mw-ground" />
              <rect className="mw-fill" x="66" y="50" width="28" height="24" />
            </g>
          ))}
        </Plate>
      );
    case "blank":
      return (
        <Plate label={label}>
          <Tee />
          <rect x="75" y="35" width="10" height="7" strokeWidth="1.5" />
        </Plate>
      );
    case "colourway":
      return (
        <Plate label={label}>
          <g transform="translate(-8 26) scale(0.66)">
            <Tee fill="var(--color-pipe)" />
          </g>
          <g transform="translate(27 12) scale(0.66)">
            <Tee fill="var(--color-lilac-soft)" />
          </g>
          <g transform="translate(62 26) scale(0.66)">
            <Tee fill="var(--color-mint-soft)" />
          </g>
        </Plate>
      );
    case "mockup":
      return (
        <Plate label={label}>
          <rect x="30" y="6" width="100" height="98" rx="8" />
          <path d="M30 22 H130" strokeWidth="1.5" />
          <g transform="translate(26 20) scale(0.68)">
            <Tee strokeDasharray="5 4" />
            <rect className="mw-fill" x="66" y="52" width="28" height="20" />
          </g>
          <path
            d="M108 70 V90 L113 85 L117 94 L121 92 L117 83 H124 Z"
            fill="currentColor"
            strokeWidth="1.5"
          />
        </Plate>
      );
    case "print-area":
      return (
        <Plate label={label}>
          <Tee />
          <rect className="mw-pink" x="63" y="46" width="34" height="45" strokeDasharray="5 4" />
          <path d="M140 46 V91 M136 46 H144 M136 91 H144" strokeWidth="1.5" />
          <text className="mw-text" x="80" y="42" textAnchor="middle">
            12 in
          </text>
          <text
            className="mw-text"
            x="152"
            y="69"
            textAnchor="middle"
            transform="rotate(-90 152 69)"
          >
            16 in
          </text>
        </Plate>
      );
    case "dpi":
      return (
        <Plate label={label}>
          <rect x="10" y="44" width="24" height="24" />
          <path className="mw-fill" d="M10 68 V50 A18 18 0 0 1 28 68 Z" />
          <Arrow x={42} y={56} />
          <g>
            {BLOCKS.map(([col, row]) => (
              <rect
                key={`${col}-${row}`}
                className="mw-fill"
                x={68 + col * 14}
                y={13 + row * 14}
                width="14"
                height="14"
              />
            ))}
          </g>
          <rect x="68" y="13" width="84" height="84" />
          <path
            d="M82 13 V97 M96 13 V97 M110 13 V97 M124 13 V97 M138 13 V97 M68 27 H152 M68 41 H152 M68 55 H152 M68 69 H152 M68 83 H152"
            strokeWidth="0.8"
          />
        </Plate>
      );
    case "made-to-order":
      return (
        <Plate label={label}>
          <rect x="8" y="26" width="34" height="46" />
          <path d="M14 36 H36 M14 44 H30" strokeWidth="1.5" />
          <path className="mw-pink" d="M16 58 L23 65 L35 51" strokeWidth="3.5" />
          <Arrow x={46} y={50} />
          <g transform="translate(36 16) scale(0.56)">
            <Tee />
            <circle className="mw-fill" cx="80" cy="64" r="11" />
          </g>
          <Arrow x={104} y={50} />
          <path d="M122 42 H154 V72 H122 Z M122 42 L128 31 H148 L154 42 M138 31 V52" />
          <text className="mw-text" x="25" y="88" textAnchor="middle">
            Paid
          </text>
          <text className="mw-text" x="81" y="88" textAnchor="middle">
            Made
          </text>
          <text className="mw-text" x="138" y="88" textAnchor="middle">
            Sent
          </text>
        </Plate>
      );
  }
}

/** The key to the set: what a plain line, a pink mark and a dotted line each mean. */
export function DiagramKey() {
  return (
    <Plate label="The key: a plain line is the garment, pink is what the method adds, and a dotted line is something not there yet.">
      <path d="M12 26 H44" />
      <text className="mw-text" x="54" y="29">
        The garment
      </text>
      <path className="mw-pink" d="M12 56 H44" strokeWidth="6" />
      <text className="mw-text" x="54" y="59">
        What is added
      </text>
      <path d="M12 86 H44" strokeDasharray="5 5" />
      <text className="mw-text" x="54" y="89">
        Not there yet
      </text>
    </Plate>
  );
}

/** Two cuts through a hoodie side, to show what "panel" means in each case. */
export function PrintedOrSewn({ kind }: { kind: "printed" | "sewn" }) {
  if (kind === "printed") {
    return (
      <Plate label="Seen from the edge: one sheet of fabric, with a stripe of colour printed into it.">
        <path d="M10 62 H150" strokeWidth="9" />
        <path className="mw-pink" d="M62 62 H98" strokeWidth="9" strokeLinecap="butt" />
        <path d="M62 44 V52 M98 44 V52" strokeWidth="1.5" />
        <text className="mw-text" x="80" y="38" textAnchor="middle">
          Colour in the cloth
        </text>
        <text className="mw-text" x="80" y="92" textAnchor="middle">
          One sheet, no join
        </text>
      </Plate>
    );
  }
  return (
    <Plate label="Seen from the edge: two fabrics folded and stitched together, with a cord of piping held in the seam.">
      <path d="M10 62 H70 Q78 62 78 70 V86" strokeWidth="9" strokeLinecap="butt" />
      <path
        d="M150 62 H90 Q82 62 82 70 V86"
        strokeWidth="9"
        strokeLinecap="butt"
        stroke="var(--color-lilac-soft)"
      />
      <circle className="mw-fill" cx="80" cy="54" r="7" />
      <path d="M66 78 H94" strokeWidth="1.8" strokeDasharray="3 3" />
      <text className="mw-text" x="80" y="36" textAnchor="middle">
        Piping
      </text>
      <text className="mw-text" x="80" y="104" textAnchor="middle">
        Two fabrics, one seam
      </text>
    </Plate>
  );
}
