import { beforeEach, describe, expect, it } from "vitest";
import { storePrintFile } from "./designs.server.ts";
import { checkPhotoMockup, makePhotoMockup, photoMockupsReady } from "./photo.server.ts";
import { readStudioConfig } from "./shared.server.ts";
import type { PhotoSet, PrintfulProvider } from "../pod/printful.ts";
import type { CatalogProduct } from "../pod/types.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { seedUser } from "../../test/seed.ts";

type Sent = Parameters<PrintfulProvider["createPhotoSet"]>[0];

function fakePrintful(options: {
  set?: Partial<PhotoSet>;
  later?: Partial<PhotoSet>;
  product?: CatalogProduct | Error;
} = {}) {
  const sent: Sent[] = [];
  const asked: string[] = [];
  const provider = {
    async getProduct() {
      if (options.product instanceof Error) throw options.product;
      return options.product ?? ({ variants: [] } as unknown as CatalogProduct);
    },
    async createPhotoSet(input: Sent) {
      sent.push(input);
      return {
        taskId: "77",
        status: "completed",
        photos: [{ placement: "front", url: "https://files.cdn.printful.com/m/front.jpg" }],
        ...options.set,
      } as PhotoSet;
    },
    async getPhotoSet(taskId: string) {
      asked.push(taskId);
      return { taskId, status: "completed", photos: [], ...options.later } as PhotoSet;
    },
  } as unknown as PrintfulProvider;
  return { provider, sent, asked };
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
  process.env.APP_PUBLIC_URL = "https://streetroyalty.com";
  delete process.env.PRINTFUL_API_KEY;
});

