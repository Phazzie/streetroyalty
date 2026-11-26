import { beforeEach, describe, expect, it } from "vitest";
import { generateMockup } from "./designs.server.ts";
import { loadCatalog, loadProduct, readStudioConfig } from "./shared.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { TEE } from "../../test/seed.ts";

const LAYERS = [{ type: "text", text: "CROWN", x: 0.5, y: 0.5, scale: 1, rotation: 0 }];

beforeEach(truncateAll);

describe("the studio catalog", () => {
  it("lists blanks a page at a time, and says which mode the shop is in", async () => {
    const page = await loadCatalog(1, 2);
    expect(page).toMatchObject({
      provider: "sandbox",
      podMode: "sandbox",
      paymentsMode: "sandbox",
      total: 9,
      offset: 1,
      limit: 2,
    });
    expect(page.products.map((product) => product.id)).toEqual(["hoodie-pullover", "crew-sweat"]);
    expect(page.products[0]).not.toHaveProperty("variants");
  });

  it("loads one blank with its sizes and prices", async () => {
    const product = await loadProduct(TEE.productId);
    expect(product.podMode).toBe("sandbox");
    expect(product.variants.find((variant) => variant.id === TEE.variantId)?.retailCents).toBe(
      3432,
    );
  });

  it("reports the configured markup and currency", () => {
    process.env.STUDIO_MARKUP = "3";
    expect(readStudioConfig()).toMatchObject({ markup: 3, currency: "USD" });
  });
});

describe("mockups", () => {
  const request = {
    productId: TEE.productId,
    variantId: TEE.variantId,
    placement: "front",
    layers: LAYERS,
  };

  it.each([
    ["a size that does not exist", { variantId: "tee-heavy-black-9xl" }, /color and size/],
    ["a placement the blank does not have", { placement: "hood" }, /placement/],
    ["no layers", { layers: [] }, /at least one layer/],
  ])("are refused for %s", async (_what, change, message) => {
    await expect(generateMockup({ ...request, ...change })).rejects.toThrow(message);
  });

  it("need a signed-in user and a print file once printing is live", async () => {
    process.env.POD_MODE = "live";
    process.env.PRINTFUL_API_KEY = "pf_test";
    process.env.PRINT_FILE_SIGNING_SECRET = "a-long-secret";
    process.env.APP_PUBLIC_URL = "https://streetroyalty.com";
    // Live mode asks Printful for the catalog. With no mock for it the request fails, which is the point:
    // nothing reaches Printful's mockup endpoint for an anonymous visitor.
    await expect(generateMockup({ ...request, printFile: pngDataUrl(10, 10) })).rejects.toThrow();
  });
});
