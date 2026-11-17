import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";
import {
  ensureProfile,
  makerPage,
  myProfile,
  toggleFollow,
  updateProfile,
} from "./makers.server.ts";
import { toggleCrown } from "./rack.server.ts";

async function namedUser(id: string, name: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified")
    values (${id}, ${name}, ${`${id}@example.com`}, true)
  `;
}

beforeEach(async () => {
  await truncateAll();
});

describe("a maker profile made on first need", () => {
  it("takes its handle and name from the account, once", async () => {
    await namedUser("u1", "Ada Royal");
    const first = await ensureProfile("u1");
    expect(first).toMatchObject({ handle: "ada_royal", display_name: "Ada Royal", bio: "" });
    const again = await ensureProfile("u1");
    expect(again.handle).toBe("ada_royal");
    const sql = await getSql();
    expect(await sql`select user_id from profiles`).toHaveLength(1);
  });

  it("adds digits when the handle is taken", async () => {
    await namedUser("u1", "Ada Royal");
    await namedUser("u2", "ada royal");
    await namedUser("u3", "ADA-ROYAL");
    expect((await ensureProfile("u1")).handle).toBe("ada_royal");
    expect((await ensureProfile("u2")).handle).toBe("ada_royal2");
    expect((await ensureProfile("u3")).handle).toBe("ada_royal3");
  });

  it("never hands out a reserved word", async () => {
    await namedUser("u1", "Admin");
    await namedUser("u2", "Rack");
    await namedUser("u3", "");
    expect((await ensureProfile("u1")).handle).toBe("admin2");
    expect((await ensureProfile("u2")).handle).toBe("rack2");
    // "maker" is kept back too, so a nameless account starts at maker2.
    expect(await ensureProfile("u3")).toMatchObject({ handle: "maker2", display_name: "Maker" });
  });

  it("refuses an account that does not exist", async () => {
    await expect(ensureProfile("ghost")).rejects.toThrow("That account does not exist.");
  });
});

describe("editing a profile", () => {
  beforeEach(async () => {
    await namedUser("u1", "Ada Royal");
    await namedUser("u2", "Bo Second");
    await ensureProfile("u1");
    await ensureProfile("u2");
  });

  it("changes the name, handle and bio", async () => {
    const saved = await updateProfile("u1", {
      name: "Ada R.",
      handle: "@Ada_R",
      bio: "Loud colours.",
    });
    expect(saved).toMatchObject({
      name: "Ada R.",
      handle: "ada_r",
      bio: "Loud colours.",
      isMe: true,
    });
    expect((await makerPage(null, "ada_r")).maker.name).toBe("Ada R.");
    await expect(makerPage(null, "ada_royal")).rejects.toThrow("No maker goes by that handle.");
  });

  it("says so kindly when the handle is taken, and changes nothing", async () => {
    await expect(
      updateProfile("u1", { name: "Ada Royal", handle: "bo_second", bio: "" }),
    ).rejects.toThrow("That handle is taken. Try another.");
    expect((await myProfile("u1")).handle).toBe("ada_royal");
  });

  it("refuses reserved words, bad shapes, a short name and a long bio", async () => {
    const base = { name: "Ada Royal", handle: "ada_royal", bio: "" };
    await expect(updateProfile("u1", { ...base, handle: "admin" })).rejects.toThrow("kept back");
    await expect(updateProfile("u1", { ...base, handle: "streetroyalty" })).rejects.toThrow(
      "kept back",
    );
    await expect(updateProfile("u1", { ...base, handle: "a b" })).rejects.toThrow("letters");
    await expect(updateProfile("u1", { ...base, name: "A" })).rejects.toThrow("at least 2");
    await expect(updateProfile("u1", { ...base, bio: "x".repeat(161) })).rejects.toThrow("160");
  });

  it("keeps markup in a bio as plain text", async () => {
    const saved = await updateProfile("u1", {
      name: "Ada Royal",
      handle: "ada_royal",
      bio: '<a href="https://example.com">buy</a>',
    });
    expect(saved.bio).toBe('<a href="https://example.com">buy</a>');
  });

  it("only ever writes the caller's own row", async () => {
    // There is no way to name another maker: the row is picked by the caller's id alone.
    await updateProfile("u2", { name: "Bo Changed", handle: "bo_changed", bio: "Mine." });
    expect(await myProfile("u1")).toMatchObject({
      name: "Ada Royal",
      handle: "ada_royal",
      bio: "",
    });
    // Asking for another maker's handle is refused, not treated as editing them.
    await expect(
      updateProfile("u2", { name: "Ada Royal", handle: "ada_royal", bio: "Taken over." }),
    ).rejects.toThrow("That handle is taken.");
    expect((await myProfile("u1")).bio).toBe("");
  });
});

describe("following", () => {
  beforeEach(async () => {
    await namedUser("u1", "Ada Royal");
    await namedUser("u2", "Bo Second");
    await ensureProfile("u1");
    await ensureProfile("u2");
  });

  it("flips, and counts followers", async () => {
    expect(await toggleFollow("u2", "ada_royal")).toEqual({ following: true, followers: 1 });
    expect((await makerPage("u2", "ada_royal")).maker).toMatchObject({
      followers: 1,
      followedByMe: true,
      isMe: false,
    });
    expect((await makerPage(null, "ada_royal")).maker.followedByMe).toBe(false);
    expect((await myProfile("u2")).following).toBe(1);
    expect(await toggleFollow("u2", "ada_royal")).toEqual({ following: false, followers: 0 });
  });

  it("lands on the asked state however often it is sent", async () => {
    await toggleFollow("u2", "ada_royal", true);
    expect(await toggleFollow("u2", "ada_royal", true)).toEqual({ following: true, followers: 1 });
    await toggleFollow("u2", "ada_royal", false);
    expect(await toggleFollow("u2", "ada_royal", false)).toEqual({
      following: false,
      followers: 0,
    });
  });

  it("will not let you follow yourself, or nobody", async () => {
    await expect(toggleFollow("u1", "ada_royal")).rejects.toThrow("You cannot follow yourself.");
    await expect(toggleFollow("u1", "@Ada_Royal", true)).rejects.toThrow(
      "You cannot follow yourself.",
    );
    await expect(toggleFollow("u1", "nobody_here")).rejects.toThrow(
      "No maker goes by that handle.",
    );
  });
});

describe("a maker's page", () => {
  it("counts published pieces and the crowns on them, and lists no drafts", async () => {
    await seedUser("ada");
    await seedUser("bo");
    await ensureProfile("ada");
    await ensureProfile("bo");
    const one = await seedDesign("ada", { title: "On The Rack", published: true });
    await seedDesign("ada", { title: "Still A Draft" });
    await seedDesign("bo", { title: "Bo Piece", published: true });
    await toggleCrown("bo", one.id);

    const page = await makerPage("bo", "ada");
    expect(page.maker).toMatchObject({ handle: "ada", pieces: 1, crowns: 1, followers: 0 });
    expect(page.pieces.map((piece) => piece.title)).toEqual(["On The Rack"]);
    expect(page.pieces[0]).toMatchObject({
      crowns: 1,
      crownedByMe: true,
      maker: { handle: "ada", name: "ada" },
    });
  });

  it("has a clear answer for a handle nobody has", async () => {
    await expect(makerPage(null, "nope")).rejects.toThrow("No maker goes by that handle.");
    await expect(makerPage(null, "")).rejects.toThrow("No maker goes by that handle.");
  });
});
