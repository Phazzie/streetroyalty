/**
 * The drawings: one flat lay per garment and view, on a 480 by 600 table.
 *
 * Every garment is symmetric about x = 240, so each is drawn as its right half and
 * mirrored. Nothing here knows the garment colour: parts are tagged with a tone name and
 * the painter in index.ts picks the colour from the garment's luminance.
 */

export const CX = 240;

export type GarmentShape =
  "tee" | "longsleeve" | "crew" | "hoodie" | "trackjacket" | "jogger" | "tote" | "hat";

export type GarmentView = "front" | "back" | "sleeve_left" | "sleeve_right";

/** A print area on the table. `rot` turns it about its own centre, for a sleeve. */
export type PrintWindow = { x: number; y: number; w: number; h: number; rot: number };

export type Tone = "base" | "rib" | "inner" | "trim" | "label" | "metal" | "cord";

export type Part =
  | { kind: "fill"; d: string; tone: Tone }
  /** A thick stroke: straps, cords, bands. */
  | { kind: "band"; d: string; width: number; tone: Tone }
  /** Ribbing: a band with fine lines across it. */
  | { kind: "rib"; d: string; width: number }
  /** A crease where two panels are sewn together. */
  | { kind: "seam"; d: string }
  /** A row of stitches. */
  | { kind: "stitch"; d: string }
  /** A soft shadow that sits on the cloth, under an edge. */
  | { kind: "drop"; d: string; width: number };

export type Drawing = {
  /** The outline, filled with the garment colour. Also the clip and the ground shadow. */
  sil: string;
  /** Strokes that belong to the outline for the ground shadow (tote handles). */
  silBands: { d: string; width: number }[];
  /** Behind the body: the far handle of a tote. */
  behind: Part[];
  /** On the cloth, under the print. */
  under: Part[];
  /** Over the print: cords, zips, anything that hangs in front of it. */
  over: Part[];
  /** Fold shadows and the highlights beside them. */
  folds: string[];
  lights: string[];
  window: PrintWindow;
  /**
   * Turns and zooms the whole table about a point of the drawing. `at` is where that
   * point lands in the picture; left out, it lands in the middle.
   */
  camera: {
    x: number;
    y: number;
    zoom: number;
    rot: number;
    at?: readonly [number, number];
  } | null;
  label: string;
  /** Set when the garment covers the bottom left corner, where the caption sits. */
  captionRight?: boolean;
};

type P = readonly [number, number];
type Seg = { to: P; c?: readonly [P, P]; q?: P };

const n = (value: number) => String(Math.round(value * 10) / 10);
const pt = (p: P) => `${n(p[0])} ${n(p[1])}`;
const mir = (p: P): P => [2 * CX - p[0], p[1]];

function seg(s: Seg): string {
  if (s.c) return `C${pt(s.c[0])} ${pt(s.c[1])} ${pt(s.to)}`;
  if (s.q) return `Q${pt(s.q)} ${pt(s.to)}`;
  return `L${pt(s.to)}`;
}

function line(start: P, segs: Seg[]): string {
  return `M${pt(start)}${segs.map(seg).join("")}`;
}

function mirrored(start: P, segs: Seg[]): string {
  return line(
    mir(start),
    segs.map((s) => ({
      to: mir(s.to),
      c: s.c ? ([mir(s.c[0]), mir(s.c[1])] as const) : undefined,
      q: s.q ? mir(s.q) : undefined,
    })),
  );
}

/** The same line on both sides of the garment. */
function both(start: P, segs: Seg[]): string {
  return line(start, segs) + mirrored(start, segs);
}

/** A closed outline from its right half: down the right side, back up the left. */
function sym(start: P, segs: Seg[]): string {
  const points: P[] = [start, ...segs.map((s) => s.to)];
  let d = line(start, segs);
  const end = points[points.length - 1] ?? start;
  if (end[0] !== CX) d += `L${pt(mir(end))}`;
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    const s = segs[i];
    const to = points[i];
    if (!s || !to) continue;
    d += seg({
      to: mir(to),
      c: s.c ? ([mir(s.c[1]), mir(s.c[0])] as const) : undefined,
      q: s.q ? mir(s.q) : undefined,
    });
  }
  return `${d}Z`;
}

