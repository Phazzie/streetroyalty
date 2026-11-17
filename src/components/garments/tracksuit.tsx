import { useId } from "react";

/**
 * A flat drawing of the label's colour-blocked sweatsuit: a hoodie with shoulder, sleeve and side
 * panels, and a jogger with a side panel, both edged in piping. It is a drawing, not a photo of a
 * made garment.
 *
 * Self-contained on purpose: no imports beyond React, no global CSS. Every region carries a
 * `data-panel` name (and `data-side` where there are two) so a panel designer can target it:
 *   hoodie: hood, hood-lining, body, sleeve, shoulder-panel, sleeve-panel, side-panel, pocket,
 *           hem, cuff, piping, cord
 *   jogger: waistband, leg, leg-panel, ankle-cuff, piping, cord
 */

export type TracksuitColors = {
  body: string;
  panel: string;
  piping: string;
  /** Cuffs, hem and waistband. Falls back to the body colour. */
  rib?: string;
  /** Drawcords. Falls back to the panel colour. */
  cord?: string;
};

export type TracksuitView = "hoodie" | "jogger" | "set";

type Props = {
  colors: TracksuitColors;
  view?: TracksuitView;
  className?: string;
  /** Read out by screen readers. Leave it out and the drawing is treated as decoration. */
  title?: string;
};

const VIEW_BOX: Record<TracksuitView, string> = {
  hoodie: "8 8 384 398",
  jogger: "36 16 228 410",
  set: "8 4 636 424",
};

const OUTLINE = "#14081c";

/** 0 (black) to 1 (white). Used only to pick a seam that shows on the cloth it sits on. */
function luminance(hex: string): number {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A stitch line: dark on light cloth, light on dark cloth, so seams read on any colour. */
function seam(hex: string, strength = 1): string {
  return luminance(hex) > 0.32
    ? `rgba(20,8,28,${0.34 * strength})`
    : `rgba(255,255,255,${0.36 * strength})`;
}

type Ids = { rib: string; ribSlant: string; sheen: string; inner: string };

type Resolved = Required<TracksuitColors>;

export function Tracksuit({ colors, view = "set", className, title }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids: Ids = {
    rib: `ts-rib-${uid}`,
    ribSlant: `ts-ribs-${uid}`,
    sheen: `ts-sheen-${uid}`,
    inner: `ts-inner-${uid}`,
  };
  const resolved: Resolved = {
    body: colors.body,
    panel: colors.panel,
    piping: colors.piping,
    rib: colors.rib ?? colors.body,
    cord: colors.cord ?? colors.panel,
  };

  return (
    <svg
      viewBox={VIEW_BOX[view]}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-garment="tracksuit"
      data-view={view}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Rib knit: a dark and a light hairline per rib, so it shows on pale and deep colours alike. */}
        <pattern id={ids.rib} width="4.5" height="8" patternUnits="userSpaceOnUse">
          <rect x="0" width="1.3" height="8" fill="#000" opacity="0.2" />
          <rect x="1.3" width="1" height="8" fill="#fff" opacity="0.16" />
        </pattern>
        <pattern
          id={ids.ribSlant}
          width="4.5"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(10)"
        >
          <rect x="0" width="1.3" height="8" fill="#000" opacity="0.2" />
          <rect x="1.3" width="1" height="8" fill="#fff" opacity="0.16" />
        </pattern>
        {/* Light from the top left: a little lift on one side and a little weight on the other. */}
        <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.13" />
        </linearGradient>
        <linearGradient id={ids.inner} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.34" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      {view === "hoodie" || view === "set" ? <Hoodie c={resolved} ids={ids} /> : null}
      {view === "jogger" ? <Jogger c={resolved} ids={ids} /> : null}
      {view === "set" ? (
        <g transform="translate(372 4)">
          <Jogger c={resolved} ids={ids} />
        </g>
      ) : null}
    </svg>
  );
}

const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const edge = { stroke: OUTLINE, strokeWidth: 1.7, strokeLinejoin: "round" } as const;

/* ------------------------------------------------------------------ hoodie */

const SLEEVE = "M100 118 C78 130 64 150 57 178 L24 354 C38 362 54 367 68 368 L110 196 Z";
const SLEEVE_PANEL =
  "M100 118 C78 130 64 150 57 178 L24 354 C31 358 38 361 45 363 L80 186 C83 168 90 152 103 141 Z";
