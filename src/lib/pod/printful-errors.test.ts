import { describe, expect, it } from "vitest";
import { createPrintfulProvider } from "./printful.ts";
import { PodError } from "./types.ts";

type Reply = { status?: number; body?: string; json?: unknown; fail?: boolean };

function printful(reply: (url: string, init: RequestInit) => Reply) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const answer = reply(String(url), init);
    if (answer.fail) throw new Error("socket hang up");
    const body = answer.body ?? (answer.json === undefined ? "" : JSON.stringify(answer.json));
    return new Response(body || null, { status: answer.status ?? 200 });
  }) as typeof fetch;
  return {
    calls,
    provider: createPrintfulProvider({
      apiKey: "pf_key",
      storeId: "store-9",
      fetchImpl,
      mockupPoll: { attempts: 2, delayMs: 0 },
    }),
  };
}

const MOCKUP = {
  productId: "71",
  variantId: "4011",
  placement: "front",
  technique: "dtg",
  colorHex: "#000000",
  productType: "T-Shirt",
  layers: [],
  fileUrl: "https://shop.test/f.png",
};

describe("what Printful says when it refuses", () => {
  it.each([
    [
      "an error object with a message",
      { error: { message: "Invalid variant" } },
      "Invalid variant",
    ],
    ["an error object with a reason", { error: { reason: "Bad Request" } }, "Bad Request"],
    ["a bare error string", { error: "Not allowed" }, "Not allowed"],
    ["nothing useful", {}, "Printful error 422"],
  ])("is passed on from %s, with the status", async (_what, json, message) => {
    const { provider } = printful(() => ({ status: 422, json }));
    const error = await provider.confirmOrder("55").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PodError);
    expect(error).toMatchObject({ message, status: 422 });
  });

  it("is reported as a bad gateway when the connection fails", async () => {
    const { provider } = printful(() => ({ fail: true }));
    await expect(provider.getOrder("55")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("socket hang up"),
    });
  });

  it("is reported plainly when the answer is not JSON", async () => {
    const { provider } = printful(() => ({ status: 502, body: "<html>Bad Gateway</html>" }));
    await expect(provider.getOrder("55")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("non-JSON"),
    });
  });
});

describe("requests to Printful", () => {
  it("carry the key and the store id on every call", async () => {
    const { provider, calls } = printful(() => ({ json: { data: { id: 55, status: "draft" } } }));
    await provider.getOrder("55");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer pf_key");
    expect(headers["X-PF-Store-Id"]).toBe("store-9");
  });

  it("escape an id before it goes into the path", async () => {
    const { provider, calls } = printful(() => ({ json: { data: { id: 55, status: "draft" } } }));
    await provider.getOrder("55/../../store");
    expect(calls[0]?.url).toBe("https://api.printful.com/v2/orders/55%2F..%2F..%2Fstore");
  });
});

describe("reading an order back", () => {
  it.each([
    ["draft", false],
    ["failed", false],
    ["canceled", false],
    ["pending", true],
    ["inprocess", true],
    ["fulfilled", true],
  ])("treats a %s order as confirmed: %s", async (status, confirmed) => {
    const { provider } = printful(() => ({
      json: { data: { id: 55, external_id: "ord-1", status } },
    }));
    expect(await provider.getOrder("55")).toEqual({
      id: "55",
      externalId: "ord-1",
      status,
      confirmed,
    });
  });

  it("cancels with a DELETE", async () => {
    const { provider, calls } = printful(() => ({ status: 204 }));
    await provider.cancelOrder("55");
    expect(calls[0]?.init.method).toBe("DELETE");
  });
});