function rect(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`;
}

const win = (x: number, y: number, w: number, h: number, rot = 0): PrintWindow => ({
  x,
  y,
  w,
  h,
  rot,
});

/* ------------------------------------------------------------------ tops */

type TopKind = "tee" | "longsleeve" | "crew" | "hoodie" | "trackjacket";

function top(kind: TopKind, view: GarmentView): Drawing {
  const back = view === "back";
  const long = kind !== "tee";
  const hood = kind === "hoodie";
  const jacket = kind === "trackjacket";
  const ribHem = kind === "crew" || hood || jacket;

  const neck: P = long ? [279, 148] : [281, 147];
  const shoulder: P = long ? [348, 170] : [352, 168];
  const cuffOut: P = long ? [442, 428] : [428, 224];
  const cuffIn: P = long ? [402, 440] : [392, 284];
  const pit: P = long ? [356, 262] : [360, 252];
  const hemY = long ? 440 : 452;
  const hemCorner: P = long ? [ribHem ? 352 : 357, hemY] : [361, hemY];

  const sleeveTop: Seg = long
    ? {
        to: cuffOut,
        c: [
          [396, 198],
          [428, 332],
        ],
      }
    : { to: cuffOut, q: [398, 190] };
  const sleeveUnder: Seg = long
    ? {
        to: pit,
        c: [
          [390, 366],
          [372, 300],
        ],
      }
    : { to: pit, q: [374, 268] };
  const side: Seg = {
    to: hemCorner,
    c: [
      [pit[0] - 2, 320],
      [pit[0] + 3, 396],
    ],
  };
  const hem: Seg = { to: [CX, hemY + 6], q: [300, hemY + 7] };

  const body: Seg[] = [
    { to: shoulder, q: [316, 155] },
    sleeveTop,
    { to: cuffIn },
    sleeveUnder,
    side,
    hem,
  ];

  let sil: string;
  if (hood) {
    // The hood lies open above the shoulders.
    sil = sym(
      [CX, 78],
      [
        {
          to: [314, 142],
          c: [
            [288, 78],
            [322, 104],
          ],
        },
        { to: [294, 158], q: [310, 156] },
        { to: shoulder },
        ...body.slice(1),
      ],
    );
  } else if (jacket) {
    // A stand collar: a low band that rises off the shoulders.
    sil = sym([CX, 128], [{ to: [278, 132], q: [262, 128] }, { to: neck, q: [284, 138] }, ...body]);
  } else {
    sil = sym(
      [CX, 155],
      [
        {
          to: neck,
          c: [
            [256, 155],
            [272, 153],
          ],
        },
        ...body,
      ],
    );
  }

  const under: Part[] = [];
  const over: Part[] = [];

  // Sleeve seam, from the shoulder round to the underarm.
  const armhole: Seg[] = [
    {
      to: pit,
      c: [
        [shoulder[0] - 10, shoulder[1] + 34],
        [pit[0] - 12, pit[1] - 30],
      ],
    },
  ];
  under.push({ kind: "seam", d: both(shoulder, armhole) });
  under.push({
    kind: "stitch",
    d: both(
      [shoulder[0] - 5, shoulder[1] + 2],
      [
        {
          to: [pit[0] - 5, pit[1] + 1],
          c: [
            [shoulder[0] - 15, shoulder[1] + 34],
            [pit[0] - 17, pit[1] - 30],
          ],
        },
      ],
    ),
  });

  // Cuffs.
  const ux = cuffOut[0] - cuffIn[0];
  const uy = cuffOut[1] - cuffIn[1];
  const cuffWidth = Math.hypot(ux, uy);
  // Unit vector that points back up the sleeve, at a right angle to the cuff edge.
  const up: P = [uy / cuffWidth, -ux / cuffWidth];
  const back1 = (p: P, by: number): P => [p[0] + up[0] * by, p[1] + up[1] * by];
  if (long) {
    const depth = 22;
    under.push({
      kind: "rib",
      d: both(back1(cuffOut, depth / 2), [{ to: back1(cuffIn, depth / 2) }]),
      width: depth,
    });
    under.push({ kind: "seam", d: both(back1(cuffOut, depth), [{ to: back1(cuffIn, depth) }]) });
  } else {
    under.push({ kind: "stitch", d: both(back1(cuffOut, 8), [{ to: back1(cuffIn, 8) }]) });
    under.push({ kind: "stitch", d: both(back1(cuffOut, 11), [{ to: back1(cuffIn, 11) }]) });
  }

  // Hem.
  if (ribHem) {
    under.push({
      kind: "rib",
      d: line([118, hemY - 7], [{ to: [362, hemY - 7] }]),
      width: 30,
    });
    under.push({
      kind: "seam",
      d: line([124, hemY - 21], [{ to: [356, hemY - 21], q: [CX, hemY - 18] }]),
    });
  } else {
    const left = 2 * CX - hemCorner[0];
    under.push({
      kind: "stitch",
      d: line([left + 1, hemY - 9], [{ to: [hemCorner[0] - 1, hemY - 9], q: [CX, hemY + 3] }]),
    });
    under.push({
      kind: "stitch",
      d: line([left + 1, hemY - 12], [{ to: [hemCorner[0] - 1, hemY - 12], q: [CX, hemY] }]),
    });
  }

  if (jacket) {
    // Two stripes run down each sleeve.
    for (const inset of [9, 15]) {
      const s: P = [shoulder[0] - inset * 0.2, shoulder[1] + inset];
      under.push({
        kind: "band",
        tone: "trim",
        width: 3,
        d: both(
          [neck[0] + 6, neck[1] + inset * 0.9],
          [
            { to: s, q: [316, 155 + inset] },
            {
              to: back1([cuffOut[0] - inset * 0.95, cuffOut[1] + inset * 0.3], 22),
              c: [
                [396 - inset, 198 + inset * 0.5],
                [428 - inset, 332],
              ],
            },
          ],
        ),
      });
    }
  }

  // Neck.
  if (hood) {
    if (back) {
      under.push({
        kind: "seam",
        d: line([CX, 78], [{ to: [CX, 172] }]),
      });
      under.push({ kind: "stitch", d: line([CX + 4, 82], [{ to: [CX + 4, 170] }]) });
      under.push({
        kind: "seam",
        d: line([186, 158], [{ to: [294, 158], q: [CX, 184] }]),
      });
      under.push({
        kind: "drop",
        width: 10,
        d: line([190, 164], [{ to: [290, 164], q: [CX, 190] }]),
      });
    } else {
      const opening = sym(
        [CX, 204],
        [
          {
            to: [286, 126],
            c: [
              [262, 188],
              [292, 156],
            ],
          },
          {
            to: [CX, 94],
            c: [
              [280, 102],
              [258, 94],
            ],
          },
        ],
      );
      under.push({ kind: "fill", d: opening, tone: "inner" });
      under.push({ kind: "drop", d: opening, width: 12 });
      under.push({ kind: "band", d: opening, width: 9, tone: "base" });
      under.push({ kind: "stitch", d: opening });
      // Eyelets, and the cords that hang from them.
      for (const side1 of [-1, 1]) {
        const ex = CX + side1 * 15;
        under.push({ kind: "fill", d: circle(ex, 216, 3.4), tone: "metal" });
        under.push({ kind: "fill", d: circle(ex, 216, 1.7), tone: "inner" });
      }
      // The cords are drawn wide and laid down each side of the chest, the way a flat lay
      // is dressed, so they frame a print and do not hang through the middle of it.
      const cordR = line(
        [255, 217],
        [
          {
            to: [304, 272],
            c: [
              [276, 221],
              [302, 236],
            ],
          },
        ],
      );
      const cordL = line(
        [225, 217],
        [
          {
            to: [175, 282],
            c: [
              [204, 222],
              [178, 240],
            ],
          },
        ],
      );
      over.push({ kind: "drop", d: cordR + cordL, width: 5 });
      over.push({ kind: "band", d: cordR + cordL, width: 3.4, tone: "cord" });
      over.push({
        kind: "band",
        d: `M304 272l.4 9M175 282l-.5 9`,
        width: 4,
        tone: "metal",
      });
    }
  } else if (jacket) {
    if (back) {
      under.push({
        kind: "rib",
        d: line([199, 142], [{ to: [281, 142], q: [CX, 136] }]),
        width: 20,
      });
      under.push({ kind: "seam", d: line([198, 151], [{ to: [282, 151], q: [CX, 160] }]) });
    } else {
      const inner = sym(
        [CX, 134],
        [
          { to: [270, 138], q: [258, 134] },
          { to: [CX, 176], q: [262, 164] },
        ],
      );
      under.push({ kind: "fill", d: inner, tone: "inner" });
      under.push({
        kind: "rib",
        d: both([279, 140], [{ to: [CX + 3, 178], q: [270, 166] }]),
        width: 18,
      });
      under.push({ kind: "seam", d: both([288, 150], [{ to: [CX + 4, 190], q: [274, 178] }]) });
      // The zip runs the whole front.
      over.push({ kind: "drop", d: line([CX + 3, 170], [{ to: [CX + 3, hemY + 4] }]), width: 5 });
      over.push({
        kind: "band",
        d: line([CX, 168], [{ to: [CX, hemY + 6] }]),
        width: 5,
        tone: "inner",
      });
      over.push({ kind: "stitch", d: line([CX - 6, 190], [{ to: [CX - 6, hemY - 22] }]) });
      over.push({ kind: "stitch", d: line([CX + 6, 190], [{ to: [CX + 6, hemY - 22] }]) });
      over.push({ kind: "rib", d: line([CX, 170], [{ to: [CX, hemY + 6] }]), width: 3 });
      over.push({ kind: "fill", d: rect(CX - 3.5, 174, 7, 16), tone: "metal" });
    }
  } else {
    const ribWidth = kind === "crew" ? 13 : 10;
    const drop = kind === "crew" ? 188 : 186;
    if (back) {
      under.push({
        kind: "rib",
        d: line([201, 152], [{ to: [279, 152], q: [CX, 164] }]),
        width: ribWidth,
      });
      under.push({
        kind: "seam",
        d: line([198, 156], [{ to: [282, 156], q: [CX, 172] }]),
      });
      // The tape that covers the shoulder seam on the inside shows as one row outside.
      under.push({
        kind: "stitch",
        d: line([196, 160], [{ to: [284, 160], q: [CX, 178] }]),
      });
    } else {
      const opening = sym(
        [CX, 155],
        [
          {
            to: [neck[0] - 4, neck[1] + 2],
            c: [
              [256, 155],
              [270, 153],
            ],
          },
          {
            to: [CX, drop - ribWidth],
            c: [
              [neck[0] - 8, 170],
              [260, drop - ribWidth],
            ],
          },
        ],
      );
      under.push({ kind: "fill", d: opening, tone: "inner" });
      // The back of the collar, seen through the neck.
      under.push({
        kind: "rib",
        d: line([204, 156], [{ to: [276, 156], q: [CX, 164] }]),
        width: 8,
      });
      // The neck label.
      under.push({ kind: "fill", d: rect(CX - 9, 163, 18, 9), tone: "label" });
      under.push({ kind: "drop", d: opening, width: 6 });
      under.push({
        kind: "rib",
        d: both(
          [neck[0] - 3, neck[1] + 1],
          [
            {
              to: [CX, drop - ribWidth / 2],
              c: [
                [neck[0] - 4, 172],
                [262, drop - ribWidth / 2],
              ],
            },
          ],
        ),
        width: ribWidth,
      });
      under.push({
        kind: "seam",
        d: both(
          [neck[0] + 3, neck[1] + 1],
          [
            {
              to: [CX, drop + 1],
              c: [
                [neck[0] + 1, 176],
                [264, drop + 1],
              ],
            },
          ],
        ),
      });
      under.push({
        kind: "stitch",
        d: both(
          [neck[0] + 6, neck[1] + 4],
          [
            {
              to: [CX, drop + 4.5],
              c: [
                [neck[0] + 3, 179],
                [266, drop + 4.5],
              ],
            },
          ],
        ),
      });
    }
  }

  // Shoulder seam, set a little forward on the front.
  if (!hood || back) {
    under.push({
      kind: "seam",
      d: both(
        [neck[0] + 2, neck[1] + (back ? 3 : 5)],
        [{ to: [shoulder[0] - 3, shoulder[1] + (back ? 2 : 5)], q: [316, 160] }],
      ),
    });
  }

  if (hood && !back) {
    // The pouch pocket: slanted hand openings, sewn flat along the top.
    const pocket = sym(
      [CX, 338],
      [{ to: [300, 338] }, { to: [330, 384] }, { to: [330, hemY - 20] }, { to: [CX, hemY - 18] }],
    );
    under.push({ kind: "drop", d: both([302, 340], [{ to: [333, 386] }]), width: 9 });
    under.push({ kind: "fill", d: pocket, tone: "base" });
    under.push({ kind: "seam", d: pocket });
    under.push({
      kind: "stitch",
      d: sym(
        [CX, 342],
        [
          { to: [298, 342] },
          { to: [326, 385] },
          { to: [326, hemY - 22] },
          { to: [326, hemY - 22] },
        ],
      ).replace(/Z$/, ""),
    });
  }

  // Folds: the drag lines from each underarm, and the bend of each sleeve.
  const folds: string[] = [];
  const lights: string[] = [];
  const dragA: Seg[] = [
    {
      to: [pit[0] - 62, pit[1] + 44],
      c: [
        [pit[0] - 16, pit[1] + 16],
        [pit[0] - 38, pit[1] + 34],
      ],
    },
  ];
  folds.push(both([pit[0] - 2, pit[1] + 6], dragA));
  lights.push(
    both(
      [pit[0] - 4, pit[1] + 18],
      dragA.map((s) => shift(s, -2, 12)),
    ),
  );
  folds.push(
    line(
      [pit[0] - 1, pit[1] + 58],
      [
        {
          to: [pit[0] - 46, pit[1] + 96],
          c: [
            [pit[0] - 14, pit[1] + 74],
            [pit[0] - 28, pit[1] + 88],
          ],
        },
      ],
    ),
  );
  folds.push(
    line(
      [2 * CX - pit[0] + 2, pit[1] + 86],
      [
        {
          to: [2 * CX - pit[0] + 40, pit[1] + 132],
          c: [
            [2 * CX - pit[0] + 12, pit[1] + 104],
            [2 * CX - pit[0] + 30, pit[1] + 118],
          ],
        },
      ],
    ),
  );
  lights.push(
    line(
      [2 * CX - pit[0] + 4, pit[1] + 100],
      [
        {
          to: [2 * CX - pit[0] + 36, pit[1] + 146],
          c: [
            [2 * CX - pit[0] + 12, pit[1] + 118],
            [2 * CX - pit[0] + 26, pit[1] + 132],
          ],
        },
      ],
    ),
  );
  if (long) {
    folds.push(
      both(
        [386, 300],
        [
          {
            to: [424, 318],
            c: [
              [398, 300],
              [414, 306],
            ],
          },
        ],
      ),
    );
    folds.push(
      both(
        [392, 336],
        [
          {
            to: [430, 362],
            c: [
              [404, 338],
              [420, 346],
            ],
          },
        ],
      ),
    );
    lights.push(
      both(
        [388, 312],
        [
          {
            to: [426, 332],
            c: [
              [400, 312],
              [416, 320],
            ],
          },
        ],
      ),
    );
    lights.push(both([shoulder[0] + 6, shoulder[1] + 20], [{ to: [414, 286], q: [404, 220] }]));
  } else {
    folds.push(
      both(
        [366, 198],
        [
          {
            to: [398, 262],
            c: [
              [384, 214],
              [396, 236],
            ],
          },
        ],
      ),
    );
    lights.push(
      both(
        [378, 196],
        [
          {
            to: [410, 252],
            c: [
              [396, 210],
              [408, 230],
            ],
          },
        ],
      ),
    );
  }
  // The body rolls away at the sides.
  folds.push(
    both([pit[0] - 6, pit[1] + 30], [{ to: [hemCorner[0] - 6, hemY - 30], q: [pit[0] - 10, 350] }]),
  );

  // Where the print goes.
  let window: PrintWindow;
  let camera: Drawing["camera"] = null;
  let label = back ? "BACK" : "FRONT";
  if (view === "sleeve_left" || view === "sleeve_right") {
    // Wearer's left is the viewer's right when a garment lies face up.
    const sign = view === "sleeve_left" ? 1 : -1;
    const at: P = long ? [391, 298] : [394, 234];
    const size = long ? 33 : 37;
    const turn = long ? -17 : -50;
    const cx = sign === 1 ? at[0] : 2 * CX - at[0];
    window = win(cx - size / 2, at[1] - size / 2, size, size, sign * turn);
    // A short sleeve is a small thing: it sits low and to one side, so the collar and
    // the shoulder stay in the picture and it still reads as a tee.
    camera = long
      ? { x: cx, y: at[1] + 10, zoom: 1.9, rot: -sign * turn }
      : { x: cx, y: at[1] + 8, zoom: 2, rot: -sign * turn, at: [CX + sign * 60, 440] };
    label = view === "sleeve_left" ? "LEFT SLEEVE" : "RIGHT SLEEVE";
  } else if (back) {
    window = long ? win(183.5, hood ? 196 : 188, 113, 150) : win(177, 188, 126, 168);
  } else if (kind === "tee") {
    window = win(177, 204, 126, 168);
  } else if (kind === "hoodie") {
    window = win(183.5, 220, 113, 113);
  } else if (kind === "crew") {
    window = win(183.5, 208, 113, 132);
  } else if (kind === "trackjacket") {
    // A chest hit on the wearer's left, clear of the zip.
    window = win(264, 204, 50, 50);
  } else {
    window = win(183.5, 206, 113, 150);
  }

  // Fill the table: the whole garment, a little larger, centred.
  const middle = hood ? 262 : jacket ? 287 : long ? 297 : 302;
  camera ??= { x: CX, y: middle, zoom: 1.1, rot: 0 };

  return {
    sil,
    silBands: [],
    behind: [],
    under,
    over,
    folds,
    lights,
    window,
    camera,
    label,
    captionRight: !long && view === "sleeve_left",
  };
}

function shift(s: Seg, dx: number, dy: number): Seg {
  const move = (p: P): P => [p[0] + dx, p[1] + dy];
  return {
    to: move(s.to),
    c: s.c ? ([move(s.c[0]), move(s.c[1])] as const) : undefined,
    q: s.q ? move(s.q) : undefined,
  };
}

/* ---------------------------------------------------------------- jogger */

function jogger(view: GarmentView): Drawing {
  const back = view === "back";
  const sil = sym(
    [CX, 116],
    [
      { to: [314, 116] },
      { to: [317, 144] },
      {
        to: [338, 400],
        c: [
          [328, 190],
          [334, 262],
        ],
      },
      {
        to: [336, 504],
        c: [
          [340, 440],
          [339, 480],
        ],
      },
      { to: [333, 536] },
      { to: [289, 536] },
      { to: [286, 504] },
      {
        to: [CX, 268],
        c: [
          [280, 420],
          [262, 322],
        ],
      },
    ],
  );
  const under: Part[] = [
    { kind: "rib", d: line([160, 130], [{ to: [320, 130] }]), width: 29 },
    { kind: "seam", d: line([163, 145], [{ to: [317, 145] }]) },
    { kind: "stitch", d: line([164, 124], [{ to: [316, 124] }]) },
    { kind: "stitch", d: line([164, 136], [{ to: [316, 136] }]) },
    { kind: "rib", d: both([282, 520], [{ to: [340, 520] }]), width: 33 },
    { kind: "seam", d: both([286, 504], [{ to: [336, 504] }]) },
    // The rise.
    { kind: "seam", d: line([CX, 145], [{ to: [CX, 268] }]) },
    { kind: "stitch", d: line([CX + 4, 148], [{ to: [CX + 4, 256] }]) },
    // Outside leg seam.
    {
      kind: "stitch",
      d: both(
        [322, 200],
        [
          {
            to: [331, 500],
            c: [
              [328, 280],
              [333, 420],
            ],
          },
        ],
      ),
    },
  ];
  const over: Part[] = [];
  if (back) {
    const patch = `M262 182h54v50l-27 10l-27 -10Z`;
    under.push({ kind: "drop", d: `M264 236l25 9l25 -9`, width: 6 });
    under.push({ kind: "fill", d: patch, tone: "base" });
    under.push({ kind: "seam", d: patch });
    under.push({ kind: "stitch", d: `M265 186h48v44l-24 9l-24 -9Z` });
  } else {
    // Slash pockets, a fly, and the cord.
    const slash: Seg[] = [
      {
        to: [326, 214],
        c: [
          [296, 176],
          [312, 202],
        ],
      },
    ];
    under.push({
      kind: "drop",
      d: both(
        [296, 148],
        slash.map((s) => shift(s, -2, 3)),
      ),
      width: 8,
    });
    under.push({ kind: "seam", d: both([294, 146], slash) });
    under.push({
      kind: "stitch",
      d: both(
        [290, 148],
        slash.map((s) => shift(s, -4, 2)),
      ),
    });
    under.push({ kind: "stitch", d: `M246 148C247 200 246 226 240 240` });
    for (const side1 of [-1, 1]) {
      under.push({ kind: "fill", d: circle(CX + side1 * 9, 130, 3.2), tone: "metal" });
      under.push({ kind: "fill", d: circle(CX + side1 * 9, 130, 1.6), tone: "inner" });
    }
    const cords = `M249 131C254 150 246 168 251 190M231 131C227 152 235 172 229 198`;
    over.push({ kind: "drop", d: cords, width: 5 });
    over.push({ kind: "band", d: cords, width: 3.4, tone: "cord" });
    over.push({ kind: "band", d: `M251 190l.5 8M229 198l-.5 8`, width: 4, tone: "metal" });
  }
  const folds = [
    both(
      [CX + 6, 262],
      [
        {
          to: [300, 236],
          c: [
            [262, 258],
            [284, 250],
          ],
        },
      ],
    ),
    both(
      [CX + 10, 284],
      [
        {
          to: [308, 276],
          c: [
            [268, 286],
            [290, 284],
          ],
        },
      ],
    ),
    both(
      [292, 372],
      [
        {
          to: [332, 384],
          c: [
            [304, 370],
            [320, 376],
          ],
        },
      ],
    ),
    both(
      [290, 480],
      [
        {
          to: [334, 488],
          c: [
            [304, 476],
            [322, 482],
          ],
        },
      ],
    ),
    both([332, 220], [{ to: [334, 480], q: [338, 350] }]),
  ];
  const lights = [
    both(
      [CX + 12, 296],
      [
        {
          to: [306, 290],
          c: [
            [268, 298],
            [290, 297],
          ],
        },
      ],
    ),
    both(
      [294, 384],
      [
        {
          to: [330, 396],
          c: [
            [304, 382],
            [320, 388],
          ],
        },
      ],
    ),
  ];
  // Wearer's left thigh. From the back that leg is on the viewer's left.
  const window = back ? win(160, 256, 58, 76) : win(264, 232, 58, 76);
  return {
    sil,
    silBands: [],
    behind: [],
    under,
    over,
    folds,
    lights,
    window,
    camera: { x: CX, y: 326, zoom: 0.94, rot: 0 },
    label: back ? "BACK" : "FRONT",
  };
}

/* ------------------------------------------------------------------ tote */

function tote(view: GarmentView): Drawing {
  const back = view === "back";
  const sil = sym(
    [CX, 238],
    [
      { to: [348, 238] },
      {
        to: [352, 494],
        c: [
          [350, 320],
          [353, 420],
        ],
      },
      { to: [344, 502], q: [352, 502] },
      { to: [CX, 504] },
    ],
  );
  const handle = `M190 262C188 150 204 104 240 104C276 104 292 150 290 262`;
  const far = `M198 240C198 140 212 88 244 88C276 88 290 140 286 240`;
  const tack = (x: number) => rect(x - 8, 244, 16, 20);
  const cross = (x: number) => `M${x - 8} 244l16 20M${x + 8} 244l-16 20`;
  const under: Part[] = [
    { kind: "seam", d: line([132, 256], [{ to: [348, 256] }]) },
    { kind: "stitch", d: line([134, 252], [{ to: [346, 252] }]) },
    { kind: "stitch", d: line([134, 243], [{ to: [346, 243] }]) },
    { kind: "stitch", d: both([343, 260], [{ to: [346, 496], q: [347, 380] }]) },
  ];
  const over: Part[] = [
    { kind: "drop", d: `M194 262C192 150 208 108 244 108C280 108 296 150 294 262`, width: 14 },
    { kind: "band", d: handle, width: 15, tone: "base" },
    { kind: "stitch", d: `M185 262C183 148 200 99 240 99C280 99 297 148 295 262` },
    { kind: "stitch", d: `M195 262C193 152 208 109 240 109C272 109 287 152 285 262` },
    { kind: "stitch", d: tack(190) + tack(290) + cross(190) + cross(290) },
  ];
  return {
    sil,
    silBands: [
      { d: handle, width: 15 },
      { d: far, width: 14 },
    ],
    behind: [{ kind: "band", d: far, width: 14, tone: "inner" }],
    under,
    over,
    folds: [
      line(
        [150, 300],
        [
          {
            to: [176, 480],
            c: [
              [160, 360],
              [158, 430],
            ],
          },
        ],
      ),
      line(
        [318, 280],
        [
          {
            to: [330, 470],
            c: [
              [330, 340],
              [322, 420],
            ],
          },
        ],
      ),
      line([150, 470], [{ to: [330, 486], q: [240, 468] }]),
    ],
    lights: [
      line(
        [166, 296],
        [
          {
            to: [190, 478],
            c: [
              [176, 360],
              [172, 430],
            ],
          },
        ],
      ),
      line(
        [304, 284],
        [
          {
            to: [316, 468],
            c: [
              [316, 340],
              [308, 420],
            ],
          },
        ],
      ),
    ],
    window: win(165, 296, 150, 150),
    camera: null,
    label: back ? "BACK" : "FRONT",
  };
}

/* ------------------------------------------------------------------- hat */

function hat(view: GarmentView): Drawing {
  const back = view === "back";
  const button: Part = {
    kind: "fill",
    d: `M231 201a9 4 0 1 0 18 0a9 4 0 1 0 -18 0Z`,
    tone: "rib",
  };
  // A low, soft crown: wider than it is tall, the sides close to upright.
  const dome: Seg = {
    to: [337, 304],
    c: [
      [294, 200],
      [334, 232],
    ],
  };
  const panel: Seg[] = [
    {
      to: [302, 338],
      c: [
        [276, 214],
        [300, 266],
      ],
    },
  ];
  if (back) {
    // From behind: the strap gap, and no brim.
    const sil = sym(
      [CX, 200],
      [
        dome,
        { to: [333, 326] },
        { to: [278, 344], q: [306, 340] },
        {
          to: [CX, 298],
          c: [
            [278, 316],
            [262, 298],
          ],
        },
      ],
    );
    const gap = line(
      [202, 344],
      [
        {
          to: [CX, 298],
          c: [
            [202, 316],
            [218, 298],
          ],
        },
        {
          to: [278, 344],
          c: [
            [262, 298],
            [278, 316],
          ],
        },
      ],
    );
    return {
      sil,
      silBands: [{ d: `M200 338h80`, width: 11 }],
      behind: [],
      under: [
        { kind: "seam", d: line([CX, 202], [{ to: [CX, 298] }]) },
        { kind: "stitch", d: line([CX + 4, 208], [{ to: [CX + 4, 294] }]) },
        { kind: "seam", d: both([CX, 203], panel) },
        { kind: "stitch", d: gap.replace("M202 344", "M197 344").replace("278 344", "283 344") },
        { kind: "fill", d: circle(212, 234, 2.8), tone: "inner" },
        { kind: "fill", d: circle(268, 234, 2.8), tone: "inner" },
        { kind: "stitch", d: circle(212, 234, 5.2) + circle(268, 234, 5.2) },
        { kind: "stitch", d: both([332, 320], [{ to: [286, 338], q: [308, 334] }]) },
      ],
      over: [
        { kind: "band", d: `M200 338h80`, width: 11, tone: "base" },
        { kind: "stitch", d: `M202 335h76M202 341h76` },
        { kind: "fill", d: rect(231, 330, 18, 16), tone: "metal" },
        { kind: "fill", d: rect(235, 334, 10, 8), tone: "inner" },
        button,
      ],
      folds: [both([296, 250], [{ to: [326, 318], q: [322, 280] }])],
      lights: [line([200, 222], [{ to: [164, 300], q: [170, 250] }])],
      window: win(198, 246, 84, 42),
      camera: { x: CX, y: 278, zoom: 1.4, rot: 0 },
      label: "BACK",
    };
  }
  // From the front, a little above eye level: the brim is a curved lip under the crown,
  // a touch wider than it, thick in the middle and running out to a point at each side.
  const lipTop: [P, P, P, P] = [
    [349, 344],
    [322, 331],
    [282, 326],
    [CX, 326],
  ];
  const lipEdge: [P, P, P, P] = [
    [349, 344],
    [346, 371],
    [288, 378],
    [CX, 378],
  ];
  const crown = sym(
    [CX, 200],
    [
      dome,
      { to: [335, 335] },
      {
        to: [CX, 326],
        c: [
          [318, 330],
          [282, 326],
        ],
      },
    ],
  );
  const brim = sym(
    [CX, 326],
    [
      { to: lipTop[0], c: [lipTop[2], lipTop[1]] },
      { to: lipEdge[3], c: [lipEdge[1], lipEdge[2]] },
    ],
  );
  const row = (t: number): string => {
    const mix = (a: P, b: P): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return both(mix(lipEdge[0], lipTop[0]), [
      {
        to: mix(lipEdge[3], lipTop[3]),
        c: [mix(lipEdge[1], lipTop[1]), mix(lipEdge[2], lipTop[2])],
      },
    ]);
  };
  const seamLine = both(lipTop[0], [{ to: lipTop[3], c: [lipTop[1], lipTop[2]] }]);
  return {
    sil: crown + brim,
    silBands: [],
    behind: [],
    under: [
      { kind: "seam", d: line([CX, 202], [{ to: [CX, 326] }]) },
      { kind: "stitch", d: line([CX + 4, 208], [{ to: [CX + 4, 324] }]) },
      { kind: "seam", d: both([CX, 203], panel) },
      {
        kind: "stitch",
        d: both(
          [CX + 6, 207],
          panel.map((s) => shift(s, 4, 0)),
        ),
      },
      { kind: "fill", d: circle(212, 234, 2.8), tone: "inner" },
      { kind: "fill", d: circle(268, 234, 2.8), tone: "inner" },
      { kind: "stitch", d: circle(212, 234, 5.2) + circle(268, 234, 5.2) },
      // The brim is a touch deeper in tone, and the crown throws a shadow on it.
      { kind: "fill", d: brim, tone: "rib" },
      {
        kind: "drop",
        d: both(
          [345, 347],
          [
            {
              to: [CX, 334],
              c: [
                [320, 338],
                [282, 334],
              ],
            },
          ],
        ),
        width: 13,
      },
      { kind: "seam", d: seamLine },
      { kind: "stitch", d: row(0.16) + row(0.36) + row(0.56) },
    ],
    over: [button],
    folds: [
      both([296, 246], [{ to: [328, 316], q: [324, 276] }]),
      both(
        [343, 358],
        [
          {
            to: [CX, 376],
            c: [
              [332, 373],
              [288, 376],
            ],
          },
        ],
      ),
    ],
    lights: [
      line([198, 222], [{ to: [162, 300], q: [168, 250] }]),
      line([176, 352], [{ to: [304, 352], q: [240, 344] }]),
    ],
    window: win(182, 254, 116, 58),
    camera: { x: CX, y: 290, zoom: 1.4, rot: 0 },
    label: "FRONT",
  };
}

/* ----------------------------------------------------------------- entry */

export const GARMENT_SHAPES: readonly GarmentShape[] = [
  "tee",
  "longsleeve",
  "crew",
  "hoodie",
  "trackjacket",
  "jogger",
  "tote",
  "hat",
];

/** Reads a shape name or a catalog type ("T-Shirt", "Sweatshirt"). Anything else is a tee. */
export function resolveShape(shape: string): GarmentShape {
  const name = String(shape ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if ((GARMENT_SHAPES as readonly string[]).includes(name)) return name as GarmentShape;
  if (name.includes("hood")) return "hoodie";
  if (name.includes("track") || name.includes("jacket")) return "trackjacket";
  if (name.includes("long")) return "longsleeve";
  if (name.includes("crew") || name.includes("sweatshirt")) return "crew";
  if (name.includes("jog") || name.includes("pant") || name.includes("sweatpant")) return "jogger";
  if (name.includes("tote") || name.includes("bag")) return "tote";
  if (name.includes("hat") || name.includes("cap") || name.includes("beanie")) return "hat";
  return "tee";
}

/** Which way up the garment lies for a placement. Anything unknown is the front. */
export function resolveView(shape: GarmentShape, placement: string): GarmentView {
  const name = String(placement ?? "").toLowerCase();
  if (name.includes("back")) return "back";
  const sleeved = shape !== "jogger" && shape !== "tote" && shape !== "hat";
  if (sleeved && name.includes("sleeve")) {
    return name.includes("right") ? "sleeve_right" : "sleeve_left";
  }
  return "front";
}

export function drawGarment(shape: GarmentShape, view: GarmentView): Drawing {
  if (shape === "hat") return hat(view);
  if (shape === "tote") return tote(view);
  if (shape === "jogger") return jogger(view);
  return top(shape, view);
}
