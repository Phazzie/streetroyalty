import { hashSeed, hashUnit, mixHex, mod, mulberry32, type PatternId } from "./core.ts";

/**
 * The twelve painters. Each one fills a square tile of t pixels at 0,0 so that the
 * left edge carries on from the right edge and the top from the bottom.
 *
 * Two ways to get there, and every painter uses one of them:
 *   - lattice: everything sits on a grid that divides the tile, and any randomness
 *     is hashed from the grid position modulo the grid size;
 *   - wrap: the drawing runs once per neighbouring tile (nine times), so a shape
 *     that leaves one edge comes back in on the other.
 */

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type Painter = (ctx: Ctx2D, t: number, colors: string[], seed: number) => void;

const TAU = Math.PI * 2;

function wrap(ctx: Ctx2D, t: number, draw: () => void): void {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      ctx.save();
      ctx.translate(dx * t, dy * t);
      draw();
      ctx.restore();
    }
  }
}

function ground(ctx: Ctx2D, t: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, t, t);
}

function dot(ctx: Ctx2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  ctx.fill();
}

type Point = [number, number];

/** A closed curve that passes smoothly near every point. */
function smoothClosed(ctx: Ctx2D, points: Point[]): void {
  const count = points.length;
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[count - 1]!, points[0]!);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let index = 0; index < count; index += 1) {
    const here = points[index]!;
    const next = mid(here, points[(index + 1) % count]!);
    ctx.quadraticCurveTo(here[0], here[1], next[0], next[1]);
  }
  ctx.closePath();
}

/** An open line of straight runs with a tight round bend at each corner, like bent wire. */
function bentWire(ctx: Ctx2D, points: Point[], radius: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const here = points[index]!;
    const next = points[index + 1]!;
    ctx.arcTo(here[0], here[1], next[0], next[1], radius);
  }
  const last = points[points.length - 1]!;
  ctx.lineTo(last[0], last[1]);
}

// --- chain-link fence -------------------------------------------------------

