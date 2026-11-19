import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { pairKey } from "./battles.ts";
import {
  battleTicket,
  castVote,
  DAILY_VOTE_LIMIT,
  nextBattle,
  throne,
  ticketValid,
} from "./battles.server.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";

async function votesOn(key: string) {
  const sql = await getSql();
  return sql<{ voter_id: string; winner_id: string; loser_id: string }>`
    select voter_id, winner_id, loser_id from battle_votes where pair_key = ${key} order by voter_id
  `;
}

async function giveHandle(userId: string, handle: string, name: string) {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, handle, display_name) values (${userId}, ${handle}, ${name})
  `;
}

/** A vote on a pair the server showed this voter: the ticket is what the arena sends. */
function vote(voterId: string, winnerId: string, loserId: string) {
  return castVote(voterId, {
    winnerId,
    loserId,
    ticket: battleTicket(voterId, pairKey(winnerId, loserId)),
  });
}

beforeEach(async () => {
  await truncateAll();
  for (const id of ["ada", "bo", "cy", "dee"]) await seedUser(id);
});

describe("a vote only counts on the pair the voter was shown", () => {
  it("hands a signed-in viewer a ticket with the pair, and a visitor none", async () => {
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    const shown = await nextBattle("cy");
    expect(shown.pair?.ticket).toEqual(expect.any(String));
    expect((await nextBattle(null)).pair?.ticket).toBeUndefined();
    const pair = shown.pair;
    if (!pair) throw new Error("no pair");
    await expect(
      castVote("cy", { winnerId: pair.left.id, loserId: pair.right.id, ticket: pair.ticket }),
    ).resolves.toMatchObject({ pairKey: pair.key });
  });

  it("refuses a vote with no ticket, another pair's ticket, or another voter's ticket", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const c = await seedDesign("bo", { title: "Bo Hoodie", published: true });
    const refused = /pair you were shown/;
    await expect(castVote("cy", { winnerId: a.id, loserId: b.id })).rejects.toThrow(refused);
    await expect(
      castVote("cy", {
        winnerId: a.id,
        loserId: b.id,
        ticket: battleTicket("cy", pairKey(a.id, c.id)),
      }),
    ).rejects.toThrow(refused);
    await expect(
      castVote("cy", {
        winnerId: a.id,
        loserId: b.id,
        ticket: battleTicket("dee", pairKey(a.id, b.id)),
      }),
    ).rejects.toThrow(refused);
    expect(await votesOn(pairKey(a.id, b.id))).toEqual([]);
  });

  it("takes yesterday's ticket, for a pair shown just before midnight, and nothing older", () => {
    const now = new Date("2026-11-18T00:05:00Z");
    const key = "a:b";
    expect(
      ticketValid("cy", key, battleTicket("cy", key, new Date("2026-11-17T23:58:00Z")), now),
    ).toBe(true);
    expect(
      ticketValid("cy", key, battleTicket("cy", key, new Date("2026-11-16T12:00:00Z")), now),
    ).toBe(false);
    expect(ticketValid("cy", key, "", now)).toBe(false);
  });

  it("stops one voter at the daily limit", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const sql = await getSql();
    await sql`
      insert into action_quotas (user_id, action, window_key, used)
      values ('cy', 'vote', ${new Date().toISOString().slice(0, 10)}, ${DAILY_VOTE_LIMIT})
    `;
    await expect(vote("cy", a.id, b.id)).rejects.toThrow(/a lot of battles/);
    await expect(vote("dee", a.id, b.id)).resolves.toMatchObject({ pairKey: pairKey(a.id, b.id) });
  });
});

describe("casting a vote", () => {
  it("records the pick and hands back the split for that pair", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const tally = await vote("cy", a.id, b.id);
    expect(tally).toEqual({
      pairKey: pairKey(a.id, b.id),
      winnerId: a.id,
      loserId: b.id,
      winnerVotes: 1,
      loserVotes: 0,
      total: 1,
    });
  });

  it("keeps one vote per person per pair, and voting again changes it", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const key = pairKey(a.id, b.id);

    await vote("cy", a.id, b.id);
    await vote("cy", a.id, b.id);
    expect(await votesOn(key)).toEqual([{ voter_id: "cy", winner_id: a.id, loser_id: b.id }]);

    const changed = await vote("cy", b.id, a.id);
    expect(await votesOn(key)).toEqual([{ voter_id: "cy", winner_id: b.id, loser_id: a.id }]);
    expect(changed).toMatchObject({ winnerId: b.id, winnerVotes: 1, loserVotes: 0, total: 1 });
  });

  it("counts everybody's votes on the pair, whichever way round they came in", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    await vote("cy", a.id, b.id);
    const tally = await vote("dee", b.id, a.id);
    expect(tally).toMatchObject({ winnerId: b.id, winnerVotes: 1, loserVotes: 1, total: 2 });
  });

  it("refuses a battle that includes the voter's own piece, on either side", async () => {
    const mine = await seedDesign("ada", { title: "Ada Tee", published: true });
    const theirs = await seedDesign("bo", { title: "Bo Tee", published: true });
    await expect(vote("ada", mine.id, theirs.id)).rejects.toThrow(/your own piece/);
    await expect(vote("ada", theirs.id, mine.id)).rejects.toThrow(/your own piece/);
    expect(await votesOn(pairKey(mine.id, theirs.id))).toEqual([]);
  });

  it("refuses a draft, a piece that does not exist, and a piece against itself", async () => {
    const live = await seedDesign("ada", { title: "Ada Tee", published: true });
    const draft = await seedDesign("bo", { title: "Bo Draft" });
    await expect(vote("cy", live.id, draft.id)).rejects.toThrow(/not on the rack/);
    await expect(vote("cy", draft.id, live.id)).rejects.toThrow(/not on the rack/);
    await expect(vote("cy", live.id, "nope")).rejects.toThrow(/not on the rack/);
    await expect(vote("cy", live.id, live.id)).rejects.toThrow(/cannot battle itself/);
    await expect(vote("cy", "", live.id)).rejects.toThrow(/Pick one/);
    const sql = await getSql();
    expect(await sql`select id from battle_votes`).toEqual([]);
  });
});

describe("the next battle", () => {
  it("says the rack is too small with fewer than two published pieces", async () => {
    expect(await nextBattle(null)).toMatchObject({ pair: null, reason: "few", signedIn: false });
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Draft" });
    expect(await nextBattle("cy")).toMatchObject({ pair: null, reason: "few", signedIn: true });
  });

  it("shows a visitor a pair, with each maker's name and handle", async () => {
    await giveHandle("ada", "ada", "Ada Royal");
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const battle = await nextBattle(null);
    expect(battle).toMatchObject({ reason: "ready", signedIn: false, pairsLeft: null });
    const sides = [battle.pair?.left, battle.pair?.right].sort((x, y) =>
      (x?.title ?? "").localeCompare(y?.title ?? ""),
    );
    expect(sides[0]).toEqual({
      id: a.id,
      slug: a.slug,
      title: "Ada Tee",
      mockupUrl: a.mockupUrl,
      maker: { name: "Ada Royal", handle: "ada" },
    });
    // No maker page yet: never the account name, which can be the front of an email.
    expect(sides[1]).toMatchObject({ id: b.id, maker: { name: "A maker", handle: null } });
    expect(battle.pair?.key).toBe(pairKey(a.id, b.id));
  });

  it("never includes the viewer's own pieces", async () => {
    const mine = await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    await seedDesign("cy", { title: "Cy Tee", published: true });
    for (let run = 0; run < 12; run += 1) {
      const battle = await nextBattle("ada");
      expect([battle.pair?.left.id, battle.pair?.right.id]).not.toContain(mine.id);
    }
  });

  it("tells a maker when everything else on the rack is theirs", async () => {
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("ada", { title: "Ada Hoodie", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    expect(await nextBattle("ada")).toMatchObject({ pair: null, reason: "own" });
  });

  it("never leaves out a draft's maker by mistake, and never shows a draft", async () => {
    const draft = await seedDesign("bo", { title: "Bo Draft" });
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("cy", { title: "Cy Tee", published: true });
    for (let run = 0; run < 8; run += 1) {
      const battle = await nextBattle("dee");
      expect([battle.pair?.left.id, battle.pair?.right.id]).not.toContain(draft.id);
    }
  });

  it("puts two different makers in the ring when it can", async () => {
    await giveHandle("ada", "ada", "Ada Royal");
    await giveHandle("bo", "bo", "Bo Knows");
    await seedDesign("ada", { title: "Ada One", published: true });
    await seedDesign("ada", { title: "Ada Two", published: true });
    await seedDesign("ada", { title: "Ada Three", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    for (let run = 0; run < 10; run += 1) {
      const battle = await nextBattle(null);
      expect(battle.pair?.left.maker.name).not.toBe(battle.pair?.right.maker.name);
    }
  });

  it("brings in the piece that has been seen least", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const fresh = await seedDesign("cy", { title: "Cy Tee", published: true });
    await vote("dee", a.id, b.id);
    for (let run = 0; run < 10; run += 1) {
      const battle = await nextBattle(null);
      expect([battle.pair?.left.id, battle.pair?.right.id]).toContain(fresh.id);
    }
  });

  it("never repeats a judged pair, counts down, and ends with nothing left", async () => {
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    await seedDesign("cy", { title: "Cy Tee", published: true });
    await seedDesign("cy", { title: "Cy Hoodie", published: true });

    const seen = new Set<string>();
    // Four pieces by other people make six pairs.
    for (let left = 6; left > 0; left -= 1) {
      const battle = await nextBattle("dee");
      if (!battle.pair) throw new Error(`ran out with ${left} pairs to go`);
      expect(battle.pairsLeft).toBe(left);
      expect(seen.has(battle.pair.key)).toBe(false);
      seen.add(battle.pair.key);
      await vote("dee", battle.pair.left.id, battle.pair.right.id);
    }
    expect(seen.size).toBe(6);
    expect(await nextBattle("dee")).toEqual({
      pair: null,
      reason: "done",
      signedIn: true,
      pairsLeft: 0,
    });
    // Somebody else's rack is untouched by dee's votes.
    expect((await nextBattle("ada")).reason).toBe("ready");
  });

  it("steps past a skipped pair while another is left, and comes back to it after", async () => {
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    await seedDesign("cy", { title: "Cy Tee", published: true });
    const first = await nextBattle(null);
    const second = await nextBattle(null, { skip: [first.pair?.key ?? ""] });
    expect(second.pair?.key).not.toBe(first.pair?.key);
    const third = await nextBattle(null, {
      skip: [first.pair?.key ?? "", second.pair?.key ?? ""],
    });
    expect([first.pair?.key, second.pair?.key]).not.toContain(third.pair?.key);
    const all = [first.pair?.key ?? "", second.pair?.key ?? "", third.pair?.key ?? ""];
    expect((await nextBattle(null, { skip: all })).reason).toBe("ready");
  });

  it("rests the two pieces that were just on screen when four are on the rack", async () => {
    for (const maker of ["ada", "bo", "cy", "dee"]) {
      await seedDesign(maker, { title: `${maker} tee`, published: true });
    }
    for (let run = 0; run < 8; run += 1) {
      const first = await nextBattle(null);
      const second = await nextBattle(null, { after: first.pair?.key });
      const before = [first.pair?.left.id, first.pair?.right.id];
      expect(before).not.toContain(second.pair?.left.id);
      expect(before).not.toContain(second.pair?.right.id);
    }
  });
});

describe("the throne", () => {
  it("is empty until somebody votes", async () => {
    await seedDesign("ada", { title: "Ada Tee", published: true });
    await seedDesign("bo", { title: "Bo Tee", published: true });
    expect(await throne()).toEqual([]);
  });

  it("ranks by the fair score, with wins, losses and the maker", async () => {
    await giveHandle("ada", "ada", "Ada Royal");
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    const c = await seedDesign("cy", { title: "Cy Tee", published: true });
    const unseen = await seedDesign("cy", { title: "Cy Hoodie", published: true });
    // Ada's tee wins three and loses none; Cy's tee wins one and loses one; Bo's loses all.
    await vote("dee", a.id, b.id);
    await vote("cy", a.id, b.id);
    await vote("dee", a.id, c.id);
    await vote("dee", c.id, b.id);

    const board = await throne();
    expect(board.map((row) => [row.rank, row.title, row.wins, row.losses])).toEqual([
      [1, "Ada Tee", 3, 0],
      [2, "Cy Tee", 1, 1],
      [3, "Bo Tee", 0, 3],
    ]);
    expect(board[0]).toMatchObject({
      id: a.id,
      slug: a.slug,
      maker: { name: "Ada Royal", handle: "ada" },
    });
    expect(board[0]?.score).toBeCloseTo(0.4385, 3);
    expect(board[2]?.score).toBe(0);
    expect(board.map((row) => row.id)).not.toContain(unseen.id);
  });

  it("drops a piece that is no longer published", async () => {
    const a = await seedDesign("ada", { title: "Ada Tee", published: true });
    const b = await seedDesign("bo", { title: "Bo Tee", published: true });
    await vote("cy", a.id, b.id);
    const sql = await getSql();
    await sql`update designs set status = 'draft' where id = ${a.id}`;
    expect((await throne()).map((row) => row.title)).toEqual(["Bo Tee"]);
  });
});
