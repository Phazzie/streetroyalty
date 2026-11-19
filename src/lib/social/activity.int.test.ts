import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";
import type { ActivityItem } from "./activity-api.ts";
import { ACTIVITY_LIMIT, listActivity, listShelf } from "./activity.server.ts";

const NOW = new Date("2026-11-17T18:00:00Z");

function sentence(item: ActivityItem): string {
  return item.parts.map((part) => part.text).join("");
}

function sentences(items: ActivityItem[]): string[] {
  return items.map(sentence);
}

async function profile(userId: string, handle: string, name: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, handle, display_name) values (${userId}, ${handle}, ${name})
  `;
}

async function crown(userId: string, designId: string, at: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into crowns (user_id, design_id, created_at) values (${userId}, ${designId}, ${at})
  `;
}

async function follow(followerId: string, makerId: string, at: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into follows (follower_id, maker_id, created_at)
    values (${followerId}, ${makerId}, ${at})
  `;
}

async function lineage(childId: string, parentId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into design_lineage (design_id, parent_id, root_id)
    values (${childId}, ${parentId}, ${parentId})
  `;
}

async function publishedAt(designId: string, at: string): Promise<void> {
  const sql = await getSql();
  await sql`update designs set updated_at = ${at} where id = ${designId}`;
}

async function unpublish(designId: string): Promise<void> {
  const sql = await getSql();
  await sql`update designs set status = 'draft' where id = ${designId}`;
}

let voteSerial = 0;
async function vote(voterId: string, winnerId: string, loserId: string, at: string): Promise<void> {
  const sql = await getSql();
  voteSerial += 1;
  // One vote per person per pair in the real table. Each test vote gets its own pair key.
  await sql`
    insert into battle_votes (id, voter_id, pair_key, winner_id, loser_id, created_at)
    values (${`vote-${voteSerial}`}, ${voterId}, ${`pair-${voteSerial}`}, ${winnerId}, ${loserId}, ${at})
  `;
}

async function scans(designId: string, day: string, count: number): Promise<void> {
  const sql = await getSql();
  await sql`insert into tag_scans (design_id, day, scans) values (${designId}, ${day}, ${count})`;
}

beforeEach(async () => {
  await truncateAll();
  for (const id of ["ada", "bo", "cy"]) await seedUser(id);
  await profile("ada", "ada", "Ada Royal");
  await profile("bo", "bo", "Bo Second");
  // cy has no page: the name comes from the "user" table and there is no link.
});

