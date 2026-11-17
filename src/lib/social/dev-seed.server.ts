import { getSql } from "../db.ts";
import { getPodProvider } from "../pod/index.ts";
import { readStudioConfig } from "../studio/shared.server.ts";
import { generateMockup, publishDesign, saveDesign } from "../studio/designs.server.ts";

/**
 * Fills an empty local database with a handful of makers and published pieces so the
 * rack, maker pages and battles have something to draw while they are being built.
 *
 * It only runs when SR_DEV_SEED=1 and printing is in sandbox. Production never sets
 * that variable, so none of this can reach a real shop. The makers are placeholders
 * and say so in their names.
 */

export function devSeedEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SR_DEV_SEED === "1" && readStudioConfig().podMode === "sandbox";
}

const MAKERS = [
  {
    id: "seed-ada",
    handle: "ada",
    name: "Ada (preview)",
    bio: "Placeholder maker. Loud colours, louder words.",
  },
  {
    id: "seed-bo",
    handle: "bo",
    name: "Bo (preview)",
    bio: "Placeholder maker. Second chances on heavy cotton.",
  },
  {
    id: "seed-cy",
    handle: "cy",
    name: "Cy (preview)",
    bio: "Placeholder maker. Clash on purpose.",
  },
  { id: "seed-dee", handle: "dee", name: "Dee (preview)", bio: "" },
] as const;

type SeedPiece = {
  maker: (typeof MAKERS)[number]["id"];
  title: string;
  /** Matched against the catalog product type or name, lower case. */
  blank: string;
  /** Which of the blank's colours to use, by position. */
  color: number;
  lines: {
    text: string;
    color: string;
    y: number;
    scale: number;
    rotation: number;
    font?: string;
  }[];
};

const PIECES: SeedPiece[] = [
  {
    maker: "seed-ada",
    title: "Do Better Hoodie",
    blank: "hoodie",
    color: 0,
    lines: [
      { text: "DO BETTER", color: "#d6ff3c", y: 0.38, scale: 1.2, rotation: -6 },
      {
        text: "look fly doing it",
        color: "#ff2d95",
        y: 0.58,
        scale: 0.6,
        rotation: -6,
        font: "Outfit",
      },
    ],
  },
  {
    maker: "seed-ada",
    title: "Crown Heavy Tee",
    blank: "tee",
    color: 2,
    lines: [{ text: "CROWN HEAVY", color: "#17101f", y: 0.42, scale: 1.1, rotation: 4 }],
  },
  {
    maker: "seed-ada",
    title: "Night Shift Crew",
    blank: "crew",
    color: 2,
    lines: [
      { text: "NIGHT SHIFT", color: "#ff9a3c", y: 0.4, scale: 1, rotation: 0 },
      {
        text: "est. after dark",
        color: "#f6f1ff",
        y: 0.56,
        scale: 0.5,
        rotation: 0,
        font: "Outfit",
      },
    ],
  },
  {
    maker: "seed-bo",
    title: "Second Act Tee",
    blank: "tee",
    color: 0,
    lines: [
      { text: "SECOND ACT", color: "#a5dccb", y: 0.36, scale: 1.1, rotation: -3 },
      { text: "NO ENCORE NEEDED", color: "#ff2d95", y: 0.52, scale: 0.55, rotation: -3 },
    ],
  },
  {
    maker: "seed-bo",
    title: "Paid In Full Hat",
    blank: "hat",
    color: 0,
    lines: [{ text: "PAID", color: "#d6ff3c", y: 0.5, scale: 1, rotation: 0 }],
  },
  {
    maker: "seed-bo",
    title: "Free World Hoodie",
    blank: "hoodie",
    color: 1,
    lines: [{ text: "FREE WORLD", color: "#7c5cff", y: 0.4, scale: 1.15, rotation: 8 }],
  },
  {
    maker: "seed-cy",
    title: "Clash Royale Tee",
    blank: "tee",
    color: 2,
    lines: [
      { text: "CLASH", color: "#d6ff3c", y: 0.34, scale: 1.4, rotation: -12 },
      { text: "ON PURPOSE", color: "#3c6bff", y: 0.56, scale: 0.8, rotation: 9 },
    ],
  },
  {
    maker: "seed-cy",
    title: "Wrong Colors Crew",
    blank: "crew",
    color: 1,
    lines: [
      { text: "WRONG COLORS", color: "#ff2d95", y: 0.4, scale: 1, rotation: 0 },
      { text: "RIGHT ATTITUDE", color: "#1c8f5a", y: 0.56, scale: 0.7, rotation: 0 },
    ],
  },
  {
    maker: "seed-cy",
    title: "Loud Pack Hoodie",
    blank: "hoodie",
    color: 2,
    lines: [{ text: "LOUD", color: "#ff2d95", y: 0.42, scale: 1.6, rotation: -4 }],
  },
  {
    maker: "seed-dee",
    title: "Quiet Money Tee",
    blank: "tee",
    color: 1,
    lines: [
      { text: "quiet money", color: "#17101f", y: 0.44, scale: 0.9, rotation: 0, font: "Outfit" },
    ],
  },
  {
    maker: "seed-dee",
    title: "Royal Blue Crown Tee",
    blank: "tee",
    color: 3,
    lines: [{ text: "ROYALTY", color: "#f5ebdd", y: 0.4, scale: 1.2, rotation: -5 }],
  },
];

