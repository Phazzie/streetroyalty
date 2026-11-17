import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { getShopDesign, listShop, publishDesign } from "../studio/designs.server.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";
import { REPORT_MESSAGES } from "../../components/reports/reasons.ts";
import {
  DAILY_REPORT_CEILING,
  fileReport,
  listReports,
  readReportsAccess,
  resolveReport,
} from "./reports.server.ts";

const BOSS_EMAIL = "boss@example.com";

async function seedProfile(userId: string, handle: string, bio = ""): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, handle, display_name, bio)
    values (${userId}, ${handle}, ${handle.toUpperCase()}, ${bio})
  `;
}

type ReportRow = {
  id: string;
  reporter_id: string;
  kind: string;
  target_id: string;
  reason: string;
  note: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
};

async function reportRows(): Promise<ReportRow[]> {
  const sql = await getSql();
  return sql<ReportRow>`select * from reports order by created_at asc, id asc`;
}

async function designStatus(id: string): Promise<string | undefined> {
  const sql = await getSql();
  const rows = await sql<{ status: string }>`select status from designs where id = ${id}`;
  return rows[0]?.status;
}

async function bioOf(userId: string): Promise<string | undefined> {
  const sql = await getSql();
  const rows = await sql<{ bio: string }>`select bio from profiles where user_id = ${userId}`;
  return rows[0]?.bio;
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
  await seedUser("cy");
  await seedUser("boss", BOSS_EMAIL);
  await seedProfile("ada", "ada", "Loud colours, louder words.");
  await seedProfile("bo", "bo");
  process.env.STUDIO_ADMIN_EMAILS = BOSS_EMAIL;
});

describe("filing a report", () => {
  it("stores a report on a piece against the design the slug points at", async () => {
    const piece = await seedDesign("ada", { published: true });
    const result = await fileReport("bo", {
      kind: "piece",
      slug: piece.slug,
      reason: "stolen",
      note: "  That is my logo.  ",
    });
    expect(result).toEqual({ status: "filed" });
    const rows = await reportRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reporter_id: "bo",
      kind: "piece",
      target_id: piece.id,
      reason: "stolen",
      note: "That is my logo.",
      status: "open",
      resolved_by: null,
    });
  });

  it("keeps one report per person per target, and says so on a repeat", async () => {
    const piece = await seedDesign("ada", { published: true });
    const input = { kind: "piece", slug: piece.slug, reason: "hate" };
    expect(await fileReport("bo", input)).toEqual({ status: "filed" });
    expect(await fileReport("bo", { ...input, reason: "scam", note: "again" })).toEqual({
      status: "already",
    });
    expect(await fileReport("cy", input)).toEqual({ status: "filed" });
    const rows = await reportRows();
    expect(rows.map((row) => [row.reporter_id, row.reason, row.note])).toEqual([
      ["bo", "hate", ""],
      ["cy", "hate", ""],
    ]);
  });

  it("settles two taps at once into one report", async () => {
    const piece = await seedDesign("ada", { published: true });
    const input = { kind: "piece", slug: piece.slug, reason: "nudity" };
    const results = await Promise.all([fileReport("bo", input), fileReport("bo", input)]);
    expect(results.map((result) => result.status).sort()).toContain("filed");
    expect(await reportRows()).toHaveLength(1);
  });

  it("still says already after the shop has settled the first one", async () => {
    const piece = await seedDesign("ada", { published: true });
    const input = { kind: "piece", slug: piece.slug, reason: "scam" };
    await fileReport("bo", input);
    const queue = await listReports("boss");
    await resolveReport("boss", { ticket: queue.groups[0]?.ticket, action: "keep" });
    expect(await fileReport("bo", input)).toEqual({ status: "already" });
    expect((await listReports("boss")).groups).toEqual([]);
  });

  it("lets a person report a piece and its maker as two separate things", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other" });
    expect(await fileReport("bo", { kind: "maker", handle: "ada", reason: "other" })).toEqual({
      status: "filed",
    });
    expect(await reportRows()).toHaveLength(2);
  });

  it("refuses your own piece", async () => {
    const piece = await seedDesign("ada", { published: true });
    await expect(
      fileReport("ada", { kind: "piece", slug: piece.slug, reason: "other" }),
    ).rejects.toThrow(REPORT_MESSAGES.ownPiece);
    expect(await reportRows()).toHaveLength(0);
  });

  it("refuses reporting yourself, whatever the handle is dressed as", async () => {
    for (const handle of ["ada", "@ada", " ADA "]) {
      await expect(fileReport("ada", { kind: "maker", handle, reason: "hate" })).rejects.toThrow(
        REPORT_MESSAGES.yourself,
      );
    }
    expect(await reportRows()).toHaveLength(0);
  });

  it("finds the maker by handle and never by an id the caller sends", async () => {
    const result = await fileReport("bo", {
      kind: "maker",
      handle: "@Ada",
      reason: "scam",
      // Smuggled fields are not part of the input and change nothing.
      ...({ targetId: "bo", target_id: "bo", reporterId: "cy", userId: "cy" } as object),
    });
    expect(result).toEqual({ status: "filed" });
    const rows = await reportRows();
    expect(rows[0]).toMatchObject({ reporter_id: "bo", kind: "maker", target_id: "ada" });
  });

  it("refuses a draft, a missing piece and a missing maker", async () => {
    const draft = await seedDesign("ada", { title: "Not out yet" });
    await expect(
      fileReport("bo", { kind: "piece", slug: draft.slug, reason: "other" }),
    ).rejects.toThrow(REPORT_MESSAGES.noPiece);
    await expect(
      fileReport("bo", { kind: "piece", slug: "no-such-piece", reason: "other" }),
    ).rejects.toThrow(REPORT_MESSAGES.noPiece);
    await expect(fileReport("bo", { kind: "piece", reason: "other" })).rejects.toThrow(
      REPORT_MESSAGES.noPiece,
    );
    await expect(
      fileReport("bo", { kind: "maker", handle: "nobody", reason: "other" }),
    ).rejects.toThrow(REPORT_MESSAGES.noMaker);
    await expect(fileReport("bo", { kind: "shop", slug: "x", reason: "other" })).rejects.toThrow(
      /piece or a maker/,
    );
    expect(await reportRows()).toHaveLength(0);
  });

  it("refuses a reason that is not on the list and a note past 280 characters", async () => {
    const piece = await seedDesign("ada", { published: true });
    await expect(
      fileReport("bo", { kind: "piece", slug: piece.slug, reason: "because" }),
    ).rejects.toThrow(REPORT_MESSAGES.pickReason);
    await expect(fileReport("bo", { kind: "piece", slug: piece.slug })).rejects.toThrow(
      REPORT_MESSAGES.pickReason,
    );
    await expect(
      fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other", note: "x".repeat(281) }),
    ).rejects.toThrow(REPORT_MESSAGES.noteTooLong);
    expect(await reportRows()).toHaveLength(0);
    await fileReport("bo", {
      kind: "piece",
      slug: piece.slug,
      reason: "other",
      note: "x".repeat(280),
    });
    expect((await reportRows())[0]?.note).toHaveLength(280);
  });

  it("stores hostile note text as the plain text it is", async () => {
    const piece = await seedDesign("ada", { published: true });
    const hostile = `<script>alert(1)</script><img src=x onerror=alert(2)> '); drop table reports; -- \${7*7} {{7*7}}`;
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other", note: hostile });
    const rows = await reportRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.note).toBe(hostile);
    // The queue hands it back untouched as a string. React escapes it on the way to the page.
    const queue = await listReports("boss");
    expect(queue.groups[0]?.slips[0]?.note).toBe(hostile);
    expect(await designStatus(piece.id)).toBe("published");
  });

  it("drops control codes and direction flips from a note and keeps the words", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", {
      kind: "piece",
      slug: piece.slug,
      reason: "other",
      note: "line one\r\nline\u0000 two‮ gnp.exe",
    });
    expect((await reportRows())[0]?.note).toBe("line one line two gnp.exe");
  });

  it("stops one person at the daily ceiling", async () => {
    const sql = await getSql();
    const now = new Date("2026-11-17T12:00:00Z");
    for (let index = 0; index < DAILY_REPORT_CEILING; index += 1) {
      await sql`
        insert into reports (id, reporter_id, kind, target_id, reason, created_at)
        values (${`r${index}`}, ${"bo"}, ${"piece"}, ${`d${index}`}, ${"other"}, ${"2026-11-17T09:00:00Z"}::timestamptz)
      `;
    }
    const piece = await seedDesign("ada", { published: true });
    const input = { kind: "piece", slug: piece.slug, reason: "other" };
    await expect(fileReport("bo", input, now)).rejects.toThrow(REPORT_MESSAGES.tooMany);
    expect(await fileReport("cy", input, now)).toEqual({ status: "filed" });
    const tomorrow = new Date("2026-11-18T09:00:01Z");
    expect(await fileReport("bo", input, tomorrow)).toEqual({ status: "filed" });
  });
});