const SHOULDER_PANEL = "M146 96 L100 118 L103 141 Q112 135 126 128 L160 106 Z";
const SLEEVE_PIPING = "M160 106 L126 128 Q112 135 103 141 C90 152 83 168 80 186 L45 363";
const TORSO_HALF = "M201 92 L146 96 L100 118 L110 196 C106 260 104 320 106 366 L201 366 Z";
const SIDE_PANEL = "M110 232 C122 280 130 326 132 366 L106 366 C104.6 322 105.4 276 107.6 232 Z";
const SIDE_PIPING = "M109 231 C122 280 130 326 132 366";
const HEM_HALF = "M108 366 L201 366 L201 393 L113 393 C110 385 108 375 108 366 Z";
const CUFF = "M24 354 C38 362 54 367 68 368 L63 395 C48 394 32 389 19 381 Z";
const POCKET =
  "M152 286 L248 286 C252 302 262 330 277 352 L270 366 L130 366 L123 352 C138 330 148 302 152 286 Z";
const HOOD =
  "M140 100 C122 62 148 20 200 20 C252 20 278 62 260 100 C244 116 222 128 200 137 C178 128 156 116 140 100 Z";
const HOOD_OPENING =
  "M160 93 C150 62 170 41 200 41 C230 41 250 62 240 93 C230 107 214 119 200 127 C186 119 170 107 160 93 Z";

function HoodieHalf({ c, ids, side }: { c: Resolved; ids: Ids; side: "left" | "right" }) {
  const bodySeam = seam(c.body);
  return (
    <g transform={side === "right" ? "translate(400 0) scale(-1 1)" : undefined}>
      <path d={SLEEVE} fill={c.body} {...edge} data-panel="sleeve" data-side={side} />
      {/* The underside of the sleeve sits in shadow. */}
      <path d="M110 196 L68 368 L56 366 L99 204 Z" fill="#000" opacity="0.1" />
      <path d={SLEEVE_PANEL} fill={c.panel} {...edge} data-panel="sleeve-panel" data-side={side} />
      <path d="M61 180 L30 352" stroke="#fff" strokeOpacity="0.16" strokeWidth="5" {...line} />
      {/* Folds at the elbow and above the cuff. */}
      <path
        d="M52 232 C64 240 78 243 92 240"
        stroke="#000"
        strokeOpacity="0.16"
        strokeWidth="1.4"
        {...line}
      />
      <path
        d="M49 246 C60 252 72 254 82 252"
        stroke="#000"
        strokeOpacity="0.11"
        strokeWidth="1.2"
        {...line}
      />
      <path
        d="M33 330 C44 337 58 341 72 341"
        stroke="#000"
        strokeOpacity="0.15"
        strokeWidth="1.4"
        {...line}
      />
      <path
        d="M31 342 C42 348 55 352 68 352"
        stroke="#000"
        strokeOpacity="0.1"
        strokeWidth="1.2"
        {...line}
      />

      <path d={TORSO_HALF} fill={c.body} data-panel="body" data-side={side} />
      <path d={SIDE_PANEL} fill={c.panel} data-panel="side-panel" data-side={side} />
      <path
        d="M110 196 C106 260 104 320 106 366 L116 366 C114 316 117 246 110 196 Z"
        fill="#000"
        opacity="0.07"
      />
      <path d={SHOULDER_PANEL} fill={c.panel} data-panel="shoulder-panel" data-side={side} />
      {/* Armhole seam, with its row of topstitch. */}
      <path d="M100 118 L110 196" stroke={bodySeam} strokeWidth="1.3" {...line} />
      <path
        d="M104.5 122 L113.6 190"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      {/* Torso outline: shoulder, side and nothing along the fold. */}
      <path
        d="M146 96 L100 118 L110 196 C106 260 104 320 106 366"
        stroke={OUTLINE}
        strokeWidth="1.7"
        {...line}
      />

      <path d={SLEEVE_PIPING} stroke={OUTLINE} strokeOpacity="0.35" strokeWidth="4.6" {...line} />
      <path
        d={SLEEVE_PIPING}
        stroke={c.piping}
        strokeWidth="3.4"
        {...line}
        data-panel="piping"
        data-side={side}
      />
      <path d={SIDE_PIPING} stroke={OUTLINE} strokeOpacity="0.35" strokeWidth="4.6" {...line} />
      <path
        d={SIDE_PIPING}
        stroke={c.piping}
        strokeWidth="3.4"
        {...line}
        data-panel="piping"
        data-side={side}
      />

      {/* The body blouses over the rib, so the rib sits a touch narrower with a shadow above it. */}
      <path d="M106 358 L201 358 L201 366 L106 366 Z" fill="#000" opacity="0.1" />
      <path d={HEM_HALF} fill={c.rib} data-panel="hem" data-side={side} />
      <path d={HEM_HALF} fill={`url(#${ids.rib})`} />
      <path
        d="M201 366 L108 366 C108 375 110 385 113 393 L201 393"
        stroke={OUTLINE}
        strokeWidth="1.7"
        {...line}
      />

      <path d={CUFF} fill={c.rib} {...edge} data-panel="cuff" data-side={side} />
      <path d={CUFF} fill={`url(#${ids.ribSlant})`} />
      <path
        d="M26 349 C39 357 54 362 69 363"
        stroke="#000"
        strokeOpacity="0.14"
        strokeWidth="3"
        {...line}
      />
    </g>
  );
}

