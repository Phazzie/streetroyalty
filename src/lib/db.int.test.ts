import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "./db.ts";
import { truncateAll } from "../test/db.ts";

beforeEach(truncateAll);

describe("the database handle", () => {
  it("applies every migration to a fresh database", async () => {
    const sql = await getSql();
    const applied = await sql<{ name: string }>`select name from _migrations order by name`;
    expect(applied.map((row) => row.name)).toEqual([
      "0001_auth.sql",
      "0002_studio.sql",
      "0003_order_flags.sql",
      "0004_ai_usage.sql",
      "0005_garments.sql",
      "0010_social.sql",
      "0011_tag_scans.sql",
      "0012_reports.sql",
      "0013_cart_colorway_lines.sql",
      "0014_action_quotas.sql",
      "0015_checkout_and_runway.sql",
      "0016_garment_identity.sql",
      "0017_design_spots.sql",
    ]);
  });

  it("has the tables and columns the app reads", async () => {
    const sql = await getSql();
    const columns = await sql<{ table_name: string; column_name: string; data_type: string }>`
      select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name <> '_migrations'
      order by table_name, column_name
    `;
    const schema: Record<string, string[]> = {};
    for (const column of columns) {
      (schema[column.table_name] ??= []).push(`${column.column_name}: ${column.data_type}`);
    }
    expect(schema).toMatchSnapshot();
  });

  it("stores a value that looks like SQL as plain text", async () => {
    const sql = await getSql();
    const hostile = "x'); drop table collections; --";
    await sql`insert into collections (id, user_id, name) values (${"c1"}, ${"u1"}, ${hostile})`;
    const rows = await sql<{ name: string }>`select name from collections where id = ${"c1"}`;
    expect(rows[0]?.name).toBe(hostile);
    const survived = await sql<{ n: number }>`select count(*) as n from collections`;
    expect(survived[0]?.n).toBe(1);
  });

  it("returns counts as numbers and dates as plain text on either backend", async () => {
    const sql = await getSql();
    const rows = await sql<{ n: unknown; d: unknown; i: unknown }>`
      select count(*) as n, date '2026-03-01' as d, interval '2 days' as i
    `;
    expect(rows[0]?.n).toBe(0 + 1);
    expect(rows[0]?.d).toBe("2026-03-01");
    expect(rows[0]?.i).toBe("2 days");
    expect(() => JSON.stringify(rows)).not.toThrow();
  });

  it("numbers every value in order, including repeats and nulls", async () => {
    const sql = await getSql();
    const rows = await sql<{ a: string; b: string | null; c: string }>`
      select ${"one"}::text as a, ${null}::text as b, ${"one"}::text as c
    `;
    expect(rows[0]).toEqual({ a: "one", b: null, c: "one" });
  });

  it("accepts a migration pass twice without applying anything again", async () => {
    const sql = await getSql();
    const before = await sql<{ n: number }>`select count(*) as n from _migrations`;
    const again = await getSql();
    const after = await again<{ n: number }>`select count(*) as n from _migrations`;
    expect(after[0]?.n).toBe(before[0]?.n);
  });
});