/** A transparent PNG big enough to pass the print check. */
async function blankPrintFile(width: number, height: number): Promise<string> {
  const { crc32, deflateSync } = await import("node:zlib");
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function runDevSeed(): Promise<{ seeded: boolean; makers: number; pieces: number }> {
  if (!devSeedEnabled()) throw new Error("Seeding is off.");
  const sql = await getSql();
  const existing = await sql<{ count: number }>`
    select count(*)::int as count from designs where user_id like 'seed-%'
  `;
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { seeded: false, makers: MAKERS.length, pieces: Number(existing[0]?.count ?? 0) };
  }

  for (const maker of MAKERS) {
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified")
      values (${maker.id}, ${maker.name}, ${`${maker.id}@example.com`}, true)
      on conflict ("id") do nothing
    `;
    await sql`
      insert into profiles (user_id, handle, display_name, bio)
      values (${maker.id}, ${maker.handle}, ${maker.name}, ${maker.bio})
      on conflict (user_id) do nothing
    `;
  }

  const catalog = await getPodProvider().listProducts({ offset: 0, limit: 48 });
  const printFile = await blankPrintFile(1800, 2400);
  const ids: { id: string; maker: string }[] = [];

  for (const piece of PIECES) {
    const summary =
      catalog.products.find((item) =>
        `${item.type} ${item.name}`.toLowerCase().includes(piece.blank),
      ) ?? catalog.products[0];
    if (!summary) continue;
    const product = await getPodProvider().getProduct(summary.id);
    const color = product.colors[piece.color % Math.max(1, product.colors.length)];
    const variant =
      product.variants.find((item) => item.color === color?.name && item.size === "M") ??
      product.variants.find((item) => item.color === color?.name) ??
      product.variants[0];
    if (!variant) continue;
    const placement = product.placements[0]?.placement ?? "front";
    const layers = piece.lines.map((line, index) => ({
      id: `line-${index}`,
      type: "text",
      text: line.text,
      font: line.font ?? "Archivo Black",
      color: line.color,
      x: 0.5,
      y: line.y,
      scale: line.scale,
      rotation: line.rotation,
    }));
    const mockup = await generateMockup({
      productId: product.id,
      variantId: variant.id,
      placement,
      layers,
    });
    const saved = await saveDesign(piece.maker, {
      title: piece.title,
      productId: product.id,
      variantId: variant.id,
      placement,
      layers,
      printFile,
      mockupUrl: mockup.mockupUrl,
    });
    await publishDesign(piece.maker, saved.id);
    ids.push({ id: saved.id, maker: piece.maker });
  }

  // Spread some crowns, follows and one remix so nothing reads as zero.
  const crowners = MAKERS.map((maker) => maker.id);
  for (const [index, piece] of ids.entries()) {
    for (const [who, user] of crowners.entries()) {
      if (user === piece.maker) continue;
      if ((index + who) % 3 === 0 || index % 4 === 0) {
        await sql`
          insert into crowns (user_id, design_id) values (${user}, ${piece.id})
          on conflict do nothing
        `;
      }
    }
  }
  await sql`insert into follows (follower_id, maker_id) values ('seed-bo', 'seed-ada'), ('seed-cy', 'seed-ada'), ('seed-dee', 'seed-ada'), ('seed-ada', 'seed-cy'), ('seed-dee', 'seed-cy') on conflict do nothing`;
  const root = ids[0];
  const child = ids[8];
  const grandchild = ids[10];
  if (root && child) {
    await sql`insert into design_lineage (design_id, parent_id, root_id) values (${child.id}, ${root.id}, ${root.id}) on conflict do nothing`;
    if (grandchild) {
      await sql`insert into design_lineage (design_id, parent_id, root_id) values (${grandchild.id}, ${child.id}, ${root.id}) on conflict do nothing`;
    }
  }

  return { seeded: true, makers: MAKERS.length, pieces: ids.length };
}