function Hoodie({ c, ids }: { c: Resolved; ids: Ids }) {
  const bodySeam = seam(c.body);
  const cordSeam = seam(c.cord, 1.2);
  return (
    <g data-piece="hoodie">
      <HoodieHalf c={c} ids={ids} side="left" />
      <HoodieHalf c={c} ids={ids} side="right" />

      {/* One wash of light over the torso so it reads as cloth with a body under it, not a flat fill. */}
      <path
        d="M100 118 L146 96 L254 96 L300 118 L290 196 C294 260 296 320 294 366 L106 366 C104 320 106 260 110 196 Z"
        fill={`url(#${ids.sheen})`}
      />
      <path
        d="M180 150 C176 200 178 250 174 284"
        stroke="#000"
        strokeOpacity="0.07"
        strokeWidth="2"
        {...line}
      />
      <path
        d="M232 160 C238 200 234 246 240 284"
        stroke="#000"
        strokeOpacity="0.07"
        strokeWidth="2"
        {...line}
      />

      {/* Kangaroo pocket: a patch on the body with two slanted hand openings. */}
      <path d="M126 356 L274 356 L270 366 L130 366 Z" fill="#000" opacity="0.08" />
      <path
        d={POCKET}
        fill={c.body}
        stroke={OUTLINE}
        strokeOpacity="0.75"
        strokeWidth="1.5"
        strokeLinejoin="round"
        data-panel="pocket"
      />
      <path d={POCKET} fill="#fff" opacity="0.05" />
      <path
        d="M156 292 L244 292"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      <path
        d="M157 291 C152 306 142 332 130 351"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      <path
        d="M243 291 C248 306 258 332 270 351"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      <path
        d="M152 286 C148 302 138 330 123 352 L131 352 C143 332 152 306 157 292 Z"
        fill="#000"
        opacity="0.13"
      />
      <path
        d="M248 286 C252 302 262 330 277 352 L269 352 C257 332 248 306 243 292 Z"
        fill="#000"
        opacity="0.13"
      />

      {/* Hem topstitch across the whole front. */}
      <path
        d="M112 370.5 L288 370.5"
        stroke={seam(c.rib)}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />

      {/* Hood: the outside, then the opening with its lining in shadow, then piping round the edge. */}
      <path d={HOOD} fill={c.body} {...edge} data-panel="hood" />
      <path d={HOOD} fill={`url(#${ids.sheen})`} />
      <path d="M200 20 L200 41" stroke={bodySeam} strokeWidth="1.2" {...line} />
      <path
        d="M143 96 C156 113 178 126 200 134 C222 126 244 113 257 96"
        stroke="#000"
        strokeOpacity="0.13"
        strokeWidth="3"
        {...line}
      />
      <path d={HOOD_OPENING} fill={c.body} data-panel="hood-lining" />
      <path d={HOOD_OPENING} fill={`url(#${ids.inner})`} />
      <path d="M200 44 L200 82" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" {...line} />
      {/* Back neck: the rib tape you see inside a hood laid flat. */}
      <path
        d="M165 86 C184 96 216 96 235 86 C232 96 224 105 216 112 C206 108 194 108 184 112 C176 105 168 96 165 86 Z"
        fill={c.rib}
      />
      <path
        d="M165 86 C184 96 216 96 235 86 C232 96 224 105 216 112 C206 108 194 108 184 112 C176 105 168 96 165 86 Z"
        fill={`url(#${ids.rib})`}
      />
      <path d={HOOD_OPENING} stroke={OUTLINE} strokeOpacity="0.4" strokeWidth="5" {...line} />
      <path d={HOOD_OPENING} stroke={c.piping} strokeWidth="3.6" {...line} data-panel="piping" />

      {/* Eyelets and drawcords. The cords hang a little unevenly, the way they do. */}
      <circle cx="184" cy="121" r="2.6" fill="#cfc8bd" stroke={OUTLINE} strokeWidth="0.9" />
      <circle cx="216" cy="121" r="2.6" fill="#cfc8bd" stroke={OUTLINE} strokeWidth="0.9" />
      <path
        d="M184 122 C181 154 186 190 182 224"
        stroke={OUTLINE}
        strokeOpacity="0.45"
        strokeWidth="5.4"
        {...line}
      />
      <path
        d="M184 122 C181 154 186 190 182 224"
        stroke={c.cord}
        strokeWidth="4"
        {...line}
        data-panel="cord"
        data-side="left"
      />
      <path
        d="M184 126 C181 156 186 190 182 220"
        stroke={cordSeam}
        strokeWidth="0.9"
        strokeDasharray="1.6 2.6"
        {...line}
      />
      <path
        d="M216 122 C219 158 214 198 218 236"
        stroke={OUTLINE}
        strokeOpacity="0.45"
        strokeWidth="5.4"
        {...line}
      />
      <path
        d="M216 122 C219 158 214 198 218 236"
        stroke={c.cord}
        strokeWidth="4"
        {...line}
        data-panel="cord"
        data-side="right"
      />
      <path
        d="M216 126 C219 160 214 198 218 232"
        stroke={cordSeam}
        strokeWidth="0.9"
        strokeDasharray="1.6 2.6"
        {...line}
      />
      <rect
        x="179.4"
        y="221"
        width="5.2"
        height="10"
        rx="1"
        fill="#cfc8bd"
        stroke={OUTLINE}
        strokeWidth="0.9"
        transform="rotate(4 182 226)"
      />
      <rect
        x="215.4"
        y="233"
        width="5.2"
        height="10"
        rx="1"
        fill="#cfc8bd"
        stroke={OUTLINE}
        strokeWidth="0.9"
        transform="rotate(-4 218 238)"
      />
    </g>
  );
}