describe("the queue", () => {
  it("is closed to anyone who does not run the shop", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "stolen" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    for (const who of ["ada", "bo", "cy", "nobody-at-all"]) {
      await expect(listReports(who)).rejects.toThrow(REPORT_MESSAGES.staffOnly);
      await expect(resolveReport(who, { ticket, action: "remove" })).rejects.toThrow(
        REPORT_MESSAGES.staffOnly,
      );
      await expect(resolveReport(who, { ticket, action: "keep" })).rejects.toThrow(
        REPORT_MESSAGES.staffOnly,
      );
    }
    expect(await designStatus(piece.id)).toBe("published");
    expect((await reportRows())[0]?.status).toBe("open");
  });

  it("is closed to everyone when no admin email is set", async () => {
    delete process.env.STUDIO_ADMIN_EMAILS;
    await expect(listReports("boss")).rejects.toThrow(REPORT_MESSAGES.staffOnly);
    expect(await readReportsAccess("boss")).toEqual({ admin: false });
  });

  it("checks the email on the account, not a name that looks like one", async () => {
    const sql = await getSql();
    await sql`update "user" set name = ${BOSS_EMAIL} where id = ${"bo"}`;
    await expect(listReports("bo")).rejects.toThrow(REPORT_MESSAGES.staffOnly);
    expect(await readReportsAccess("bo")).toEqual({ admin: false });
    expect(await readReportsAccess("boss")).toEqual({ admin: true });
  });

  it("piles open reports by target with the count, reasons, notes and who reported", async () => {
    const hoodie = await seedDesign("ada", { title: "Loud Hoodie", published: true });
    const tee = await seedDesign("bo", { title: "Quiet Tee", published: true });
    const at = (minute: number) => new Date(Date.UTC(2026, 10, 17, 10, minute));
    await fileReport("cy", { kind: "piece", slug: tee.slug, reason: "scam" }, at(0));
    await fileReport(
      "bo",
      { kind: "piece", slug: hoodie.slug, reason: "stolen", note: "My logo." },
      at(1),
    );
    await fileReport("cy", { kind: "piece", slug: hoodie.slug, reason: "stolen" }, at(2));
    await fileReport(
      "boss",
      { kind: "piece", slug: hoodie.slug, reason: "hate", note: "Read the back." },
      at(3),
    );
    await fileReport("cy", { kind: "maker", handle: "ada", reason: "other", note: "Bio." }, at(4));

    const queue = await listReports("boss");
    expect(queue.open).toBe(5);
    expect(queue.groups.map((group) => [group.kind, group.count])).toEqual([
      ["piece", 3],
      ["piece", 1],
      ["maker", 1],
    ]);

    const [big, small, maker] = queue.groups;
    expect(big?.piece).toMatchObject({
      slug: hoodie.slug,
      title: "Loud Hoodie",
      onRack: true,
      maker: { handle: "ada", name: "ADA" },
    });
    expect(big?.maker).toBeNull();
    expect(big?.reasons).toEqual([
      { reason: "stolen", count: 2 },
      { reason: "hate", count: 1 },
    ]);
    expect(big?.slips.map((slip) => [slip.by, slip.reason, slip.note])).toEqual([
      ["bo", "stolen", "My logo."],
      [null, "stolen", ""],
      [null, "hate", "Read the back."],
    ]);
    expect(big?.firstAt).toBe(at(1).toISOString());
    expect(big?.lastAt).toBe(at(3).toISOString());
    expect(small?.piece?.slug).toBe(tee.slug);
    expect(maker?.maker).toEqual({
      handle: "ada",
      name: "ADA",
      bio: "Loud colours, louder words.",
    });
    expect(maker?.piece).toBeNull();

    // Nothing in the queue names a user id or a design id.
    const flat = JSON.stringify(queue);
    expect(flat).not.toContain(hoodie.id);
    expect(flat).not.toContain(tee.id);
    expect(flat).not.toMatch(/"(reporter_id|target_id|user_id|userId|targetId)"/);
  });

  it("shows a pile whose piece was deleted, with nothing to link to", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other" });
    const sql = await getSql();
    await sql`delete from designs where id = ${piece.id}`;
    const queue = await listReports("boss");
    expect(queue.groups).toHaveLength(1);
    expect(queue.groups[0]?.piece).toBeNull();
    const done = await resolveReport("boss", { ticket: queue.groups[0]?.ticket, action: "remove" });
    expect(done).toMatchObject({ settled: 1, changed: false });
    expect((await listReports("boss")).groups).toEqual([]);
  });
});

