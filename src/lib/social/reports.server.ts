import { getSql } from "../db.ts";
import { isStudioAdmin } from "../studio/admin.ts";
import {
  NOTE_LIMIT,
  REPORT_MESSAGES,
  cleanNote,
  isReportReason,
  noteLength,
  tallyReasons,
  type FileReportResult,
  type ReportAction,
  type ReportGroup,
  type ReportKind,
  type ReportQueue,
  type ReportReason,
} from "../../components/reports/reasons.ts";

/**
 * Reports. Anyone signed in can flag a piece or a maker; the people who run the
 * shop decide what happens. Nothing here hides anything by count, and nothing
 * deletes an account.
 *
 * The caller is always the verified user id from the session. The target comes in
 * as the public slug or handle and is looked up here, so no id from a browser is
 * ever trusted.
 */

/** The most reports one person can file in a day, across every target. */
export const DAILY_REPORT_CEILING = 20;

/** The queue shows this many open reports at most, oldest first. */
const QUEUE_LIMIT = 400;

export type FileReportInput = {
  kind?: unknown;
  slug?: unknown;
  handle?: unknown;
  reason?: unknown;
  note?: unknown;
};

async function isAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  return isStudioAdmin(rows[0]?.email, process.env.STUDIO_ADMIN_EMAILS);
}

async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new Error(REPORT_MESSAGES.staffOnly);
}

export async function readReportsAccess(userId: string): Promise<{ admin: boolean }> {
  return { admin: await isAdmin(userId) };
}

/** Find what is being reported, and refuse a person reporting their own work or themselves. */
async function resolveTarget(
  userId: string,
  input: FileReportInput,
): Promise<{ kind: ReportKind; targetId: string }> {
  const sql = await getSql();
  if (input.kind === "piece") {
    const slug = String(input.slug ?? "")
      .trim()
      .slice(0, 140);
    const rows = slug
      ? await sql<{ id: string; user_id: string }>`
          select id, user_id from designs where slug = ${slug} and status = 'published'
        `
      : [];
    const piece = rows[0];
    if (!piece) throw new Error(REPORT_MESSAGES.noPiece);
    if (piece.user_id === userId) throw new Error(REPORT_MESSAGES.ownPiece);
    return { kind: "piece", targetId: piece.id };
  }
  if (input.kind === "maker") {
    const handle = String(input.handle ?? "")
      .trim()
      .replace(/^@/, "")
      .slice(0, 60)
      .toLowerCase();
    const rows = handle
      ? await sql<{ user_id: string }>`
          select user_id from profiles where lower(handle) = ${handle}
        `
      : [];
    const maker = rows[0];
    if (!maker) throw new Error(REPORT_MESSAGES.noMaker);
    if (maker.user_id === userId) throw new Error(REPORT_MESSAGES.yourself);
    return { kind: "maker", targetId: maker.user_id };
  }
  throw new Error("Report a piece or a maker.");
}

/** File one report. A second report on the same target by the same person changes nothing. */
export async function fileReport(
  userId: string,
  input: FileReportInput,
  now: Date = new Date(),
): Promise<FileReportResult> {
  if (!isReportReason(input.reason)) throw new Error(REPORT_MESSAGES.pickReason);
  const reason: ReportReason = input.reason;
  const note = cleanNote(input.note);
  if (noteLength(note) > NOTE_LIMIT) throw new Error(REPORT_MESSAGES.noteTooLong);

  const target = await resolveTarget(userId, input);
  const sql = await getSql();

  const seen = await sql<{ id: string }>`
    select id from reports
    where reporter_id = ${userId} and kind = ${target.kind} and target_id = ${target.targetId}
      and status = 'open'
  `;
  if (seen.length > 0) return { status: "already" };

  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const today = await sql<{ n: number }>`
    select count(*)::int as n from reports
    where reporter_id = ${userId} and created_at > ${since}::timestamptz
  `;
  if (Number(today[0]?.n ?? 0) >= DAILY_REPORT_CEILING) throw new Error(REPORT_MESSAGES.tooMany);
  // Reports sent in parallel all read the count above before any is written. The
  // allowance is taken in one statement, which they cannot race past.
  const { takeQuota, windowKey } = await import("./quota.server.ts");
  const allowed = await takeQuota(sql, {
    userId,
    action: "report",
    window: windowKey(now, "day"),
    limit: DAILY_REPORT_CEILING,
  });
  if (!allowed) throw new Error(REPORT_MESSAGES.tooMany);

  // Two taps at once race past the check above. The unique key settles it.
  const inserted = await sql<{ id: string }>`
    insert into reports (id, reporter_id, kind, target_id, reason, note, created_at)
    values (
      ${crypto.randomUUID()}, ${userId}, ${target.kind}, ${target.targetId},
      ${reason}, ${note}, ${now.toISOString()}::timestamptz
    )
    on conflict (reporter_id, kind, target_id) where status = 'open' do nothing
    returning id
  `;
  return { status: inserted.length > 0 ? "filed" : "already" };
}

type OpenRow = {
  id: string;
  kind: string;
  target_id: string;
  reason: string;
  note: string;
  created_at: string | Date;
  reporter_handle: string | null;
  piece_slug: string | null;
  piece_title: string | null;
  piece_status: string | null;
  piece_maker_handle: string | null;
  piece_maker_name: string | null;
  maker_handle: string | null;
  maker_name: string | null;
  maker_bio: string | null;
};

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