/* ------------------------------------------------------------------ jogger */

const LEG = "M58 60 L151 60 L151 152 C143 232 129 322 121 386 L76 382 C62 300 50 170 58 60 Z";
const LEG_PANEL = "M58 60 L81 60 C74 170 83 300 96 383.8 L76 382 C62 300 50 170 58 60 Z";
const LEG_PIPING = "M81 60 C74 170 83 300 96 383.8";
const WAIST_HALF = "M63 28 L151 28 L151 60 L58 60 C58 49 60 37 63 28 Z";
const ANKLE = "M76 382 L121 386 L119 413 C105 414 91 413 79 409 Z";

function JoggerHalf({ c, ids, side }: { c: Resolved; ids: Ids; side: "left" | "right" }) {
  const bodySeam = seam(c.body);
  return (
    <g transform={side === "right" ? "translate(300 0) scale(-1 1)" : undefined}>
      <path d={LEG} fill={c.body} data-panel="leg" data-side={side} />
      <path d={LEG} fill={`url(#${ids.sheen})`} />
      {/* Inside leg in shadow, and the pull of cloth at the knee and above the cuff. */}
      <path
        d="M151 152 C143 232 129 322 121 386 L109 385 C118 322 133 236 140 160 Z"
        fill="#000"
        opacity="0.09"
      />
      <path
        d="M92 236 C104 244 120 246 134 242"
        stroke="#000"
        strokeOpacity="0.13"
        strokeWidth="1.4"
        {...line}
      />
      <path
        d="M90 250 C102 256 116 258 128 255"
        stroke="#000"
        strokeOpacity="0.09"
        strokeWidth="1.2"
        {...line}
      />
      <path
        d="M84 356 C96 362 108 364 121 362"
        stroke="#000"
        strokeOpacity="0.15"
        strokeWidth="1.4"
        {...line}
      />
      <path
        d="M82 368 C94 373 106 375 119 374"
        stroke="#000"
        strokeOpacity="0.1"
        strokeWidth="1.2"
        {...line}
      />
      <path d={LEG_PANEL} fill={c.panel} data-panel="leg-panel" data-side={side} />
      <path
        d="M63 72 C57 170 66 296 80 376"
        stroke="#fff"
        strokeOpacity="0.16"
        strokeWidth="4"
        {...line}
      />
      {/* Slant pocket: an opening with a shadow inside it and a row of stitch. */}
      <path
        d="M106 64 C101 84 95 102 88 116"
        stroke={OUTLINE}
        strokeOpacity="0.55"
        strokeWidth="1.5"
        {...line}
      />
      <path
        d="M110 65 C105 85 99 104 92 118"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      <path
        d="M58 60 C50 170 62 300 76 382 M121 386 C129 322 143 232 151 152"
        stroke={OUTLINE}
        strokeWidth="1.7"
        {...line}
      />
      <path d={LEG_PIPING} stroke={OUTLINE} strokeOpacity="0.35" strokeWidth="4.6" {...line} />
      <path
        d={LEG_PIPING}
        stroke={c.piping}
        strokeWidth="3.4"
        {...line}
        data-panel="piping"
        data-side={side}
      />

      <path d={ANKLE} fill={c.rib} {...edge} data-panel="ankle-cuff" data-side={side} />
      <path d={ANKLE} fill={`url(#${ids.rib})`} />
      <path d="M77 378 L121 382" stroke="#000" strokeOpacity="0.14" strokeWidth="3" {...line} />

      <path d={WAIST_HALF} fill={c.rib} data-panel="waistband" data-side={side} />
      <path d={WAIST_HALF} fill={`url(#${ids.rib})`} />
      <path
        d="M151 28 L63 28 C60 37 58 49 58 60 L151 60"
        stroke={OUTLINE}
        strokeWidth="1.7"
        {...line}
      />
      {/* Elastic channels. */}
      <path
        d="M60 39 L151 39 M59 50 L151 50"
        stroke={seam(c.rib, 0.8)}
        strokeWidth="0.9"
        {...line}
      />
      <path
        d="M58 60 L151 60"
        stroke="#000"
        strokeOpacity="0.16"
        strokeWidth="3"
        {...line}
        transform="translate(0 2)"
      />
    </g>
  );
}