describe("real photo mockups", () => {
  it("are ready only with a Printful key and a public address", () => {
    expect(photoMockupsReady({})).toBe(false);
    expect(photoMockupsReady({ PRINTFUL_API_KEY: "k" })).toBe(false);
    expect(photoMockupsReady({ PRINTFUL_API_KEY: "k", APP_PUBLIC_URL: "http://localhost:8080" })).toBe(false);
    expect(photoMockupsReady({ PRINTFUL_API_KEY: "k", APP_PUBLIC_URL: "https://streetroyalty.com" })).toBe(true);
    expect(readStudioConfig().photoMockups).toBe(false);
    process.env.PRINTFUL_API_KEY = "key";
    expect(readStudioConfig().photoMockups).toBe(true);
  });

  it("say so plainly when the shop has no key", async () => {
    await expect(
      makePhotoMockup("ada", { productId: "tee-heavy", variantId: "tee-heavy-black-m", spots: [] }),
    ).rejects.toThrow(/Printful key/);
    await expect(checkPhotoMockup("12")).rejects.toThrow(/Printful key/);
  });

  it("send every spot of a house piece as the real Printful product and variant", async () => {
    const front = await storePrintFile("ada", pngDataUrl(1800, 2400));
    const back = await storePrintFile("ada", pngDataUrl(1800, 2400));
    const { provider, sent } = fakePrintful({
      product: {
        variants: [
          { id: "9999", printAreas: [] },
          {
            id: "",
            printAreas: [{ placement: "front", widthIn: 12, heightIn: 16, dpi: 150 }],
          },
        ],
      } as unknown as CatalogProduct,
    });
    const result = await makePhotoMockup(
      "ada",
      {
        productId: "tee-heavy",
        variantId: "tee-heavy-black-m",
        spots: [
          { placement: "front", printFileId: front },
          { placement: "back", printFileId: back },
          // The same spot twice is sent once.
          { placement: "front", printFileId: front },
        ],
      },
      { provider },
    );
    expect(result.status).toBe("completed");
    expect(result.photos[0]?.url).toContain("printful");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.productId).toBe("586");
    expect(sent[0]?.variantId).toMatch(/^\d+$/);
    expect(sent[0]?.technique).toBe("dtg");
    expect(sent[0]?.spots.map((spot) => spot.placement)).toEqual(["front", "back"]);
    expect(sent[0]?.spots[0]?.url).toMatch(/^https:\/\/streetroyalty\.com\//);
  });

  it("take a Printful variant id as it is, and Printful's print areas when it has them", async () => {
    const front = await storePrintFile("ada", pngDataUrl(1800, 2400));
    const { provider, sent } = fakePrintful({
      product: {
        variants: [{ id: "4011", printAreas: [{ placement: "front", widthIn: 12, heightIn: 16, dpi: 150 }] }],
      } as unknown as CatalogProduct,
      set: { status: "pending", photos: [] },
    });
    const result = await makePhotoMockup(
      "ada",
      { productId: "586", variantId: "4011", spots: [{ placement: "front", printFileId: front }] },
      { provider },
    );
    expect(result).toMatchObject({ taskId: "77", status: "pending" });
    expect(sent[0]?.spots[0]?.area).toMatchObject({ widthIn: 12, heightIn: 16 });
  });

  it("still ask for photos when Printful's product details do not load", async () => {
    const front = await storePrintFile("ada", pngDataUrl(600, 800));
    const { provider, sent } = fakePrintful({ product: new Error("down") });
    await makePhotoMockup(
      "ada",
      { productId: "tee-heavy", variantId: "tee-heavy-black-m", spots: [{ placement: "front", printFileId: front }] },
      { provider },
    );
    expect(sent[0]?.spots[0]?.area).toBeUndefined();
  });

  it("refuse anything that is not a real piece, spot or file of yours", async () => {
    const mine = await storePrintFile("ada", pngDataUrl(600, 800));
    const theirs = await storePrintFile("bo", pngDataUrl(600, 800));
    const { provider } = fakePrintful();
    const ask = (input: { productId?: string; variantId?: string; spots: unknown }) =>
      makePhotoMockup(
        "ada",
        { productId: "tee-heavy", variantId: "tee-heavy-black-m", ...input },
        { provider },
      );
    await expect(ask({ productId: "made-up", spots: [] })).rejects.toThrow(/shop's own pieces/);
    await expect(ask({ variantId: "nope", spots: [] })).rejects.toThrow(/colour and size/);
    await expect(ask({ spots: [] })).rejects.toThrow(/Put art/);
    await expect(ask({ spots: "front" })).rejects.toThrow(/Put art/);
    await expect(ask({ spots: [{ placement: "pocket", printFileId: mine }] })).rejects.toThrow(/not on this piece/);
    await expect(ask({ spots: [{ placement: "front" }] })).rejects.toThrow(/missing its print file/);
    await expect(ask({ spots: [null] })).rejects.toThrow(/not on this piece/);
    await expect(ask({ spots: [{ placement: "front", printFileId: theirs }] })).rejects.toThrow(/not yours/);
  });

  it("refuse when Printful could not fetch the print file", async () => {
    process.env.APP_PUBLIC_URL = "http://10.0.0.5:8080";
    const front = await storePrintFile("ada", pngDataUrl(600, 800));
    const { provider } = fakePrintful();
    await expect(
      makePhotoMockup(
        "ada",
        { productId: "tee-heavy", variantId: "tee-heavy-black-m", spots: [{ placement: "front", printFileId: front }] },
        { provider },
      ),
    ).rejects.toThrow(/APP_PUBLIC_URL/);
  });

  it("pass on Printful's reason when it fails", async () => {
    const front = await storePrintFile("ada", pngDataUrl(600, 800));
    const failed = fakePrintful({ set: { status: "failed", error: "File too small" } });
    const spots = [{ placement: "front", printFileId: front }];
    await expect(
      makePhotoMockup("ada", { productId: "tee-heavy", variantId: "tee-heavy-black-m", spots }, { provider: failed.provider }),
    ).rejects.toThrow("File too small");
    const silent = fakePrintful({ set: { status: "failed" } });
    await expect(
      makePhotoMockup("ada", { productId: "tee-heavy", variantId: "tee-heavy-black-m", spots }, { provider: silent.provider }),
    ).rejects.toThrow(/could not make/);
  });

  it("check on a task that was still rendering", async () => {
    const done = fakePrintful({ later: { photos: [{ placement: "back", url: "https://x/back.jpg" }] } });
    const result = await checkPhotoMockup(" 77 ", { provider: done.provider });
    expect(done.asked).toEqual(["77"]);
    expect(result.photos[0]?.placement).toBe("back");
    await expect(checkPhotoMockup("../../etc", { provider: done.provider })).rejects.toThrow(/not one of ours/);
    const failed = fakePrintful({ later: { status: "failed", error: "Nope" } });
    await expect(checkPhotoMockup("78", { provider: failed.provider })).rejects.toThrow("Nope");
    const silent = fakePrintful({ later: { status: "failed" } });
    await expect(checkPhotoMockup("79", { provider: silent.provider })).rejects.toThrow(/could not make/);
  });

  it("build a real Printful client from the key", async () => {
    process.env.PRINTFUL_API_KEY = "key";
    const front = await storePrintFile("ada", pngDataUrl(600, 800));
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
    }) as typeof fetch;
    try {
      await expect(
        makePhotoMockup("ada", {
          productId: "tee-heavy",
          variantId: "tee-heavy-black-m",
          spots: [{ placement: "front", printFileId: front }],
        }),
      ).rejects.toThrow("Unauthorized");
      expect(calls.some((url) => url.includes("/v2/mockup-tasks"))).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