describe("settling a pile", () => {
  it("takes a piece off the rack: draft, gone from the shop, every open report removed", async () => {
    const piece = await seedDesign("ada", { title: "Loud Hoodie", published: true });
    const other = await seedDesign("ada", { title: "Fine Tee", published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "stolen" });
    await fileReport("cy", { kind: "piece", slug: piece.slug, reason: "hate" });
    await fileReport("cy", { kind: "piece", slug: other.slug, reason: "other" });
    expect((await listShop()).map((item) => item.id)).toContain(piece.id);

    const queue = await listReports("boss");
    const pile = queue.groups.find((group) => group.piece?.slug === piece.slug);
    const result = await resolveReport("boss", { ticket: pile?.ticket, action: "remove" });
    expect(result).toEqual({ kind: "piece", action: "remove", settled: 2, changed: true });

    expect(await designStatus(piece.id)).toBe("draft");
    expect((await listShop()).map((item) => item.id)).toEqual([other.id]);
    await expect(getShopDesign(piece.slug)).rejects.toThrow(/not on the rack/);

    const rows = await reportRows();
    const mine = rows.filter((row) => row.target_id === piece.id);
    expect(mine.map((row) => row.status)).toEqual(["removed", "removed"]);
    expect(mine.every((row) => row.resolved_by === "boss" && row.resolved_at != null)).toBe(true);
    // The other piece and its report are untouched.
    expect(rows.find((row) => row.target_id === other.id)).toMatchObject({
      status: "open",
      resolved_by: null,
    });
    expect(await designStatus(other.id)).toBe("published");
    expect((await listReports("boss")).groups.map((group) => group.piece?.slug)).toEqual([
      other.slug,
    ]);
  });

  it("keeps a piece: it stays on the rack and the reports are marked kept", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "nudity" });
    await fileReport("cy", { kind: "piece", slug: piece.slug, reason: "nudity" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    const result = await resolveReport("boss", { ticket, action: "keep" });
    expect(result).toEqual({ kind: "piece", action: "keep", settled: 2, changed: false });
    expect(await designStatus(piece.id)).toBe("published");
    expect((await listShop()).map((item) => item.id)).toEqual([piece.id]);
    expect((await reportRows()).map((row) => row.status)).toEqual(["kept", "kept"]);
    expect((await listReports("boss")).groups).toEqual([]);
  });

  it("clears a maker's bio and leaves the account, the handle and the pieces alone", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "maker", handle: "ada", reason: "hate" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    const result = await resolveReport("boss", { ticket, action: "remove" });
    expect(result).toEqual({ kind: "maker", action: "remove", settled: 1, changed: true });
    expect(await bioOf("ada")).toBe("");
    const sql = await getSql();
    const profile = await sql<{ handle: string; display_name: string }>`
      select handle, display_name from profiles where user_id = ${"ada"}
    `;
    expect(profile[0]).toEqual({ handle: "ada", display_name: "ADA" });
    const users = await sql<{ id: string }>`select id from "user" where id = ${"ada"}`;
    expect(users).toHaveLength(1);
    expect(await designStatus(piece.id)).toBe("published");
    expect((await reportRows())[0]).toMatchObject({ status: "removed", resolved_by: "boss" });
  });

  it("keeps a maker: the bio stays", async () => {
    await fileReport("bo", { kind: "maker", handle: "ada", reason: "other" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    const result = await resolveReport("boss", { ticket, action: "keep" });
    expect(result).toEqual({ kind: "maker", action: "keep", settled: 1, changed: false });
    expect(await bioOf("ada")).toBe("Loud colours, louder words.");
    expect((await reportRows())[0]?.status).toBe("kept");
  });

  it("does nothing the second time, so a stale tab cannot pull a piece that went back up", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    await resolveReport("boss", { ticket, action: "keep" });
    await expect(resolveReport("boss", { ticket, action: "remove" })).rejects.toThrow(
      REPORT_MESSAGES.settled,
    );
    expect(await designStatus(piece.id)).toBe("published");
    expect((await reportRows())[0]?.status).toBe("kept");

    // Taken down, put back up by its maker, then the old ticket is pressed again.
    await fileReport("cy", { kind: "piece", slug: piece.slug, reason: "other" });
    const second = (await listReports("boss")).groups[0]?.ticket;
    await resolveReport("boss", { ticket: second, action: "remove" });
    expect(await designStatus(piece.id)).toBe("draft");
    await publishDesign("ada", piece.id);
    await expect(resolveReport("boss", { ticket: second, action: "remove" })).rejects.toThrow(
      REPORT_MESSAGES.settled,
    );
    expect(await designStatus(piece.id)).toBe("published");
  });

  it("refuses a ticket that does not exist and an action that is not one of the two", async () => {
    const piece = await seedDesign("ada", { published: true });
    await fileReport("bo", { kind: "piece", slug: piece.slug, reason: "other" });
    const ticket = (await listReports("boss")).groups[0]?.ticket;
    await expect(resolveReport("boss", { ticket: "nope", action: "keep" })).rejects.toThrow(
      REPORT_MESSAGES.gone,
    );
    // A design id is not a ticket.
    await expect(resolveReport("boss", { ticket: piece.id, action: "remove" })).rejects.toThrow(
      REPORT_MESSAGES.gone,
    );
    await expect(resolveReport("boss", { ticket, action: "delete" })).rejects.toThrow(/Pick what/);
    await expect(resolveReport("boss", { ticket })).rejects.toThrow(/Pick what/);
    expect(await designStatus(piece.id)).toBe("published");
    expect((await reportRows())[0]?.status).toBe("open");
  });

  it("never hides a piece by count alone", async () => {
    const piece = await seedDesign("ada", { published: true });
    const sql = await getSql();
    for (let index = 0; index < 30; index += 1) {
      await seedUser(`crowd-${index}`);
      await fileReport(`crowd-${index}`, { kind: "piece", slug: piece.slug, reason: "hate" });
    }
    expect(await designStatus(piece.id)).toBe("published");
    expect((await listShop()).map((item) => item.id)).toEqual([piece.id]);
    const open = await sql<{ n: number }>`
      select count(*)::int as n from reports where status = ${"open"}
    `;
    expect(open[0]?.n).toBe(30);
    expect((await listReports("boss")).groups[0]?.count).toBe(30);
  });
});