function Jogger({ c, ids }: { c: Resolved; ids: Ids }) {
  const bodySeam = seam(c.body);
  const cordSeam = seam(c.cord, 1.2);
  return (
    <g data-piece="jogger">
      <JoggerHalf c={c} ids={ids} side="left" />
      <JoggerHalf c={c} ids={ids} side="right" />
      {/* Front rise: the seam from the waistband to the crotch, and the J of a mock fly. */}
      <path d="M150 62 L150 152" stroke={bodySeam} strokeWidth="1.3" {...line} />
      <path
        d="M158 64 C158 96 157 120 151 138"
        stroke={bodySeam}
        strokeWidth="0.9"
        strokeDasharray="3 2.4"
        {...line}
      />
      <path d="M146 150 L150 156 L154 150" stroke={OUTLINE} strokeWidth="1.7" {...line} />

      <circle cx="143" cy="45" r="2.4" fill="#cfc8bd" stroke={OUTLINE} strokeWidth="0.9" />
      <circle cx="157" cy="45" r="2.4" fill="#cfc8bd" stroke={OUTLINE} strokeWidth="0.9" />
      <path
        d="M143 46 C139 70 144 98 139 124"
        stroke={OUTLINE}
        strokeOpacity="0.45"
        strokeWidth="5.2"
        {...line}
      />
      <path
        d="M143 46 C139 70 144 98 139 124"
        stroke={c.cord}
        strokeWidth="3.8"
        {...line}
        data-panel="cord"
        data-side="left"
      />
      <path
        d="M143 50 C139 72 144 98 139 120"
        stroke={cordSeam}
        strokeWidth="0.9"
        strokeDasharray="1.6 2.6"
        {...line}
      />
      <path
        d="M157 46 C162 74 156 106 161 134"
        stroke={OUTLINE}
        strokeOpacity="0.45"
        strokeWidth="5.2"
        {...line}
      />
      <path
        d="M157 46 C162 74 156 106 161 134"
        stroke={c.cord}
        strokeWidth="3.8"
        {...line}
        data-panel="cord"
        data-side="right"
      />
      <path
        d="M157 50 C162 76 156 106 161 130"
        stroke={cordSeam}
        strokeWidth="0.9"
        strokeDasharray="1.6 2.6"
        {...line}
      />
      {/* The knot where the cords cross. */}
      <path
        d="M143 46 C147 54 153 54 157 46"
        stroke={OUTLINE}
        strokeOpacity="0.45"
        strokeWidth="5.2"
        {...line}
      />
      <path d="M143 46 C147 54 153 54 157 46" stroke={c.cord} strokeWidth="3.8" {...line} />
      <rect
        x="136.5"
        y="121"
        width="5"
        height="9.5"
        rx="1"
        fill="#cfc8bd"
        stroke={OUTLINE}
        strokeWidth="0.9"
        transform="rotate(5 139 126)"
      />
      <rect
        x="158.5"
        y="131"
        width="5"
        height="9.5"
        rx="1"
        fill="#cfc8bd"
        stroke={OUTLINE}
        strokeWidth="0.9"
        transform="rotate(-5 161 136)"
      />
    </g>
  );
}
