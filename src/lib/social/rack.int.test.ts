import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { saveDesign, publishDesign } from "../studio/designs.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { TEE, seedDesign, seedUser } from "../../test/seed.ts";
import { ensureProfile, toggleFollow } from "./makers.server.ts";
import { paletteOf, rackList, rackPiece, toggleCrown } from "./rack.server.ts";

/** Pin a piece's place in time so "newest first" does not depend on how fast the test ran. */
async function agedMinutes(designId: string, minutes: number): Promise<void> {
  const sql = await getSql();
  await sql`
    update designs set updated_at = now() - (${minutes}::int * interval '1 minute')
    where id = ${designId}
  `;
}

beforeEach(async () => {
  await truncateAll();
  // Their own emails, so the name is not the mailbox: a mailbox never becomes a handle.
  await seedUser("ada", "a1@example.com");
  await seedUser("bo", "b1@example.com");
  await seedUser("cy", "c1@example.com");
});

describe("the palette of a piece", () => {
  it("is the garment colour, then each distinct text colour in order", () => {
    const layers = JSON.stringify([
      { type: "text", color: "#D6FF3C" },
      { type: "image", src: "x", color: "#123456" },
      { type: "text", color: "#ff2d95" },
      { type: "text", color: "#d6ff3c" },
      { type: "text", color: "#FFF" },
      { type: "text", color: "red" },
      { type: "text" },
    ]);
    expect(paletteOf("#0B0614", layers)).toEqual(["#0b0614", "#d6ff3c", "#ff2d95", "#ffffff"]);
  });

  it("does not repeat the garment colour, and survives layers that do not parse", () => {
    expect(paletteOf("#000000", JSON.stringify([{ type: "text", color: "#000" }]))).toEqual([
      "#000000",
    ]);
    expect(paletteOf("#abcdef", "not json")).toEqual(["#abcdef"]);
    expect(paletteOf("", "{}")).toEqual([]);
  });

  it("comes back on a rack piece from the saved layers", async () => {
    const saved = await saveDesign("ada", {
      title: "Two Tone",
      productId: TEE.productId,
      variantId: TEE.variantId,
      placement: "front",
      layers: [
        {
          id: "a",
          type: "text",
          text: "ONE",
          color: "#d6ff3c",
          x: 0.5,
          y: 0.3,
          scale: 1,
          rotation: 0,
        },
        {
          id: "b",
          type: "text",
          text: "TWO",
          color: "#ff2d95",
          x: 0.5,
          y: 0.6,
          scale: 1,
          rotation: 0,
        },
      ],
      printFile: pngDataUrl(1800, 2400),
      mockupUrl: "data:image/svg+xml;utf8,%3Csvg%2F%3E",
    });
    await publishDesign("ada", saved.id);
    const [piece] = await rackList(null, "fresh");
    expect(piece?.palette).toEqual([piece?.colorHex.toLowerCase(), "#d6ff3c", "#ff2d95"]);
    expect(piece?.palette[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("the rack", () => {
  it("never shows a draft", async () => {
    await seedDesign("ada", { title: "Draft" });
    const live = await seedDesign("ada", { title: "Live", published: true });
    for (const sort of ["fresh", "crowned"] as const)
      expect((await rackList("bo", sort)).map((piece) => piece.id)).toEqual([live.id]);
    await toggleFollow("bo", (await ensureProfile("ada")).handle);
    expect((await rackList("bo", "following")).map((piece) => piece.id)).toEqual([live.id]);
  });

  it("gives every piece a maker with a page, making the profile if it is missing", async () => {
    await seedDesign("ada", { published: true });
    const sql = await getSql();
    expect(await sql`select user_id from profiles`).toHaveLength(0);
    const [piece] = await rackList(null, "fresh");
    expect(piece).toMatchObject({
      maker: { handle: "ada", name: "ada" },
      crowns: 0,
      crownedByMe: false,
    });
    expect(await sql`select user_id from profiles`).toHaveLength(1);
  });

  it("sorts fresh by newest first", async () => {
    const old = await seedDesign("ada", { title: "Old", published: true });
    const mid = await seedDesign("bo", { title: "Mid", published: true });
    const fresh = await seedDesign("cy", { title: "New", published: true });
    await agedMinutes(old.id, 30);
    await agedMinutes(mid.id, 20);
    await agedMinutes(fresh.id, 10);
    expect((await rackList(null, "fresh")).map((piece) => piece.title)).toEqual([
      "New",
      "Mid",
      "Old",
    ]);
  });

  it("sorts crowned by most crowns, with ties going to the newest", async () => {
    const old = await seedDesign("ada", { title: "Old", published: true });
    const mid = await seedDesign("bo", { title: "Mid", published: true });
    const fresh = await seedDesign("cy", { title: "New", published: true });
    const plain = await seedDesign("cy", { title: "Plain", published: true });
    await agedMinutes(old.id, 40);
    await agedMinutes(mid.id, 30);
    await agedMinutes(fresh.id, 20);
    await agedMinutes(plain.id, 10);
    await toggleCrown("bo", old.id);
    await toggleCrown("cy", old.id);
    await toggleCrown("ada", mid.id);
    await toggleCrown("ada", fresh.id);
    const crowned = await rackList("ada", "crowned");
    expect(crowned.map((piece) => [piece.title, piece.crowns])).toEqual([
      ["Old", 2],
      ["New", 1],
      ["Mid", 1],
      ["Plain", 0],
    ]);
    expect(crowned.map((piece) => piece.crownedByMe)).toEqual([false, true, true, false]);
  });

  it("shows only makers you follow on the following tab, and nothing signed out", async () => {
    await seedDesign("ada", { title: "Ada Piece", published: true });
    await seedDesign("bo", { title: "Bo Piece", published: true });
    await seedDesign("cy", { title: "Cy Piece", published: true });
    await toggleFollow("cy", (await ensureProfile("ada")).handle);
    expect((await rackList("cy", "following")).map((piece) => piece.title)).toEqual(["Ada Piece"]);
    expect(await rackList("ada", "following")).toEqual([]);
    expect(await rackList(null, "following")).toEqual([]);
  });

  it("stops at sixty pieces", async () => {
    const first = await seedDesign("ada", { published: true });
    const sql = await getSql();
    await sql`
      insert into designs
      select (jsonb_populate_record(
        null::designs,
        to_jsonb(d) || jsonb_build_object('id', d.id || '-' || n, 'slug', d.slug || '-' || n)
      )).*
      from designs d, generate_series(1, 64) n
      where d.id = ${first.id}
    `;
    expect(await rackList(null, "fresh")).toHaveLength(60);
    expect(await rackList(null, "crowned")).toHaveLength(60);
  });
});

describe("a crown", () => {
  it("flips on and off and counts", async () => {
    const piece = await seedDesign("ada", { published: true });
    expect(await toggleCrown("bo", piece.id)).toEqual({ crowned: true, crowns: 1 });
    expect(await toggleCrown("cy", piece.id)).toEqual({ crowned: true, crowns: 2 });
    expect(await toggleCrown("bo", piece.id)).toEqual({ crowned: false, crowns: 1 });
  });

  it("lands on the asked state however often it is sent", async () => {
    const piece = await seedDesign("ada", { published: true });
    await toggleCrown("bo", piece.id, true);
    await toggleCrown("bo", piece.id, true);
    expect(await toggleCrown("bo", piece.id, true)).toEqual({ crowned: true, crowns: 1 });
    await toggleCrown("bo", piece.id, false);
    expect(await toggleCrown("bo", piece.id, false)).toEqual({ crowned: false, crowns: 0 });
    const sql = await getSql();
    expect(await sql`select user_id from crowns`).toHaveLength(0);
  });

  it("cannot go on a draft or on a piece that does not exist", async () => {
    const draft = await seedDesign("ada", { title: "Draft" });
    await expect(toggleCrown("bo", draft.id)).rejects.toThrow("That piece is not on the rack.");
    await expect(toggleCrown("ada", draft.id, true)).rejects.toThrow(
      "That piece is not on the rack.",
    );
    await expect(toggleCrown("bo", "nope")).rejects.toThrow("That piece is not on the rack.");
    const sql = await getSql();
    expect(await sql`select user_id from crowns`).toHaveLength(0);
  });
});

describe("one piece on the rack", () => {
  it("has the sizes to sell it, its maker, its crowns and its palette", async () => {
    const piece = await seedDesign("ada", { title: "Crown Tee", published: true });
    await toggleCrown("bo", piece.id);
    const seen = await rackPiece("bo", piece.slug);
    expect(seen).toMatchObject({
      id: piece.id,
      title: "Crown Tee",
      maker: { handle: "ada", name: "ada" },
      crowns: 1,
      crownedByMe: true,
    });
    expect(seen.sizes.some((size) => size.variantId === TEE.variantId)).toBe(true);
    expect(seen.palette[0]).toBe(seen.colorHex.toLowerCase());
    expect((await rackPiece(null, piece.slug)).crownedByMe).toBe(false);
  });

  it("is missing for a draft or an unknown slug", async () => {
    const draft = await seedDesign("ada", { title: "Draft" });
    await expect(rackPiece(null, draft.slug)).rejects.toThrow("That piece is not on the rack.");
    await expect(rackPiece(null, "nope")).rejects.toThrow("That piece is not on the rack.");
  });
});