describe("a maker's activity", () => {
  it("shows every kind of news, newest first, to the maker it belongs to", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const rival = await seedDesign("bo", { title: "Second Act Tee", published: true });
    const remix = await seedDesign("bo", { title: "Do Better Again", published: true });
    await lineage(remix.id, hoodie.id);
    await publishedAt(remix.id, "2026-11-17T15:00:00Z");
    await crown("bo", hoodie.id, "2026-11-17T17:00:00Z");
    await follow("cy", "ada", "2026-11-17T16:00:00Z");
    await vote("cy", hoodie.id, rival.id, "2026-11-17T14:00:00Z");
    await scans(hoodie.id, "2026-11-16", 4);

    const feed = await listActivity("ada", NOW);
    expect(feed.map((item) => item.kind)).toEqual(["crown", "follow", "remix", "battle", "scan"]);
    expect(sentences(feed)).toEqual([
      "Bo Second crowned Do Better Hoodie.",
      "Someone started following you.",
      "Bo Second remixed Do Better Hoodie into Do Better Again.",
      "Do Better Hoodie won 1 battle.",
      "Do Better Hoodie was scanned 4 times out in the street.",
    ]);
    expect(feed.map((item) => item.when)).toEqual([
      "2026-11-17T17:00:00.000Z",
      "2026-11-17T16:00:00.000Z",
      "2026-11-17T15:00:00.000Z",
      "2026-11-17T14:00:00.000Z",
      "2026-11-16T12:00:00.000Z",
    ]);
    expect(feed.map((item) => item.rollup)).toEqual([false, false, false, true, true]);
    expect(new Set(feed.map((item) => item.id)).size).toBe(feed.length);
  });

  it("links names to maker pages and pieces to the rack, and never shows an account name in public", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const remix = await seedDesign("bo", { title: "Do Better Again", published: true });
    await lineage(remix.id, hoodie.id);
    await publishedAt(remix.id, "2026-11-17T15:00:00Z");
    await crown("cy", hoodie.id, "2026-11-17T17:00:00Z");

    const [crowned, remixed] = await listActivity("ada", NOW);
    // cy has no maker page. An account name can be the front of an email, so it is never shown.
    expect(crowned?.parts).toEqual([
      { text: "Someone" },
      { text: " crowned " },
      { text: "Do Better Hoodie", to: "piece", slug: hoodie.slug },
      { text: "." },
    ]);
    expect(remixed?.parts).toEqual([
      { text: "Bo Second", to: "maker", handle: "bo" },
      { text: " remixed " },
      { text: "Do Better Hoodie", to: "piece", slug: hoodie.slug },
      { text: " into " },
      { text: "Do Better Again", to: "piece", slug: remix.slug },
      { text: "." },
    ]);
  });

  it("never leaks another maker's news", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const tee = await seedDesign("bo", { title: "Second Act Tee", published: true });
    const remix = await seedDesign("cy", { title: "Third Act Tee", published: true });
    await lineage(remix.id, tee.id);
    await crown("cy", tee.id, "2026-11-17T17:00:00Z");
    await follow("cy", "bo", "2026-11-17T16:00:00Z");
    await vote("cy", tee.id, remix.id, "2026-11-17T14:00:00Z");
    await scans(tee.id, "2026-11-17", 9);

    expect(await listActivity("ada", NOW)).toEqual([]);
    // What ada did to someone else's piece is their news, not hers.
    await crown("ada", tee.id, "2026-11-17T17:30:00Z");
    await follow("ada", "bo", "2026-11-17T17:31:00Z");
    expect(await listActivity("ada", NOW)).toEqual([]);

    const theirs = await listActivity("bo", NOW);
    expect(theirs).toHaveLength(7);
    expect(sentences(theirs).join(" ")).not.toContain(hoodie.title);
    // cy lost a battle with a piece of their own, and sees only that.
    expect(sentences(await listActivity("cy", NOW))).toEqual(["Third Act Tee lost 1 battle."]);
  });

  it("answers nothing for an empty or unknown user id", async () => {
    const hoodie = await seedDesign("ada", { published: true });
    await crown("bo", hoodie.id, "2026-11-17T17:00:00Z");
    expect(await listActivity("", NOW)).toEqual([]);
    expect(await listActivity("nobody", NOW)).toEqual([]);
    expect(await listActivity("ada' or '1'='1", NOW)).toEqual([]);
    expect(await listShelf("")).toEqual([]);
  });

  it("does not count a maker crowning, following or remixing themselves", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const again = await seedDesign("ada", { title: "Do Better Again", published: true });
    await lineage(again.id, hoodie.id);
    await crown("ada", hoodie.id, "2026-11-17T17:00:00Z");
    await follow("ada", "ada", "2026-11-17T16:00:00Z");
    expect(await listActivity("ada", NOW)).toEqual([]);
  });

  it("keeps drafts out, and a remix out until it is published", async () => {
    const draft = await seedDesign("ada", { title: "Not Out Yet" });
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const rival = await seedDesign("bo", { title: "Second Act Tee", published: true });
    const remix = await seedDesign("bo", { title: "Do Better Again" });
    await lineage(remix.id, hoodie.id);
    await crown("bo", draft.id, "2026-11-17T17:00:00Z");
    await vote("cy", draft.id, rival.id, "2026-11-17T14:00:00Z");
    await scans(draft.id, "2026-11-17", 3);

    expect(await listActivity("ada", NOW)).toEqual([]);

    const sql = await getSql();
    await sql`update designs set status = 'published', updated_at = ${"2026-11-17T15:00:00Z"} where id = ${remix.id}`;
    expect(sentences(await listActivity("ada", NOW))).toEqual([
      "Bo Second remixed Do Better Hoodie into Do Better Again.",
    ]);

    // Pulled back off the rack: the news goes with it.
    await unpublish(remix.id);
    expect(await listActivity("ada", NOW)).toEqual([]);
  });

  it("drops the news about a piece its maker took off the rack", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    await crown("bo", hoodie.id, "2026-11-17T17:00:00Z");
    await scans(hoodie.id, "2026-11-17", 2);
    expect(await listActivity("ada", NOW)).toHaveLength(2);
    await unpublish(hoodie.id);
    expect(await listActivity("ada", NOW)).toEqual([]);
  });

  it("rolls battles up per piece per day and never says who voted", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const crew = await seedDesign("ada", { title: "Night Shift Crew", published: true });
    const rival = await seedDesign("bo", { title: "Second Act Tee", published: true });
    await vote("bo", hoodie.id, rival.id, "2026-11-17T09:00:00Z");
    await vote("cy", hoodie.id, rival.id, "2026-11-17T10:00:00Z");
    await vote("bo", hoodie.id, rival.id, "2026-11-17T11:00:00Z");
    await vote("cy", rival.id, hoodie.id, "2026-11-17T13:30:00Z");
    await vote("cy", rival.id, hoodie.id, "2026-11-16T23:59:00Z");
    await vote("bo", rival.id, hoodie.id, "2026-11-16T08:00:00Z");
    await vote("cy", crew.id, rival.id, "2026-11-17T12:00:00Z");

    const feed = await listActivity("ada", NOW);
    expect(feed.every((item) => item.kind === "battle" && item.rollup)).toBe(true);
    expect(sentences(feed)).toEqual([
      "Do Better Hoodie won 3 battles and lost 1.",
      "Night Shift Crew won 1 battle.",
      "Do Better Hoodie lost 2 battles.",
    ]);
    expect(feed.map((item) => [item.won, item.lost])).toEqual([
      [3, 1],
      [1, 0],
      [0, 2],
    ]);
    // The day's row sits at its last vote.
    expect(feed[0]?.when).toBe("2026-11-17T13:30:00.000Z");
    expect(feed[2]?.when).toBe("2026-11-16T23:59:00.000Z");
    const links = feed.flatMap((item) => item.parts).filter((part) => "to" in part);
    expect(links.every((part) => "to" in part && part.to === "piece")).toBe(true);
    expect(sentences(feed).join(" ")).not.toMatch(/Bo Second|\bbo\b|\bcy\b/);
    // The other side of the same votes, for the other maker.
    expect(sentences(await listActivity("bo", NOW))).toEqual([
      "Second Act Tee won 1 battle and lost 4.",
      "Second Act Tee won 2 battles.",
    ]);
  });

  it("gives street scans one row per piece per day", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    const crew = await seedDesign("ada", { title: "Night Shift Crew", published: true });
    await scans(hoodie.id, "2026-11-17", 1);
    await scans(hoodie.id, "2026-11-15", 12);
    await scans(crew.id, "2026-11-16", 4);
    await scans(crew.id, "2026-11-14", 0);

    const early = new Date("2026-11-17T06:30:00Z");
    const feed = await listActivity("ada", early);
    expect(sentences(feed)).toEqual([
      "Do Better Hoodie was scanned once out in the street.",
      "Night Shift Crew was scanned 4 times out in the street.",
      "Do Better Hoodie was scanned 12 times out in the street.",
    ]);
    expect(feed.map((item) => item.scans)).toEqual([1, 4, 12]);
    // Today's row is held back to now, so it is never in the future.
    expect(feed[0]?.when).toBe(early.toISOString());
    expect(feed[1]?.when).toBe("2026-11-16T12:00:00.000Z");
  });

  it("stops at forty, and keeps the newest", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    for (let index = 0; index < 45; index += 1) {
      const fan = await seedUser(`fan-${index}`);
      await profile(fan, `fan${index}`, `fan-${index}`);
      const minute = String(index).padStart(2, "0");
      await crown(fan, hoodie.id, `2026-11-17T10:${minute}:00Z`);
    }
    await follow("bo", "ada", "2026-11-17T09:00:00Z");
    await scans(hoodie.id, "2026-11-10", 7);

    const feed = await listActivity("ada", NOW);
    expect(feed).toHaveLength(ACTIVITY_LIMIT);
    expect(ACTIVITY_LIMIT).toBe(40);
    expect(feed.every((item) => item.kind === "crown")).toBe(true);
    expect(sentence(feed[0] as ActivityItem)).toBe("fan-44 crowned Do Better Hoodie.");
    expect(sentence(feed[39] as ActivityItem)).toBe("fan-5 crowned Do Better Hoodie.");
    expect(new Set(feed.map((item) => item.id)).size).toBe(ACTIVITY_LIMIT);
  });

  it("mixes kinds inside the forty by time, not by kind", async () => {
    const hoodie = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    for (let index = 0; index < 39; index += 1) {
      const fan = await seedUser(`fan-${index}`);
      const minute = String(index).padStart(2, "0");
      await crown(fan, hoodie.id, `2026-11-17T10:${minute}:00Z`);
    }
    await follow("bo", "ada", "2026-11-17T17:00:00Z");
    await follow("cy", "ada", "2026-11-17T08:00:00Z");

    const feed = await listActivity("ada", NOW);
    expect(feed).toHaveLength(40);
    expect(feed[0]?.kind).toBe("follow");
    expect(sentences(feed)).not.toContain("Someone started following you.");
  });
});

