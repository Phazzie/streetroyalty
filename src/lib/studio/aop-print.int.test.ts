import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import { AOP_RECIPE_MIME, renderAopPrintFile, saveAopRecipe } from "./aop-print.server.ts";
import { defaultGarment, setPanelFill, type GarmentDesign } from "./garments.ts";
import { server, seenTo } from "../../test/msw/server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { seedUser } from "../../test/seed.ts";

const PNG = Buffer.from(pngDataUrl(4, 4).split(",")[1]!, "base64");

function withArt(srcs: Record<string, string>): GarmentDesign {
  let garment = defaultGarment("aop-hoodie");
  for (const [panel, src] of Object.entries(srcs)) {
    garment = setPanelFill(garment, panel, { kind: "art", src });
  }
  return garment;
}

async function storeRow(id: string, mime: string, bytes: Buffer) {
  const sql = await getSql();
  await sql`
    insert into print_files (id, user_id, mime, data_base64)
    values (${id}, ${"ada"}, ${mime}, ${bytes.toString("base64")})
  `;
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
});

describe("rendering a stored all-over recipe", () => {
  it("fetches only usable remote art, and keeps going when a picture fails", async () => {
    server.use(
      http.get("https://art.test/ok.png", () =>
        HttpResponse.arrayBuffer(new Uint8Array(PNG).buffer, {
          headers: { "content-type": "image/png; charset=binary" },
        }),
      ),
      http.get("https://art.test/missing.png", () => new HttpResponse(null, { status: 404 })),
      http.get("https://art.test/page.png", () =>
        HttpResponse.text("<html></html>", { headers: { "content-type": "text/html" } }),
      ),
      http.get("https://art.test/broken.png", () => HttpResponse.error()),
    );
    const logo = crypto.randomUUID();
    await storeRow(logo, "image/png", PNG);
    const recipe = await saveAopRecipe("ada", {
      templateId: "aop-hoodie",
      garment: withArt({
        body_front: "https://art.test/ok.png",
        hood: "https://art.test/missing.png",
        pocket: "https://art.test/page.png",
        sleeve_left: "https://art.test/broken.png",
      }),
      colorwayId: null,
      logoFileId: logo,
    });
    const file = await renderAopPrintFile(recipe, "pocket");
    expect(file?.mime).toBe("image/png");
    expect(
      seenTo("art.test")
        .map((entry) => new URL(entry.url).pathname)
        .sort(),
    ).toEqual(["/broken.png", "/missing.png", "/ok.png", "/page.png"]);
  }, 60_000);

  it("skips a logo that is not a picture, and refuses rows that are not recipes", async () => {
    const logo = crypto.randomUUID();
    await storeRow(logo, "text/plain", Buffer.from("not a picture"));
    const recipe = await saveAopRecipe("ada", {
      templateId: "aop-hoodie",
      garment: defaultGarment("aop-hoodie"),
      colorwayId: "black-gold",
      logoFileId: logo,
    });
    expect((await renderAopPrintFile(recipe, "pocket"))?.mime).toBe("image/png");

    const plain = crypto.randomUUID();
    await storeRow(plain, "image/png", PNG);
    expect(await renderAopPrintFile(plain, "front")).toBeNull();
    const sql = await getSql();
    const rows = await sql<{ mime: string }>`select mime from print_files where id = ${recipe}`;
    expect(rows[0]?.mime).toBe(AOP_RECIPE_MIME);
  }, 60_000);
});
