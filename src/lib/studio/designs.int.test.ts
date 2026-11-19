import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { printFileToken, SANDBOX_PRINT_SECRET } from "../pod/print-access.ts";
import {
  createCollection,
  generateMockup,
  getDesign,
  getShopDesign,
  listCollections,
  listDesigns,
  listShop,
  publishDesign,
  readPrintFile,
  saveDesign,
} from "./designs.server.ts";
import { authorizePrintFile } from "./shared.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { TEE, seedDesign, seedUser } from "../../test/seed.ts";

const LAYERS = [{ id: "t1", type: "text", text: "CROWN", x: 0.5, y: 0.4, scale: 1, rotation: 0 }];
const BASE = {
  title: "Crown Tee",
  productId: TEE.productId,
  variantId: TEE.variantId,
  placement: "front",
  layers: LAYERS,
};

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("saving a design", () => {
  it("stores the piece with the catalog's price and names, as a draft", async () => {
    const saved = await saveDesign("ada", { ...BASE, printFile: pngDataUrl(1800, 2400) });
    expect(saved).toMatchObject({
      title: "Crown Tee",
      status: "draft",
      retailCents: 3069,
      warnings: [],
    });
    expect(saved.slug).toMatch(/^crown-tee-[0-9a-f]{8}$/);
    expect(saved.printFileId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("warns when the print file is too small to print sharp", async () => {
    const saved = await saveDesign("ada", { ...BASE, printFile: pngDataUrl(600, 800) });
    expect(saved.warnings).toHaveLength(1);
    expect(saved.warnings[0]).toMatch(/600×800px/);
  });

  it.each([
    ["a one-letter title", { title: "x" }, /Name the piece/],
    ["no layers", { layers: [] }, /at least one layer/],
    ["nine layers", { layers: Array.from({ length: 9 }, () => LAYERS[0]) }, /Eight layers/],
    [
      "a size that is not in the catalog",
      { variantId: "tee-heavy-black-9xl" },
      /not in the catalog/,
    ],
    [
      "a placement the product does not have",
      { placement: "sleeve_left", productId: "hat-dad", variantId: "hat-dad-black-one-size" },
      /does not print there/,
    ],
    [
      "an SVG as the print file",
      { printFile: "data:image/svg+xml;base64,PHN2Zy8+" },
      /PNG or JPEG/,
    ],
    [
      "a script URL as artwork",
      {
        layers: [{ type: "image", src: "javascript:alert(1)", x: 0, y: 0, scale: 1, rotation: 0 }],
      },
      /Artwork has to be/,
    ],
  ])("refuses %s", async (_what, change, message) => {
    await expect(saveDesign("ada", { ...BASE, ...change })).rejects.toThrow(message);
    expect(await listDesigns("ada")).toEqual([]);
  });

  it("clamps layer positions and scale into the printable range", async () => {
    const saved = await saveDesign("ada", {
      ...BASE,
      layers: [{ type: "text", text: "X", x: 9, y: -4, scale: 100, rotation: 9999 }],
    });
    expect(saved.layers[0]).toMatchObject({ x: 1, y: 0, scale: 3, rotation: 180 });
  });

  it("updates in place and keeps the earlier print file when none is sent", async () => {
    const first = await saveDesign("ada", { ...BASE, printFile: pngDataUrl(1800, 2400) });
    const second = await saveDesign("ada", { ...BASE, id: first.id, title: "Renamed" });
    expect(second).toMatchObject({
      id: first.id,
      title: "Renamed",
      printFileId: first.printFileId,
      slug: first.slug,
    });
    expect(await listDesigns("ada")).toHaveLength(1);
  });

  it("refuses to save over someone else's design", async () => {
    const theirs = await seedDesign("ada");
    await expect(saveDesign("bo", { ...BASE, id: theirs.id, title: "Mine now" })).rejects.toThrow(
      /not on your rack/,
    );
    expect((await getDesign("ada", theirs.id)).title).toBe("Crown Tee");
  });

  it("refuses to file a design under someone else's collection", async () => {
    const collection = await createCollection("ada", "Summer");
    await expect(saveDesign("bo", { ...BASE, collectionId: collection.id })).rejects.toThrow(
      /not yours/,
    );
  });

  it("keeps a title with markup in it as plain text", async () => {
    const saved = await saveDesign("ada", { ...BASE, title: '<img src=x onerror="alert(1)">' });
    expect(saved.title).toBe('<img src=x onerror="alert(1)">');
    expect(saved.slug).toMatch(/^img-src-x-onerror-alert-1-[0-9a-f]{8}$/);
  });
});

describe("collections", () => {
  it("counts the designs in each, per person", async () => {
    const summer = await createCollection("ada", "  Summer  ");
    await saveDesign("ada", { ...BASE, collectionId: summer.id });
    await createCollection("bo", "Bo's");
    expect(await listCollections("ada")).toEqual([{ id: summer.id, name: "Summer", count: 1 }]);
  });

  it("needs a name", async () => {
    await expect(createCollection("ada", " ")).rejects.toThrow(/Name the collection/);
  });
});

describe("publishing", () => {
  it("needs a print file and a mockup first", async () => {
    const bare = await saveDesign("ada", BASE);
    await expect(publishDesign("ada", bare.id)).rejects.toThrow(/print file/);
    const withFile = await saveDesign("ada", {
      ...BASE,
      id: bare.id,
      printFile: pngDataUrl(1800, 2400),
    });
    await expect(publishDesign("ada", withFile.id)).rejects.toThrow(/mockup/);
  });

  it("puts the piece on the rack for everyone", async () => {
    const draft = await seedDesign("ada");
    expect(await listShop()).toEqual([]);
    await expect(getShopDesign(draft.slug)).rejects.toThrow(/not on the rack/);

    const published = await publishDesign("ada", draft.id);

    expect(published.status).toBe("published");
    expect((await listShop()).map((design) => design.id)).toEqual([draft.id]);
    const page = await getShopDesign(draft.slug);
    expect(page.sizes.map((size) => size.label)).toEqual(["S", "M", "L", "XL", "2XL"]);
    expect(page.sizes.every((size) => size.variantId.startsWith("tee-heavy-black-"))).toBe(true);
  });

  it("refuses to publish someone else's design", async () => {
    const draft = await seedDesign("ada");
    await expect(publishDesign("bo", draft.id)).rejects.toThrow(/not on your rack/);
    expect(await listShop()).toEqual([]);
  });

  it("refuses to publish a sandbox blank once printing is live and that blank is not bound", async () => {
    const draft = await seedDesign("ada");
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test";
    process.env.APP_PUBLIC_URL = "https://streetroyalty.com";
    await expect(publishDesign("ada", draft.id)).rejects.toThrow(/not bound to this printer/);
  });

  it("leaves the draft unpublished when live printing has no binding for the blank", async () => {
    const draft = await seedDesign("ada");
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test";
    process.env.PRINT_FILE_SIGNING_SECRET = "a-long-secret";
    process.env.APP_PUBLIC_URL = "http://10.0.0.5:8080";
    await expect(publishDesign("ada", draft.id)).rejects.toThrow(/not bound to this printer/);
    expect((await getDesign("ada", draft.id)).status).toBe("draft");
  });
});

describe("mockups", () => {
  it("draws one for a real product and placement", async () => {
    const mockup = await generateMockup({ ...BASE });
    expect(mockup.mockupUrl).toMatch(/^data:image\/svg\+xml/);
  });

  it("keeps hostile text inside the picture as text", async () => {
    const mockup = await generateMockup({
      ...BASE,
      layers: [
        {
          type: "text",
          text: "</text><script>alert(1)</script>",
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
        },
      ],
    });
    const svg = decodeURIComponent(mockup.mockupUrl.slice(mockup.mockupUrl.indexOf(",") + 1));
    expect(svg).not.toMatch(/<script/i);
    expect(svg).toContain("&lt;script&gt;");
  });
});

describe("print files", () => {
  it("returns the exact bytes that were saved", async () => {
    const file = pngDataUrl(300, 300);
    const saved = await saveDesign("ada", { ...BASE, printFile: file });
    const read = await readPrintFile(saved.printFileId ?? "");
    expect(read?.mime).toBe("image/png");
    expect(Buffer.from(read?.bytes ?? []).toString("base64")).toBe(file.split(",")[1]);
  });

  it.each(["", "abc", "../../etc/passwd", "1' or '1'='1", "g".repeat(36)])(
    "answers nothing for the id %j",
    async (id) => {
      expect(await readPrintFile(id)).toBeNull();
    },
  );

  it("answers nothing for a well-formed id that does not exist", async () => {
    expect(await readPrintFile("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("opens only with the token made for that file", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const token = printFileToken(id, SANDBOX_PRINT_SECRET);
    expect(authorizePrintFile(id, token)).toBe(true);
    expect(authorizePrintFile(id, null)).toBe(false);
    expect(authorizePrintFile(id, "")).toBe(false);
    expect(authorizePrintFile(id, token.slice(0, -1) + "0")).toBe(false);
    expect(authorizePrintFile("11111111-0000-4000-8000-000000000000", token)).toBe(false);
  });

  it("stops accepting sandbox tokens once a real secret is set", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    process.env.PRINT_FILE_SIGNING_SECRET = "a-long-secret";
    expect(authorizePrintFile(id, printFileToken(id, SANDBOX_PRINT_SECRET))).toBe(false);
    expect(authorizePrintFile(id, printFileToken(id, "a-long-secret"))).toBe(true);
  });

  it("opens nothing in live mode when the signing secret is missing", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    process.env.POD_MODE = "live";
    expect(authorizePrintFile(id, printFileToken(id, SANDBOX_PRINT_SECRET))).toBe(false);
  });
});

describe("a person's rack", () => {
  it("lists only their own designs", async () => {
    const mine = await seedDesign("ada");
    await seedDesign("bo", { title: "Bo Tee" });
    expect((await listDesigns("ada")).map((design) => design.id)).toEqual([mine.id]);
  });

  it("does not open someone else's design, published or not", async () => {
    const theirs = await seedDesign("ada", { published: true });
    await expect(getDesign("bo", theirs.id)).rejects.toThrow(/not on your rack/);
  });

  it("does not hand the layers of a published design to the public listing", async () => {
    await seedDesign("ada", { published: true });
    const [listed] = await listShop();
    expect(listed).not.toHaveProperty("layers");
    expect(listed).not.toHaveProperty("printFileId");
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*) as n from print_files`;
    expect(rows[0]?.n).toBe(1);
  });
});
