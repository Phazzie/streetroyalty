import { getSql } from "../db.ts";

/**
 * Street scans. Every published piece has a QR tag that opens its rack page with
 * `?via=tag`. Each arrival that way is counted here, so a maker can see how often
 * the piece was scanned off somebody's back.
 *
 * Anyone can call this, so it is treated as a rough number: one row per piece per
 * day, with a ceiling a script cannot push past.
 */

/** The most scans one piece can record in a day. Past this the count holds still. */
export const DAILY_SCAN_CEILING = 2000;

export type ScanCount = {
  /** Every scan ever recorded for the piece. */
  total: number;
  /** Scans in the last seven UTC days, today included. */
  week: number;
};

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function publishedId(slug: string): Promise<string | null> {
  const clean = slug.trim().slice(0, 140);
  if (!clean) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from designs where slug = ${clean} and status = 'published'
  `;
  return rows[0]?.id ?? null;
}

async function count(designId: string, now: Date): Promise<ScanCount> {
  const sql = await getSql();
  const since = utcDay(new Date(now.getTime() - 6 * 86_400_000));
  const rows = await sql<{ total: number; week: number }>`
    select
      coalesce(sum(scans), 0)::int as total,
      coalesce(sum(case when day >= ${since} then scans else 0 end), 0)::int as week
    from tag_scans
    where design_id = ${designId}
  `;
  return { total: Number(rows[0]?.total ?? 0), week: Number(rows[0]?.week ?? 0) };
}

/** Count one scan of a published piece. A missing or unpublished piece counts nothing. */
export async function recordScan(slug: string, now: Date = new Date()): Promise<ScanCount> {
  const designId = await publishedId(slug);
  if (!designId) return { total: 0, week: 0 };
  const sql = await getSql();
  await sql`
    insert into tag_scans (design_id, day, scans) values (${designId}, ${utcDay(now)}, 1)
    on conflict (design_id, day)
    do update set scans = tag_scans.scans + 1
    where tag_scans.scans < ${DAILY_SCAN_CEILING}
  `;
  return count(designId, now);
}

export async function readScans(slug: string, now: Date = new Date()): Promise<ScanCount> {
  const designId = await publishedId(slug);
  if (!designId) return { total: 0, week: 0 };
  return count(designId, now);
}
