import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";
import { DAILY_SCAN_CEILING, readScans, recordScan } from "./scans.server.ts";

const NOON = new Date("2026-11-17T12:00:00Z");

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
});

describe("street scans", () => {
  it("counts each scan of a published piece", async () => {
    const piece = await seedDesign("ada", { published: true });
    expect(await readScans(piece.slug, NOON)).toEqual({ total: 0, week: 0 });
    await recordScan(piece.slug, NOON);
    const after = await recordScan(piece.slug, NOON);
    expect(after).toEqual({ total: 2, week: 2 });
    expect(await readScans(piece.slug, NOON)).toEqual({ total: 2, week: 2 });
  });

  it("keeps old scans in the total and out of the week", async () => {
    const piece = await seedDesign("ada", { published: true });
    await recordScan(piece.slug, new Date("2026-11-01T09:00:00Z"));
    await recordScan(piece.slug, new Date("2026-11-11T00:00:00Z"));
    await recordScan(piece.slug, new Date("2026-11-10T23:59:59Z"));
    await recordScan(piece.slug, NOON);
    expect(await readScans(piece.slug, NOON)).toEqual({ total: 4, week: 2 });
  });

  it("counts nothing for a draft or a slug that does not exist", async () => {
    const draft = await seedDesign("ada", { title: "Not out yet" });
    expect(await recordScan(draft.slug, NOON)).toEqual({ total: 0, week: 0 });
    expect(await recordScan("no-such-piece", NOON)).toEqual({ total: 0, week: 0 });
    expect(await recordScan("", NOON)).toEqual({ total: 0, week: 0 });
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from tag_scans`;
    expect(rows[0]?.n).toBe(0);
  });

  it("stops counting at the daily ceiling, and starts again the next day", async () => {
    const piece = await seedDesign("ada", { published: true });
    const sql = await getSql();
    await sql`
      insert into tag_scans (design_id, day, scans)
      values (${piece.id}, ${"2026-11-17"}, ${DAILY_SCAN_CEILING})
    `;
    expect((await recordScan(piece.slug, NOON)).total).toBe(DAILY_SCAN_CEILING);
    const tomorrow = new Date("2026-11-18T00:00:01Z");
    expect((await recordScan(piece.slug, tomorrow)).total).toBe(DAILY_SCAN_CEILING + 1);
  });

  it("stores a hostile slug as text and finds nothing", async () => {
    await seedDesign("ada", { published: true });
    expect(await recordScan("x'; drop table tag_scans; --", NOON)).toEqual({ total: 0, week: 0 });
    const sql = await getSql();
    expect(await sql`select 1 from tag_scans`).toEqual([]);
  });

  it("drops a piece's scans when the piece is deleted", async () => {
    const piece = await seedDesign("ada", { published: true });
    await recordScan(piece.slug, NOON);
    const sql = await getSql();
    await sql`delete from designs where id = ${piece.id}`;
    const rows = await sql<{ n: number }>`select count(*)::int as n from tag_scans`;
    expect(rows[0]?.n).toBe(0);
  });
});
