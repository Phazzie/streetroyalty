import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { getDesign, listDesigns, listShop } from "../studio/designs.server.ts";
import {
  FAMILY_LIMITS,
  REMIX_HOURLY_LIMIT,
  keepPicturesLight,
  readFamily,
  remixDesign,
  remixTitle,
  type FamilyNode,
} from "./remix.server.ts";
import { truncateAll } from "../../test/db.ts";
import { seedDesign, seedUser } from "../../test/seed.ts";

async function profile(userId: string, handle: string, name: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, handle, display_name) values (${userId}, ${handle}, ${name})
  `;
}

/** Put a remix draft on the rack without going through the studio's print and mockup steps. */
async function setStatus(designId: string, status: "draft" | "published"): Promise<void> {
  const sql = await getSql();
  await sql`update designs set status = ${status} where id = ${designId}`;
}

async function slugOf(designId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ slug: string }>`select slug from designs where id = ${designId}`;
  return rows[0]?.slug ?? "";
}

async function lineage(designId: string) {
  const sql = await getSql();
  const rows = await sql<{ parent_id: string; root_id: string }>`
    select parent_id, root_id from design_lineage where design_id = ${designId}
  `;
  return rows[0];
}

/** Remix a piece and publish the copy, the way a maker would after reworking it. */
async function publishedRemix(userId: string, slug: string) {
  const { designId } = await remixDesign(userId, slug);
  await setStatus(designId, "published");
  return { id: designId, slug: await slugOf(designId) };
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
  await seedUser("cy");
  await profile("ada", "ada", "Ada Royal");
  await profile("bo", "bo", "Bo Knows");
});

describe("the remix title", () => {
  it("adds the word once and keeps it inside 80 characters", () => {
    expect(remixTitle("Crown Tee")).toBe("Crown Tee remix");
    expect(remixTitle("Crown Tee remix")).toBe("Crown Tee remix");
    const long = remixTitle("x".repeat(80));
    expect(long).toHaveLength(80);
    expect(long.endsWith(" remix")).toBe(true);
  });
});

describe("remixing a piece", () => {
  it("copies the piece into a draft the caller owns, with nothing printed yet", async () => {
    const source = await seedDesign("ada", { title: "Crown Tee", published: true });
    const { designId } = await remixDesign("bo", source.slug);

    expect(designId).not.toBe(source.id);
    const copy = await getDesign("bo", designId);
    expect(copy).toMatchObject({
      title: "Crown Tee remix",
      status: "draft",
      productId: source.productId,
      productName: source.productName,
      productType: source.productType,
      variantId: source.variantId,
      variantLabel: source.variantLabel,
      colorName: source.colorName,
      colorHex: source.colorHex,
      sizeLabel: source.sizeLabel,
      placement: source.placement,
      technique: source.technique,
      retailCents: source.retailCents,
      currency: source.currency,
      collectionId: null,
      mockupUrl: null,
      printFileId: null,
    });
    expect(copy.layers).toEqual(source.layers);
    expect(copy.slug).toMatch(/^crown-tee-remix-[0-9a-f]{8}$/);

    const sql = await getSql();
    const rows = await sql<{ user_id: string; provider_product_id: string | null }>`
      select user_id, provider_product_id from designs where id = ${designId}
    `;
    expect(rows[0]).toEqual({ user_id: "bo", provider_product_id: null });
    expect(await lineage(designId)).toEqual({ parent_id: source.id, root_id: source.id });
    // The original is untouched and still its maker's.
    expect(await getDesign("ada", source.id)).toMatchObject({ status: "published" });
    await expect(getDesign("ada", designId)).rejects.toThrow(/not on your rack/);
  });

  it("lets a maker remix their own piece", async () => {
    const source = await seedDesign("ada", { published: true });
    const { designId } = await remixDesign("ada", source.slug);
    expect(await listDesigns("ada")).toHaveLength(2);
    expect(await lineage(designId)).toEqual({ parent_id: source.id, root_id: source.id });
  });

  it("carries the original down three generations", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const third = await publishedRemix("cy", second.slug);
    const fourth = await remixDesign("ada", third.slug);

    expect(await lineage(second.id)).toEqual({ parent_id: root.id, root_id: root.id });
    expect(await lineage(third.id)).toEqual({ parent_id: second.id, root_id: root.id });
    expect(await lineage(fourth.designId)).toEqual({ parent_id: third.id, root_id: root.id });
  });

  it("keeps a remix draft off the rack until its maker publishes it", async () => {
    const source = await seedDesign("ada", { published: true });
    const { designId } = await remixDesign("bo", source.slug);

    expect((await listShop()).map((piece) => piece.id)).toEqual([source.id]);
    const family = await readFamily(source.slug);
    expect(family.remixes).toEqual([]);
    expect(family.remixCount).toBe(0);
    expect(family.descendants).toBe(0);
    await expect(readFamily(await slugOf(designId))).rejects.toThrow(/not on the rack/);
  });

  it("refuses a draft, a missing piece and a piece that left the rack", async () => {
    const draft = await seedDesign("ada", { title: "Still Cooking" });
    await expect(remixDesign("bo", draft.slug)).rejects.toThrow(/not on the rack/);
    await expect(remixDesign("ada", draft.slug)).rejects.toThrow(/not on the rack/);
    await expect(remixDesign("bo", "no-such-piece-00000000")).rejects.toThrow(/not on the rack/);

    const gone = await seedDesign("ada", { title: "Pulled", published: true });
    await setStatus(gone.id, "draft");
    await expect(remixDesign("bo", gone.slug)).rejects.toThrow(/not on the rack/);

    const sql = await getSql();
    const rows = await sql<{ count: number }>`select count(*)::int as count from design_lineage`;
    expect(Number(rows[0]?.count)).toBe(0);
    expect(await listDesigns("bo")).toEqual([]);
  });

  it("writes nothing when the copy cannot be saved, and says so plainly", async () => {
    const source = await seedDesign("ada", { published: true });
    // The same id twice: the second copy collides in the database.
    const spy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("11111111-2222-4333-8444-555555555555");
    try {
      await remixDesign("bo", source.slug);
      await expect(remixDesign("cy", source.slug)).rejects.toThrow(
        "The remix did not save. Try again.",
      );
    } finally {
      spy.mockRestore();
    }
    const sql = await getSql();
    const rows = await sql<{ count: number }>`select count(*)::int as count from design_lineage`;
    expect(Number(rows[0]?.count)).toBe(1);
    expect(await listDesigns("bo")).toHaveLength(1);
    expect(await listDesigns("cy")).toEqual([]);
  });

  it("copies artwork layers as they are", async () => {
    const source = await seedDesign("ada", { published: true });
    const sql = await getSql();
    const layers = JSON.stringify([
      {
        id: "art",
        type: "image",
        src: `data:image/png;base64,${"A".repeat(4000)}`,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 12,
      },
    ]);
    await sql`update designs set layers_json = ${layers} where id = ${source.id}`;

    const { designId } = await remixDesign("bo", source.slug);
    const rows = await sql<{ layers_json: string }>`
      select layers_json from designs where id = ${designId}
    `;
    expect(rows[0]?.layers_json).toBe(layers);
    expect((await getDesign("bo", designId)).layers).toEqual(JSON.parse(layers));
  });

  it("stops one person after too many copies in an hour", async () => {
    const source = await seedDesign("ada", { published: true });
    for (let index = 0; index < REMIX_HOURLY_LIMIT; index += 1) {
      await remixDesign("bo", source.slug);
    }
    await expect(remixDesign("bo", source.slug)).rejects.toThrow(/a lot of remixes/);
    // Somebody else is not held back by it.
    await expect(remixDesign("cy", source.slug)).resolves.toMatchObject({
      designId: expect.any(String) as string,
    });
  });

  it("holds the hourly limit when the taps arrive all at once", async () => {
    const source = await seedDesign("ada", { published: true });
    const results = await Promise.allSettled(
      Array.from({ length: REMIX_HOURLY_LIMIT + 10 }, () => remixDesign("bo", source.slug)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      REMIX_HOURLY_LIMIT,
    );
  });
});

describe("a piece's family", () => {
  it("is just the piece itself when nothing came before or after", async () => {
    const solo = await seedDesign("ada", { title: "Solo", published: true });
    expect(await readFamily(solo.slug)).toEqual({
      chain: [
        {
          slug: solo.slug,
          title: "Solo",
          mockupUrl: solo.mockupUrl,
          maker: { name: "Ada Royal", handle: "ada" },
          onRack: true,
        },
      ],
      broken: false,
      remixes: [],
      remixCount: 0,
      descendants: 0,
      atLeast: false,
    });
  });

  it("runs from the original down to the piece, and never shows the account name of a maker with no page", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const third = await publishedRemix("cy", second.slug);

    const family = await readFamily(third.slug);
    expect(family.chain.map((item) => item.title)).toEqual([
      "Do Better",
      "Do Better remix",
      "Do Better remix",
    ]);
    expect(family.chain.map((item) => item.slug)).toEqual([root.slug, second.slug, third.slug]);
    expect(family.chain.map((item) => item.maker)).toEqual([
      { name: "Ada Royal", handle: "ada" },
      { name: "Bo Knows", handle: "bo" },
      { name: "A maker", handle: null },
    ]);
    expect(family.broken).toBe(false);
    expect(family.remixes).toEqual([]);
  });

  it("still credits a parent that left the rack, without a link or a picture", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const third = await publishedRemix("cy", second.slug);
    await setStatus(second.id, "draft");

    const family = await readFamily(third.slug);
    expect(family.chain).toHaveLength(3);
    expect(family.chain[0]).toMatchObject({ slug: root.slug, onRack: true });
    expect(family.chain[1]).toEqual({
      slug: null,
      title: "An earlier piece",
      mockupUrl: null,
      maker: { name: "Bo Knows", handle: "bo" },
      onRack: false,
    });
    // The original still counts the grandchild that is on the rack, through the gap.
    const fromRoot = await readFamily(root.slug);
    expect(fromRoot.remixes).toEqual([]);
    expect(fromRoot.remixCount).toBe(0);
    expect(fromRoot.descendants).toBe(1);
  });

  it("keeps a place for a deleted parent", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const sql = await getSql();
    await sql`delete from designs where id = ${root.id}`;

    const family = await readFamily(second.slug);
    expect(family.broken).toBe(false);
    expect(family.chain).toHaveLength(2);
    expect(family.chain[0]).toEqual({
      slug: null,
      title: null,
      mockupUrl: null,
      maker: null,
      onRack: false,
    });
  });

  it("still names the original when a piece in the middle was deleted", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const third = await publishedRemix("cy", second.slug);
    const sql = await getSql();
    await sql`delete from designs where id = ${second.id}`;

    const family = await readFamily(third.slug);
    expect(family.broken).toBe(true);
    expect(family.chain.map((item) => item.title)).toEqual(["Do Better", null, "Do Better remix"]);
    expect(family.chain[0]).toMatchObject({ slug: root.slug, maker: { handle: "ada" } });
  });

  it("lists direct remixes on the rack and counts everything below", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const first = await publishedRemix("bo", root.slug);
    const second = await publishedRemix("cy", root.slug);
    await remixDesign("cy", root.slug); // a draft, so it is not counted anywhere
    const grand = await publishedRemix("ada", first.slug);
    await publishedRemix("bo", grand.slug);
    await publishedRemix("cy", first.slug);

    const family = await readFamily(root.slug);
    expect(family.remixes.map((item) => [item.slug, item.below])).toEqual([
      [first.slug, 3],
      [second.slug, 0],
    ]);
    expect(family.remixes[0]?.maker).toEqual({ name: "Bo Knows", handle: "bo" });
    expect(family.remixCount).toBe(2);
    expect(family.descendants).toBe(5);

    const middle = await readFamily(first.slug);
    expect(middle.chain.map((item) => item.slug)).toEqual([root.slug, first.slug]);
    expect(middle.remixCount).toBe(2);
    expect(middle.descendants).toBe(3);
  });

  it("leaves a heavy picture out and keeps the piece", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const second = await publishedRemix("bo", root.slug);
    const sql = await getSql();
    const heavy = `data:image/svg+xml;utf8,${"x".repeat(4000)}`;
    const light = "data:image/svg+xml;utf8,%3Csvg%2F%3E";
    await sql`update designs set mockup_url = ${heavy} where id = ${root.id}`;
    await sql`update designs set mockup_url = ${light} where id = ${second.id}`;

    const limits = { ...FAMILY_LIMITS, picture: 1000 };
    const family = await readFamily(second.slug, limits);
    expect(family.chain[0]).toMatchObject({ slug: root.slug, onRack: true, mockupUrl: null });
    expect(family.chain[1]?.mockupUrl).toBe(light);
    const fromRoot = await readFamily(root.slug, limits);
    expect(fromRoot.chain[0]?.mockupUrl).toBeNull();
    expect(fromRoot.remixes[0]?.mockupUrl).toBe(light);
    // With room for it, the same picture comes through.
    expect((await readFamily(root.slug)).chain[0]?.mockupUrl).toBe(heavy);
  });

  it("stops sending pictures once one answer holds enough of them", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    await publishedRemix("bo", root.slug);
    await publishedRemix("cy", root.slug);
    const sql = await getSql();
    const picture = `data:image/svg+xml;utf8,${"x".repeat(476)}`;
    await sql`update designs set mockup_url = ${picture}`;

    // Room for two pictures of 500 characters: this piece and its first remix.
    const family = await readFamily(root.slug, { ...FAMILY_LIMITS, pictures: 1000 });
    expect(family.chain[0]?.mockupUrl).toBe(picture);
    expect(family.remixes.map((item) => item.mockupUrl)).toEqual([picture, null]);
    expect(family.remixes.every((item) => item.onRack && item.slug)).toBe(true);
  });

  it("spends the picture budget on the earliest nodes", () => {
    const tile = (size: number): FamilyNode => ({
      slug: "s",
      title: "t",
      mockupUrl: size ? "x".repeat(size) : null,
      maker: null,
      onRack: true,
    });
    const nodes = [tile(6), tile(0), tile(5), tile(4)];
    keepPicturesLight(nodes, 10);
    // 6 fits, 5 would overflow, 4 still fits in what is left.
    expect(nodes.map((item) => item.mockupUrl?.length ?? 0)).toEqual([6, 0, 0, 4]);
  });

  it("stops counting a huge family and says the number is a floor", async () => {
    const root = await seedDesign("ada", { title: "Do Better", published: true });
    const first = await publishedRemix("bo", root.slug);
    await publishedRemix("cy", root.slug);
    await publishedRemix("ada", first.slug);

    const whole = await readFamily(root.slug);
    expect(whole.atLeast).toBe(false);
    expect(whole.descendants).toBe(3);

    const cut = await readFamily(root.slug, { ...FAMILY_LIMITS, walk: 2 });
    expect(cut.atLeast).toBe(true);
    expect(cut.descendants).toBe(2);
    // The list of direct remixes does not depend on the walk.
    expect(cut.remixes).toHaveLength(2);
  });

  it("refuses a draft and a slug that does not exist", async () => {
    const draft = await seedDesign("ada", { title: "Still Cooking" });
    await expect(readFamily(draft.slug)).rejects.toThrow(/not on the rack/);
    await expect(readFamily("nope")).rejects.toThrow(/not on the rack/);
  });
});