describe("a Printful mockup", () => {
  it("is refused before any call when there is no public file link", async () => {
    const { provider, calls } = printful(() => ({ json: {} }));
    await expect(provider.createMockup({ ...MOCKUP, fileUrl: undefined })).rejects.toMatchObject({
      status: 400,
    });
    expect(calls).toEqual([]);
  });

  it("is polled until it finishes", async () => {
    let asked = 0;
    const { provider } = printful((url) => {
      if (url.endsWith("/v2/mockup-tasks"))
        return { json: { data: [{ id: 7, status: "pending" }] } };
      asked += 1;
      return asked < 2
        ? { json: { data: [{ id: 7, status: "pending" }] } }
        : {
            json: {
              data: [
                {
                  id: 7,
                  status: "completed",
                  catalog_variant_mockups: [
                    { mockups: [{ mockup_url: "https://cdn.test/m.jpg" }] },
                  ],
                },
              ],
            },
          };
    });
    const mockup = await provider.createMockup(MOCKUP);
    expect(asked).toBe(2);
    expect(mockup.status).toBe("completed");
  });

  it("stops polling after the allowed attempts and reports it still pending", async () => {
    const { provider, calls } = printful(() => ({
      json: { data: [{ id: 7, status: "pending" }] },
    }));
    const mockup = await provider.createMockup(MOCKUP);
    expect(mockup.status).toBe("pending");
    expect(calls).toHaveLength(3);
  });
});

describe("syncing a product to the Printful store", () => {
  const input = {
    externalId: "d1",
    name: "Tee",
    variants: [
      {
        catalogVariantId: "4011",
        retailPrice: "30.69",
        files: [{ placement: "front", url: "https://shop.test/f.png" }],
      },
    ],
  };

  it("creates it the first time and updates it after", async () => {
    const { provider, calls } = printful(() => ({
      json: { result: { sync_product: { id: 3301 } } },
    }));
    expect(await provider.syncProduct(input)).toEqual({ id: "3301" });
    expect(await provider.syncProduct({ ...input, existingId: "3301" })).toEqual({ id: "3301" });
    expect(
      calls.map((call) => [call.init.method, call.url.replace("https://api.printful.com", "")]),
    ).toEqual([
      ["POST", "/store/products"],
      ["PUT", "/store/products/3301"],
    ]);
  });

  it("fails loudly when Printful answers without an id", async () => {
    const { provider } = printful(() => ({ json: { result: {} } }));
    await expect(provider.syncProduct(input)).rejects.toMatchObject({ status: 502 });
  });
});

describe("the Printful catalog", () => {
  it("answers 404 for a product Printful does not return", async () => {
    const { provider } = printful(() => ({ json: { data: null } }));
    await expect(provider.getProduct("71")).rejects.toMatchObject({ status: 404 });
  });

  it("leaves a variant unpriced, and so unsellable, when Printful sends no price", async () => {
    const { provider } = printful((url) => {
      if (url.includes("/catalog-variants"))
        return {
          json: {
            data: [
              {
                id: 4011,
                name: "Tee",
                size: "M",
                color: "Black",
                color_code: "#141414",
                placement_dimensions: [{ placement: "front", width: 12, height: 16 }],
              },
            ],
          },
        };
      if (url.includes("/prices")) return { status: 500, json: { error: "down" } };
      return {
        json: {
          data: {
            id: 71,
            name: "Tee",
            type: "T-Shirt",
            techniques: [{ key: "dtg", is_default: true }],
            placements: [{ placement: "front", technique: "dtg" }],
          },
        },
      };
    });
    const product = await provider.getProduct("71");
    expect(product.variants[0]?.retailCents ?? null).toBeNull();
  });

  it("drops shipping rates it cannot read a price from", async () => {
    const { provider } = printful(() => ({
      json: {
        data: [{ shipping: "STANDARD", rate: "4.75" }, { shipping: "BROKEN", rate: "free" }, null],
      },
    }));
    const rates = await provider.shippingRates({
      recipient: { name: "A", address1: "1", city: "c", countryCode: "US", zip: "1" },
      currency: "USD",
      items: [],
    });
    expect(rates.map((rate) => rate.id)).toEqual(["STANDARD"]);
  });
});