const chainLink: Painter = (ctx, t, colors, seed) => {
  const [bg, wire, tie] = colors as [string, string, string];
  ground(ctx, t, bg);
  const across = 3 + (hashSeed(seed, 11) % 2);
  const cell = t / across;
  const gauge = cell * 0.085;
  const bend = (k: number, j: number, axis: number) =>
    (hashUnit(seed, mod(k, across), mod(j, across * 2), axis) - 0.5) * cell * 0.07;

  const strand = (k: number, side: 0 | 1): Point[] => {
    const points: Point[] = [];
    for (let j = -3; j <= across * 2 + 3; j += 1) {
      const odd = mod(j, 2) === 1;
      const reach = gauge * 0.7;
      const x =
        side === 0
          ? k * cell + (odd ? cell / 2 + reach : -reach)
          : k * cell + (odd ? cell / 2 - reach : cell + reach);
      points.push([x + bend(k + side * 31, j, 1), (j * cell) / 2 + bend(k + side * 31, j, 2)]);
    }
    return points;
  };

  const strands: Point[][] = [];
  for (let k = -1; k <= across; k += 1) strands.push(strand(k, 0), strand(k, 1));

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pass = (color: string, width: number, dx: number, dy: number) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const points of strands) {
      bentWire(ctx, points, gauge * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  };
  pass(mixHex(bg, "#000000", 0.55), gauge * 1.9, gauge * 0.35, gauge * 0.45);
  for (const points of strands) {
    for (const [color, width, shift] of [
      [mixHex(wire, "#000000", 0.45), gauge * 1.5, 0],
      [wire, gauge, 0],
      [mixHex(wire, "#ffffff", 0.65), gauge * 0.28, -gauge * 0.22],
    ] as const) {
      ctx.save();
      ctx.translate(shift, shift);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      bentWire(ctx, points, gauge * 1.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Rags tied to the fence at a few knuckles.
  for (let k = -1; k <= across; k += 1) {
    for (let j = -1; j <= across * 2 + 1; j += 2) {
      const pick = hashUnit(seed, mod(k, across), mod(j, across * 2), 5);
      if (pick > 0.16) continue;
      const x = k * cell + cell / 2;
      const y = (j * cell) / 2;
      const tilt = (hashUnit(seed, mod(k, across), mod(j, across * 2), 6) - 0.5) * 1.6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = mixHex(tie, "#000000", 0.5);
      ctx.fillRect(-cell * 0.15, -cell * 0.05, cell * 0.3, cell * 0.11);
      ctx.fillStyle = tie;
      ctx.fillRect(-cell * 0.14, -cell * 0.055, cell * 0.28, cell * 0.085);
      ctx.beginPath();
      ctx.moveTo(cell * 0.1, 0);
      ctx.lineTo(cell * 0.28, cell * 0.16);
      ctx.lineTo(cell * 0.17, cell * 0.2);
      ctx.lineTo(cell * 0.03, cell * 0.03);
      ctx.fill();
      ctx.restore();
    }
  }
};

// --- barbed wire ------------------------------------------------------------

const barbedWire: Painter = (ctx, t, colors, seed) => {
  const [bg, wire, barb] = colors as [string, string, string];
  ground(ctx, t, bg);
  const rows = 3;
  const gap = t / rows;
  const twists = 10 + (hashSeed(seed, 3) % 4);
  const gauge = t * 0.011;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let r = -1; r <= rows; r += 1) {
    const row = mod(r, rows);
    const y0 = (r + 0.5) * gap;
    const sag = gap * (0.1 + hashUnit(seed, row, 1) * 0.14);
    const phase = hashUnit(seed, row, 2);
    const coil = hashUnit(seed, row, 3);
    const centre = (x: number) => y0 + sag * Math.sin(TAU * (x / t + phase));
    const twist = (x: number, side: number) =>
      side * gauge * 1.5 * Math.sin(TAU * ((x / t) * twists + coil));

    for (const side of [1, -1]) {
      const points: Point[] = [];
      for (let step = -4; step <= 164; step += 1) {
        const x = (step / 160) * t;
        points.push([x, centre(x) + twist(x, side)]);
      }
      for (const [color, width] of [
        [mixHex(bg, "#000000", 0.35), gauge * 2.4],
        [side === 1 ? wire : mixHex(wire, bg, 0.25), gauge * 1.25],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      }
    }

    const barbs = 3;
    for (let b = 0; b < barbs; b += 1) {
      const home = ((b + 0.2 + hashUnit(seed, row, b, 4) * 0.6) / barbs) * t;
      for (const shift of [-t, 0, t]) {
        const x = home + shift;
        const y = centre(x);
        const reach = gap * (0.2 + hashUnit(seed, row, b, 5) * 0.08);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((hashUnit(seed, row, b, 6) - 0.5) * 0.5);
        // four spikes, cut on a slant like the real thing
        ctx.fillStyle = barb;
        for (const [angle, length] of [
          [-1.05, 1],
          [1.05, 0.9],
          [Math.PI - 1.0, 0.92],
          [Math.PI + 1.1, 1],
        ] as const) {
          const tipX = Math.cos(angle) * reach * length;
          const tipY = Math.sin(angle) * reach * length;
          const nx = -Math.sin(angle) * gauge * 0.95;
          const ny = Math.cos(angle) * gauge * 0.95;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(-nx, -ny);
          ctx.closePath();
          ctx.fill();
        }
        // the wrap that holds the barb on
        ctx.strokeStyle = barb;
        ctx.lineWidth = gauge * 1.3;
        for (const offset of [-1.6, 0, 1.6]) {
          ctx.beginPath();
          ctx.moveTo(offset * gauge - gauge * 1.2, -gauge * 2.6);
          ctx.lineTo(offset * gauge + gauge * 1.2, gauge * 2.6);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
};

// --- bandana paisley --------------------------------------------------------

function paisleyPath(ctx: Ctx2D): void {
  ctx.beginPath();
  ctx.moveTo(0.3, -0.58);
  ctx.bezierCurveTo(0.02, -0.52, -0.36, -0.22, -0.36, 0.14);
  ctx.bezierCurveTo(-0.36, 0.36, -0.2, 0.5, 0.01, 0.5);
  ctx.bezierCurveTo(0.22, 0.5, 0.37, 0.36, 0.37, 0.16);
  ctx.bezierCurveTo(0.37, -0.08, 0.13, -0.16, 0.1, -0.36);
  ctx.bezierCurveTo(0.09, -0.46, 0.18, -0.54, 0.3, -0.58);
  ctx.closePath();
}

function paisley(
  ctx: Ctx2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  flip: number,
  ink: string,
  bg: string,
  accent: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size * flip, size);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  // scalloped edge: round dots strung along the outline
  ctx.lineCap = "round";
  ctx.lineWidth = 0.085;
  ctx.setLineDash([0.001, 0.115]);
  paisleyPath(ctx);
  ctx.stroke();
  ctx.setLineDash([]);
  paisleyPath(ctx);
  ctx.fill();
  // rings that follow the outline all the way into the tail: clip to the shape, then stroke inward
  ctx.save();
  paisleyPath(ctx);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.lineJoin = "round";
  for (const [color, width] of [
    [ink, 0.34],
    [bg, 0.25],
    [ink, 0.11],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    paisleyPath(ctx);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = bg;
  dot(ctx, 0.0, 0.2, 0.075);
  ctx.fillStyle = ink;
  dot(ctx, 0.0, 0.2, 0.035);
  ctx.restore();
}

function flower(
  ctx: Ctx2D,
  x: number,
  y: number,
  radius: number,
  petals: number,
  ink: string,
  accent: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ink;
  for (let petal = 0; petal < petals; petal += 1) {
    ctx.save();
    ctx.rotate((petal / petals) * TAU);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.58, radius * 0.2, radius * 0.42, 0, 0, TAU);
    ctx.fill();
    dot(ctx, radius * 0.5, -radius * 1.02, radius * 0.07);
    ctx.restore();
  }
  ctx.fillStyle = accent;
  dot(ctx, 0, 0, radius * 0.24);
  ctx.fillStyle = ink;
  dot(ctx, 0, 0, radius * 0.1);
  ctx.restore();
}

const bandana: Painter = (ctx, t, colors, seed) => {
  const [bg, ink, accent] = colors as [string, string, string];
  ground(ctx, t, bg);
  wrap(ctx, t, () => {
    const random = mulberry32(hashSeed(seed, 21));
    const turn = random() * TAU;
    const flip = random() < 0.5 ? 1 : -1;
    const petals = 6 + Math.floor(random() * 3) * 2;
    // dotted diamond trellis
    ctx.fillStyle = ink;
    const beads = 14;
    for (let bead = 0; bead < beads; bead += 1) {
      const along = (bead + 0.5) / beads;
      dot(ctx, along * t, along * t, t * 0.008);
      dot(ctx, along * t, t - along * t, t * 0.008);
    }
    paisley(ctx, t * 0.27, t * 0.25, t * 0.34, turn, flip, ink, bg, accent);
    paisley(ctx, t * 0.77, t * 0.75, t * 0.34, turn + Math.PI, flip, ink, bg, accent);
    flower(ctx, t * 0.75, t * 0.25, t * 0.1, petals, ink, accent);
    flower(ctx, t * 0.25, t * 0.75, t * 0.1, petals, ink, accent);
    for (const [x, y, spin] of [
      [0, 0.5, 0.6],
      [0.5, 0, 2.2],
      [0.5, 0.5, 3.9],
      [0, 0, 5.3],
    ] as const) {
      paisley(ctx, x * t, y * t, t * 0.13, turn + spin + random() * 0.8, -flip, ink, bg, accent);
    }
  });
};

// --- flames -----------------------------------------------------------------

const flames: Painter = (ctx, t, colors, seed) => {
  const [bg, outer, mid, core] = colors as [string, string, string, string];
  ground(ctx, t, bg);
  const cycle = [outer, mid, core, bg];
  const rows = cycle.length;
  const rowHeight = t / rows;
  const tongues = 5 + (hashSeed(seed, 31) % 3);
  const width = t / tongues;

  for (let r = -2; r <= rows + 2; r += 1) {
    const row = mod(r, rows);
    const base = r * rowHeight + rowHeight * 0.5;
    ctx.fillStyle = cycle[row]!;
    ctx.fillRect(-1, base - 1, t + 2, rowHeight + 2);
    for (let k = -2; k <= tongues + 1; k += 1) {
      const tongue = mod(k, tongues);
      const jitter = hashUnit(seed, row, tongue, 1);
      const x = (k + 0.5 + (jitter - 0.5) * 0.4) * width;
      const height = rowHeight * (0.7 + hashUnit(seed, row, tongue, 2) * 1.25);
      // wide enough that neighbours always overlap at the foot, so no flat ledge shows
      const half = width * (0.74 + hashUnit(seed, row, tongue, 3) * 0.2);
      const lean = (hashUnit(seed, row, tongue, 4) - 0.5) * width * 1.5;
      const curl = lean * 0.9;
      ctx.beginPath();
      ctx.moveTo(x - half, base + 1);
      ctx.bezierCurveTo(
        x - half * 0.95,
        base - height * 0.5,
        x - curl * 0.6 - half * 0.25,
        base - height * 0.55,
        x + lean,
        base - height,
      );
      ctx.bezierCurveTo(
        x + lean - curl * 0.5 + half * 0.35,
        base - height * 0.62,
        x + half * 1.05,
        base - height * 0.38,
        x + half,
        base + 1,
      );
      ctx.closePath();
      ctx.fill();
    }
  }
};

// --- checker ----------------------------------------------------------------

const checker: Painter = (ctx, t, colors, seed) => {
  const [bg, square, hit] = colors as [string, string, string];
  ground(ctx, t, bg);
  const across = 4;
  const cell = t / across;
  for (let j = 0; j < across; j += 1) {
    for (let i = 0; i < across; i += 1) {
      const filled = (i + j) % 2 === 1;
      const x = i * cell;
      const y = j * cell;
      if (filled) {
        ctx.fillStyle = square;
        ctx.fillRect(x, y, cell, cell);
      }
      const roll = hashUnit(seed, i, j, 1);
      if (roll > 0.3) continue;
      const kind = hashSeed(seed, i, j, 2) % 4;
      ctx.fillStyle = hit;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cell, cell);
      ctx.clip();
      if (kind === 0) {
        // a bite out of one corner
        const cx = x + (hashSeed(seed, i, j, 3) % 2) * cell;
        const cy = y + (hashSeed(seed, i, j, 4) % 2) * cell;
        dot(ctx, cx, cy, cell * 0.72);
      } else if (kind === 1) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell, y);
        ctx.lineTo(x, y + cell);
        ctx.closePath();
        ctx.fill();
      } else if (kind === 2) {
        dot(ctx, x + cell / 2, y + cell / 2, cell * 0.3);
        ctx.fillStyle = filled ? square : bg;
        dot(ctx, x + cell / 2, y + cell / 2, cell * 0.13);
      } else {
        const stripe = cell / 5;
        for (let s = 0; s < 5; s += 2) ctx.fillRect(x, y + s * stripe, cell, stripe);
      }
      ctx.restore();
    }
  }
};

// --- warped checker ---------------------------------------------------------

const warpChecker: Painter = (ctx, t, colors, seed) => {
  const [bg, square] = colors as [string, string];
  ground(ctx, t, bg);
  const random = mulberry32(hashSeed(seed, 41));
  const across = 6;
  const p = [random(), random(), random(), random()];
  const big = 0.045 + random() * 0.04;
  const small = 0.02 + random() * 0.025;
  const twistX = random() < 0.5 ? 1 : -1;
  const twistY = random() < 0.5 ? 1 : -1;
  const warp = (u: number, v: number): Point => [
    (u + big * Math.sin(TAU * (v + p[0]!)) + small * Math.sin(TAU * (2 * u + twistX * v + p[1]!))) *
      t,
    (v + big * Math.sin(TAU * (u + p[2]!)) + small * Math.sin(TAU * (2 * v + twistY * u + p[3]!))) *
      t,
  ];
  const steps = 8;
  ctx.fillStyle = square;
  for (let j = -2; j <= across + 1; j += 1) {
    for (let i = -2; i <= across + 1; i += 1) {
      if (mod(i + j, 2) !== 1) continue;
      const u0 = i / across;
      const v0 = j / across;
      const size = 1 / across;
      ctx.beginPath();
      for (let s = 0; s <= steps; s += 1) {
        const [x, y] = warp(u0 + (s / steps) * size, v0);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let s = 1; s <= steps; s += 1) ctx.lineTo(...warp(u0 + size, v0 + (s / steps) * size));
      for (let s = 1; s <= steps; s += 1)
        ctx.lineTo(...warp(u0 + size - (s / steps) * size, v0 + size));
      for (let s = 1; s < steps; s += 1) ctx.lineTo(...warp(u0, v0 + size - (s / steps) * size));
      ctx.closePath();
      ctx.fill();
    }
  }
};

// --- tiger stripe -----------------------------------------------------------

const tiger: Painter = (ctx, t, colors, seed) => {
  const [bg, stripe, under] = colors as [string, string, string];
  ground(ctx, t, bg);

  const blade = (
    random: () => number,
    x0: number,
    y0: number,
    length: number,
    thick: number,
    tilt: number,
  ) => {
    const wobble = random() * TAU;
    const swing = (random() - 0.5) * t * 0.12;
    const skew = 0.35 + random() * 0.3;
    const steps = 18;
    const top: Point[] = [];
    const bottom: Point[] = [];
    for (let s = 0; s <= steps; s += 1) {
      const along = s / steps;
      const centre = swing * Math.sin(along * Math.PI * 1.5 + wobble) + tilt * along * length;
      const profile = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(along, skew * 2))), 0.75);
      const half = thick * profile * (0.85 + 0.3 * Math.sin(along * 9 + wobble));
      top.push([x0 + along * length, y0 + centre - half]);
      bottom.push([x0 + along * length, y0 + centre + half * 0.8]);
    }
    ctx.beginPath();
    top.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    bottom.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
  };

  const layer = (color: string, dx: number, dy: number, grow: number) => {
    wrap(ctx, t, () => {
      const random = mulberry32(hashSeed(seed, 51));
      ctx.fillStyle = color;
      const rows = 7;
      for (let row = 0; row < rows; row += 1) {
        let x = random() * t * 0.4 - t * 0.2;
        while (x < t * 0.98) {
          const length = t * (0.22 + random() * 0.5);
          const y = ((row + 0.5 + (random() - 0.5) * 0.7) / rows) * t;
          const thick = t * (0.016 + random() * 0.03) * grow;
          const tilt = (random() - 0.5) * 0.18;
          blade(random, x + dx, y + dy, length, thick, tilt);
          if (random() < 0.4) {
            // a fork splitting off the main stripe
            blade(
              random,
              x + dx + length * 0.3,
              y + dy + thick * 1.4,
              length * 0.5,
              thick * 0.6,
              0.12,
            );
          }
          x += length * (0.72 + random() * 0.4);
        }
      }
    });
  };
  layer(under, t * 0.012, t * 0.02, 1.25);
  layer(stripe, 0, 0, 1);
};

// --- crown repeat -----------------------------------------------------------

function crown(
  ctx: Ctx2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  points: 3 | 5,
  gold: string,
  jewel: string,
  bg: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.fillStyle = gold;
  const tips: Point[] =
    points === 3
      ? [
          [-0.5, -0.24],
          [0, -0.44],
          [0.5, -0.24],
        ]
      : [
          [-0.5, -0.2],
          [-0.25, -0.34],
          [0, -0.46],
          [0.25, -0.34],
          [0.5, -0.2],
        ];
  ctx.beginPath();
  ctx.moveTo(-0.44, 0.2);
  tips.forEach(([tx, ty], index) => {
    ctx.lineTo(tx, ty);
    const next = tips[index + 1];
    if (next) ctx.lineTo((tx + next[0]) / 2, points === 5 ? -0.07 : 0.02);
  });
  ctx.lineTo(0.44, 0.2);
  ctx.closePath();
  ctx.fill();
  for (const [tx, ty] of tips) dot(ctx, tx, ty - 0.03, 0.065);
  // band
  ctx.fillRect(-0.46, 0.24, 0.92, 0.15);
  ctx.fillStyle = bg;
  ctx.fillRect(-0.46, 0.2, 0.92, 0.04);
  ctx.fillStyle = jewel;
  for (const jx of [-0.28, 0, 0.28]) {
    ctx.beginPath();
    ctx.moveTo(jx, 0.255);
    ctx.lineTo(jx + 0.07, 0.315);
    ctx.lineTo(jx, 0.375);
    ctx.lineTo(jx - 0.07, 0.315);
    ctx.closePath();
    ctx.fill();
  }
  dot(ctx, 0, -0.1, 0.07);
  ctx.restore();
}

function spark(ctx: Ctx2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  for (let corner = 0; corner < 8; corner += 1) {
    const reach = corner % 2 === 0 ? radius : radius * 0.28;
    const angle = (corner / 8) * TAU;
    const px = x + Math.cos(angle) * reach;
    const py = y + Math.sin(angle) * reach;
    if (corner === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

const crowns: Painter = (ctx, t, colors, seed) => {
  const [bg, gold, jewel] = colors as [string, string, string];
  ground(ctx, t, bg);
  wrap(ctx, t, () => {
    const random = mulberry32(hashSeed(seed, 61));
    const big: 3 | 5 = random() < 0.5 ? 3 : 5;
    const little: 3 | 5 = random() < 0.5 ? 3 : 5;
    const tilt = (random() - 0.5) * 0.7;
    const upsideDown = random() < 0.5 ? Math.PI : 0;
    crown(ctx, t * 0.25, t * 0.27, t * 0.36, tilt, big, gold, jewel, bg);
    crown(ctx, t * 0.75, t * 0.77, t * 0.36, -tilt, big, gold, jewel, bg);
    crown(ctx, t * 0.75, t * 0.25, t * 0.2, upsideDown + tilt * 1.6, little, jewel, gold, bg);
    crown(ctx, t * 0.25, t * 0.75, t * 0.2, upsideDown - tilt * 1.6, little, jewel, gold, bg);
    ctx.fillStyle = gold;
    for (let index = 0; index < 7; index += 1) {
      const along = random();
      const onColumn = index % 2 === 0;
      const x = onColumn
        ? (index % 4 === 0 ? 0 : 0.5) * t + (random() - 0.5) * t * 0.08
        : along * t;
      const y = onColumn
        ? along * t
        : (index % 4 === 1 ? 0 : 0.5) * t + (random() - 0.5) * t * 0.08;
      spark(ctx, x, y, t * (0.018 + random() * 0.026));
    }
  });
};

// --- paint drip -------------------------------------------------------------

const drip: Painter = (ctx, t, colors, seed) => {
  const [bg, first, second] = colors as [string, string, string];
  ground(ctx, t, bg);
  const band = t * 0.1;
  const paints = [first, second];

  for (let r = -1; r <= 2; r += 1) {
    const row = mod(r, 2);
    const paint = paints[row]!;
    const y0 = (r * t) / 2;
    const shine = mixHex(paint, "#ffffff", 0.55);
    const random = mulberry32(hashSeed(seed, 71, row));
    const count = 5 + Math.floor(random() * 3);
    const drips = Array.from({ length: count }, (_, index) => ({
      x: ((index + 0.15 + random() * 0.7) / count) * t,
      width: t * (0.032 + random() * 0.04),
      length: t * (random() < 0.3 ? 0.02 + random() * 0.05 : 0.08 + random() * 0.22),
      drop: random() < 0.3 ? t * (0.03 + random() * 0.05) : 0,
    }));

    ctx.fillStyle = paint;
    ctx.fillRect(-1, y0 - 1, t + 2, band + 1);
    for (const shift of [-t, 0, t]) {
      for (const one of drips) {
        const x = one.x + shift;
        const half = one.width / 2;
        const top = y0 + band - 1;
        const end = top + one.length;
        const fillet = half * 1.5;
        const bulb = half * 1.28;
        ctx.fillStyle = paint;
        ctx.beginPath();
        ctx.moveTo(x - half - fillet, top);
        ctx.quadraticCurveTo(x - half, top, x - half, top + fillet);
        ctx.lineTo(x - half, end);
        ctx.bezierCurveTo(
          x - bulb * 1.15,
          end + bulb * 0.6,
          x - bulb,
          end + bulb * 1.9,
          x,
          end + bulb * 1.9,
        );
        ctx.bezierCurveTo(
          x + bulb,
          end + bulb * 1.9,
          x + bulb * 1.15,
          end + bulb * 0.6,
          x + half,
          end,
        );
        ctx.lineTo(x + half, top + fillet);
        ctx.quadraticCurveTo(x + half, top, x + half + fillet, top);
        ctx.closePath();
        ctx.fill();
        if (one.drop > 0 && band + one.length + bulb * 1.9 + one.drop + half * 1.4 < t * 0.47) {
          const dy = end + bulb * 1.9 + one.drop;
          ctx.beginPath();
          ctx.moveTo(x, dy - half * 1.5);
          ctx.bezierCurveTo(
            x + half * 1.1,
            dy,
            x + half * 0.8,
            dy + half * 1.3,
            x,
            dy + half * 1.3,
          );
          ctx.bezierCurveTo(
            x - half * 0.8,
            dy + half * 1.3,
            x - half * 1.1,
            dy,
            x,
            dy - half * 1.5,
          );
          ctx.fill();
        }
        // wet shine down one side of the drip
        ctx.strokeStyle = shine;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, half * 0.32);
        ctx.beginPath();
        ctx.moveTo(x - half * 0.38, top + fillet * 0.6);
        ctx.lineTo(x - half * 0.38, end + bulb * 0.5);
        ctx.stroke();
        ctx.fillStyle = shine;
        dot(ctx, x - bulb * 0.3, end + bulb * 1.15, half * 0.22);
      }
    }
    ctx.fillStyle = shine;
    ctx.fillRect(-1, y0 + band * 0.22, t + 2, Math.max(1, band * 0.1));
    ctx.fillStyle = mixHex(paint, "#000000", 0.3);
    ctx.fillRect(-1, y0 - 1, t + 2, Math.max(1, band * 0.09) + 1);
  }
};

// --- camo -------------------------------------------------------------------

const camo: Painter = (ctx, t, colors, seed) => {
  ground(ctx, t, colors[0]!);
  wrap(ctx, t, () => {
    const random = mulberry32(hashSeed(seed, 81));
    for (let layer = 1; layer < colors.length; layer += 1) {
      ctx.fillStyle = colors[layer]!;
      const blobs = layer === colors.length - 1 ? 6 : 8;
      for (let blob = 0; blob < blobs; blob += 1) {
        const cx = random() * t;
        const cy = random() * t;
        const radius = t * (0.07 + random() * 0.11) * (layer === colors.length - 1 ? 0.75 : 1);
        const stretch = 1 + random() * 1.1;
        const turn = random() * TAU;
        const corners = 8 + Math.floor(random() * 4);
        const points: Point[] = [];
        for (let corner = 0; corner < corners; corner += 1) {
          const angle = (corner / corners) * TAU;
          const reach = radius * (0.55 + random() * 0.85);
          const px = Math.cos(angle) * reach * stretch;
          const py = Math.sin(angle) * reach;
          points.push([
            cx + px * Math.cos(turn) - py * Math.sin(turn),
            cy + px * Math.sin(turn) + py * Math.cos(turn),
          ]);
        }
        smoothClosed(ctx, points);
        ctx.fill();
      }
    }
  });
};

// --- halftone dots ----------------------------------------------------------

const halftone: Painter = (ctx, t, colors, seed) => {
  const [bg, ink, second] = colors as [string, string, string];
  ground(ctx, t, bg);
  const random = mulberry32(hashSeed(seed, 91));
  const p = [random(), random(), random(), random(), random(), random()];
  const fx = 1 + Math.floor(random() * 2);
  const fy = 1 + Math.floor(random() * 2);
  const field = (u: number, v: number, shift: number) => {
    const wave =
      0.55 * Math.sin(TAU * (fx * u + p[shift]!)) * Math.cos(TAU * (fy * v + p[shift + 1]!)) +
      0.45 * Math.sin(TAU * (u + v + p[shift + 2]!));
    return Math.min(1, Math.max(0, 0.5 + 0.62 * wave));
  };

  // a second, coarser screen underneath, like a misregistered print
  const coarse = 8;
  const coarseStep = t / coarse;
  ctx.fillStyle = second;
  for (let j = -1; j <= coarse; j += 1) {
    for (let i = -1; i <= coarse; i += 1) {
      const u = (i + 0.5) / coarse;
      const v = (j + 0.5) / coarse;
      dot(ctx, u * t, v * t, coarseStep * 0.56 * Math.pow(field(u, v, 3), 1.2));
    }
  }

  const fine = 11;
  const step = t / fine;
  ctx.fillStyle = ink;
  for (let j = -1; j <= fine; j += 1) {
    for (let i = -1; i <= fine; i += 1) {
      for (const half of [0, 0.5]) {
        const u = (i + half) / fine;
        const v = (j + half) / fine;
        dot(ctx, u * t, v * t, step * 0.43 * Math.pow(field(mod(u, 1), mod(v, 1), 0), 0.8));
      }
    }
  }
};

// --- razor zigzag -----------------------------------------------------------

const razor: Painter = (ctx, t, colors, seed) => {
  ground(ctx, t, colors[0]!);
  const random = mulberry32(hashSeed(seed, 101));
  const rows = colors.length * 2;
  const teeth = 5 + Math.floor(random() * 4);
  const tooth = t / teeth;
  const weights = Array.from({ length: rows }, () => 0.35 + random() * 1.5);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const tops: number[] = [];
  let run = 0;
  for (const weight of weights) {
    tops.push((run / total) * t);
    run += weight;
  }
  const bite = Array.from({ length: rows }, () => t * (0.05 + random() * 0.11));
  const skew = Array.from({ length: rows }, () => (random() < 0.45 ? 0.5 : 0.12 + random() * 0.76));
  const rowTop = (r: number) => tops[mod(r, rows)]! + Math.floor(r / rows) * t;

  for (let r = -rows; r < rows * 2; r += 1) {
    const row = mod(r, rows);
    const y = rowTop(r);
    const depth = bite[row]!;
    const peak = skew[row]!;
    const line = () => {
      ctx.moveTo(-tooth, y);
      for (let k = -1; k <= teeth; k += 1) {
        ctx.lineTo((k + peak) * tooth, y - depth);
        ctx.lineTo((k + 1) * tooth, y);
      }
    };
    ctx.fillStyle = colors[row % colors.length]!;
    ctx.beginPath();
    line();
    ctx.lineTo(t + tooth, y + t);
    ctx.lineTo(-tooth, y + t);
    ctx.closePath();
    ctx.fill();
    // the ground edge of the blade
    ctx.strokeStyle = mixHex(colors[row % colors.length]!, "#ffffff", 0.5);
    ctx.lineWidth = Math.max(1, t * 0.006);
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.save();
    ctx.translate(0, t * 0.012);
    line();
    ctx.restore();
    ctx.stroke();
  }
};

export const PAINTERS: Record<PatternId, Painter> = {
  "chain-link": chainLink,
  "barbed-wire": barbedWire,
  bandana,
  flames,
  checker,
  "warp-checker": warpChecker,
  tiger,
  crowns,
  drip,
  camo,
  halftone,
  razor,
};