describe("the crowned shelf", () => {
  it("lists the published pieces a person crowned, newest first, with who made them", async () => {
    const tee = await seedDesign("bo", { title: "Second Act Tee", published: true });
    const loud = await seedDesign("cy", { title: "Loud Pack Hoodie", published: true });
    const own = await seedDesign("ada", { title: "Do Better Hoodie", published: true });
    await crown("ada", tee.id, "2026-11-15T10:00:00Z");
    await crown("ada", loud.id, "2026-11-16T10:00:00Z");
    await crown("ada", own.id, "2026-11-14T10:00:00Z");
    await crown("bo", loud.id, "2026-11-17T10:00:00Z");

    expect(await listShelf("ada")).toEqual([
      {
        slug: loud.slug,
        title: "Loud Pack Hoodie",
        mockupUrl: loud.mockupUrl,
        maker: { name: "A maker", handle: null },
        crownedAt: "2026-11-16T10:00:00.000Z",
      },
      {
        slug: tee.slug,
        title: "Second Act Tee",
        mockupUrl: tee.mockupUrl,
        maker: { name: "Bo Second", handle: "bo" },
        crownedAt: "2026-11-15T10:00:00.000Z",
      },
      {
        slug: own.slug,
        title: "Do Better Hoodie",
        mockupUrl: own.mockupUrl,
        maker: { name: "Ada Royal", handle: "ada" },
        crownedAt: "2026-11-14T10:00:00.000Z",
      },
    ]);
    expect((await listShelf("bo")).map((item) => item.slug)).toEqual([loud.slug]);
    expect(await listShelf("cy")).toEqual([]);
  });

  it("drops a piece that was unpublished, and one that was never out", async () => {
    const tee = await seedDesign("bo", { title: "Second Act Tee", published: true });
    const loud = await seedDesign("cy", { title: "Loud Pack Hoodie", published: true });
    const draft = await seedDesign("bo", { title: "Not Out Yet" });
    await crown("ada", tee.id, "2026-11-15T10:00:00Z");
    await crown("ada", loud.id, "2026-11-16T10:00:00Z");
    await crown("ada", draft.id, "2026-11-17T10:00:00Z");
    expect((await listShelf("ada")).map((item) => item.title)).toEqual([
      "Loud Pack Hoodie",
      "Second Act Tee",
    ]);

    await unpublish(loud.id);
    expect((await listShelf("ada")).map((item) => item.title)).toEqual(["Second Act Tee"]);

    const sql = await getSql();
    await sql`delete from designs where id = ${tee.id}`;
    expect(await listShelf("ada")).toEqual([]);
  });
});