/** Every open report, piled by target. Biggest pile first, then the one waiting longest. */
export async function listReports(userId: string): Promise<ReportQueue> {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<OpenRow>`
    select
      r.id, r.kind, r.target_id, r.reason, r.note, r.created_at,
      rp.handle as reporter_handle,
      d.slug as piece_slug, d.title as piece_title, d.status as piece_status,
      dp.handle as piece_maker_handle, dp.display_name as piece_maker_name,
      mp.handle as maker_handle, mp.display_name as maker_name, mp.bio as maker_bio
    from reports r
    left join profiles rp on rp.user_id = r.reporter_id
    left join designs d on r.kind = 'piece' and d.id = r.target_id
    left join profiles dp on dp.user_id = d.user_id
    left join profiles mp on r.kind = 'maker' and mp.user_id = r.target_id
    where r.status = 'open'
    order by r.created_at asc, r.id asc
    limit ${QUEUE_LIMIT}
  `;

  const piles = new Map<string, OpenRow[]>();
  for (const row of rows) {
    const key = `${row.kind}:${row.target_id}`;
    const pile = piles.get(key);
    if (pile) pile.push(row);
    else piles.set(key, [row]);
  }

  // Mockups can be large, so they are read once per piece and not once per report.
  const pieceIds = [...piles.values()]
    .map((pile) => pile[0])
    .filter((row): row is OpenRow => Boolean(row && row.kind === "piece" && row.piece_slug))
    .map((row) => row.target_id);
  const mockups = new Map<string, string | null>();
  if (pieceIds.length > 0) {
    const found = await sql<{ id: string; mockup_url: string | null }>`
      select id, mockup_url from designs
      where id = any(string_to_array(${pieceIds.join(",")}, ','))
    `;
    for (const item of found) mockups.set(item.id, item.mockup_url);
  }

  const groups: ReportGroup[] = [];
  for (const pile of piles.values()) {
    const first = pile[0];
    const last = pile[pile.length - 1];
    if (!first || !last) continue;
    const kind: ReportKind = first.kind === "maker" ? "maker" : "piece";
    groups.push({
      ticket: first.id,
      kind,
      count: pile.length,
      firstAt: iso(first.created_at),
      lastAt: iso(last.created_at),
      reasons: tallyReasons(pile.map((row) => row.reason)),
      slips: pile.map((row) => ({
        reason: isReportReason(row.reason) ? row.reason : "other",
        note: row.note,
        by: row.reporter_handle,
        at: iso(row.created_at),
      })),
      piece:
        kind === "piece" && first.piece_slug
          ? {
              slug: first.piece_slug,
              title: first.piece_title ?? "",
              mockupUrl: mockups.get(first.target_id) ?? null,
              onRack: first.piece_status === "published",
              maker:
                first.piece_maker_handle != null
                  ? {
                      handle: first.piece_maker_handle,
                      name: first.piece_maker_name ?? first.piece_maker_handle,
                    }
                  : null,
            }
          : null,
      maker:
        kind === "maker" && first.maker_handle != null
          ? {
              handle: first.maker_handle,
              name: first.maker_name ?? first.maker_handle,
              bio: first.maker_bio ?? "",
            }
          : null,
    });
  }
  groups.sort((a, b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt));
  return { groups, open: rows.length };
}

export type ResolveReportResult = {
  kind: ReportKind;
  action: ReportAction;
  /** How many open reports this settled. */
  settled: number;
  /** True when a piece left the rack or a bio was cleared just now. */
  changed: boolean;
};

/**
 * Settle every open report on one target. The target is read from the report the
 * admin was looking at, never from an id in the request.
 *
 * Piece: "remove" puts the design back to draft, "keep" leaves it up.
 * Maker: "remove" clears the bio, "keep" leaves it. Accounts are never deleted.
 */
export async function resolveReport(
  userId: string,
  input: { ticket?: unknown; action?: unknown },
): Promise<ResolveReportResult> {
  await requireAdmin(userId);
  if (input.action !== "remove" && input.action !== "keep") {
    throw new Error("Pick what to do with it.");
  }
  const action: ReportAction = input.action;
  const status = action === "remove" ? "removed" : "kept";
  const sql = await getSql();

  const ticket = String(input.ticket ?? "").slice(0, 80);
  const found = await sql<{ kind: string; target_id: string }>`
    select kind, target_id from reports where id = ${ticket}
  `;
  const report = found[0];
  if (!report) throw new Error(REPORT_MESSAGES.gone);
  const kind: ReportKind = report.kind === "maker" ? "maker" : "piece";
  const targetId = report.target_id;
  const takeDown = action === "remove" && kind === "piece";
  const clearBio = action === "remove" && kind === "maker";

  // One statement, so the reports and the thing they are about change together or not at all.
  // Nothing is touched unless there was an open report to settle.
  const rows = await sql<{ settled: number; pulled: number; cleared: number }>`
    with settled as (
      update reports
      set status = ${status}, resolved_at = now(), resolved_by = ${userId}
      where kind = ${kind} and target_id = ${targetId} and status = 'open'
      returning id
    ),
    pulled as (
      update designs
      set status = 'draft', updated_at = now()
      where ${takeDown}::boolean and id = ${targetId} and status = 'published'
        and exists (select 1 from settled)
      returning id
    ),
    cleared as (
      update profiles
      set bio = ''
      where ${clearBio}::boolean and user_id = ${targetId} and bio <> ''
        and exists (select 1 from settled)
      returning user_id
    )
    select
      (select count(*) from settled)::int as settled,
      (select count(*) from pulled)::int as pulled,
      (select count(*) from cleared)::int as cleared
  `;
  const settled = Number(rows[0]?.settled ?? 0);
  if (settled === 0) throw new Error(REPORT_MESSAGES.settled);
  return {
    kind,
    action,
    settled,
    changed: Number(rows[0]?.pulled ?? 0) + Number(rows[0]?.cleared ?? 0) > 0,
  };
}
