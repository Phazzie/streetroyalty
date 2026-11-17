import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCatalog, loadProduct, productPhoto, startCheckout } from "./fourthwall.server.ts";
import {
  VARIANT_L,
  VARIANT_S,
  fourthwallPage,
  fourthwallProduct,
  fourthwallShop,
} from "../../test/fixtures/fourthwall.ts";
import { seenTo, server } from "../../test/msw/server.ts";

/** The official shop. Fourthwall takes the money, so what matters here is what the shopper is shown and sent. */

const API = "https://storefront-api.fourthwall.com/v1";
const HOST = "storefront-api.fourthwall.com";

type Shop = {
  products?: unknown[][];
  collections?: { slug: string; name: string; products: unknown[] }[];
  shop?: unknown;
  status?: number;
};

function shopAnswers(config: Shop = {}) {
  const pages = config.products ?? [[fourthwallProduct("crown-hoodie")]];
  server.use(
    http.get(`${API}/shop`, () =>
      config.status
        ? HttpResponse.json({}, { status: config.status })
        : HttpResponse.json(config.shop ?? fourthwallShop),
    ),
    http.get(`${API}/collections`, () =>
      config.status
        ? HttpResponse.json({}, { status: config.status })
        : HttpResponse.json({
            results: [{ slug: "all", name: "All" }, ...(config.collections ?? [])],
          }),
    ),
    http.get(`${API}/collections/:slug/products`, ({ params, request }) => {
      if (config.status) return HttpResponse.json({}, { status: config.status });
      const page = Number(new URL(request.url).searchParams.get("page") ?? "0");
      if (params.slug === "all") {
        return HttpResponse.json(fourthwallPage(pages[page] ?? [], page < pages.length - 1));
      }
      const found = config.collections?.find((collection) => collection.slug === params.slug);
      return HttpResponse.json(fourthwallPage(found?.products ?? []));
    }),
  );
}

const productCalls = () =>
  seenTo(HOST).filter((call) => call.url.includes("/collections/all/products"));

beforeEach(() => {
  process.env.FOURTHWALL_STOREFRONT_TOKEN = "ptkn_test";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("with no token", () => {
  beforeEach(() => {
    delete process.env.FOURTHWALL_STOREFRONT_TOKEN;
  });

  it("shows the built-in preview drop and calls nobody", async () => {
    const catalog = await loadCatalog();
    expect(catalog.source).toBe("demo");
    expect(catalog.products).toHaveLength(8);
    expect(seenTo(HOST)).toEqual([]);
  });

  it("cannot start a checkout", async () => {
    expect(await startCheckout([{ variantId: VARIANT_S, quantity: 1 }])).toEqual({ mode: "demo" });
    expect(seenTo(HOST)).toEqual([]);
  });
});

describe("the live shelf", () => {
  it("reads the shop's products, prices and name, sending the token", async () => {
    shopAnswers();
    const catalog = await loadCatalog();
    expect(catalog).toMatchObject({
      source: "fourthwall",
      shopName: "Street Royalty Official",
      currency: "USD",
    });
    expect(catalog.products.map((product) => product.slug)).toEqual(["crown-hoodie"]);
    expect(catalog.products[0]?.variants.map((variant) => variant.priceCents)).toEqual([
      6450, 6999,
    ]);
    expect(
      seenTo(HOST).every(
        (call) => new URL(call.url).searchParams.get("storefront_token") === "ptkn_test",
      ),
    ).toBe(true);
  });

  it("follows every page of products", async () => {
    shopAnswers({
      products: [
        [fourthwallProduct("a-tee")],
        [fourthwallProduct("b-tee")],
        [fourthwallProduct("c-tee")],
      ],
    });
    const catalog = await loadCatalog();
    expect(catalog.products.map((product) => product.slug)).toEqual(["a-tee", "b-tee", "c-tee"]);
    expect(productCalls()).toHaveLength(3);
  });

  it("stops after four pages even if the shop says there are more", async () => {
    server.use(
      http.get(`${API}/shop`, () => HttpResponse.json(fourthwallShop)),
      http.get(`${API}/collections`, () => HttpResponse.json({ results: [] })),
      http.get(`${API}/collections/all/products`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        return HttpResponse.json(fourthwallPage([fourthwallProduct(`tee-${page}`)], true));
      }),
    );
    expect((await loadCatalog()).products).toHaveLength(4);
    expect(productCalls()).toHaveLength(4);
  });

  it("files each product under the collection it belongs to, and drops empty collections", async () => {
    shopAnswers({
      products: [[fourthwallProduct("crown-hoodie"), fourthwallProduct("plain-tee")]],
      collections: [
        { slug: "hoodies", name: "Hoodies", products: [fourthwallProduct("crown-hoodie")] },
        { slug: "empty", name: "Empty", products: [] },
      ],
    });
    const catalog = await loadCatalog();
    expect(catalog.collections).toEqual([{ slug: "hoodies", name: "Hoodies" }]);
    expect(catalog.products.find((product) => product.slug === "crown-hoodie")?.collection).toBe(
      "hoodies",
    );
  });

  it("asks Fourthwall once a minute, not on every page view", async () => {
    shopAnswers();
    vi.useFakeTimers({ toFake: ["Date"], now: 1_800_000_000_000 });
    await loadCatalog();
    await loadCatalog();
    await loadProduct("crown-hoodie");
    expect(productCalls()).toHaveLength(1);
    vi.setSystemTime(1_800_000_000_000 + 61_000);
    await loadCatalog();
    expect(productCalls()).toHaveLength(2);
  });

  it("finds one product by slug, and nothing for a slug that is not there", async () => {
    shopAnswers();
    expect((await loadProduct("crown-hoodie"))?.product.slug).toBe("crown-hoodie");
    expect(await loadProduct("ghost")).toBeNull();
  });
});

describe("when Fourthwall is not answering", () => {
  it("says the token was refused when it was", async () => {
    shopAnswers({ status: 401 });
    const catalog = await loadCatalog();
    expect(catalog.products).toEqual([]);
    expect(catalog.notice).toMatch(/token was refused/);
  });

  it("says the shop did not answer on an outage, without blaming the token", async () => {
    shopAnswers({ status: 503 });
    const catalog = await loadCatalog();
    expect(catalog.notice).toMatch(/did not answer/);
    expect(catalog.notice).not.toMatch(/token/);
  });

  it("says the shop did not answer when the connection drops", async () => {
    server.use(http.get(`${API}/*`, () => HttpResponse.error()));
    expect((await loadCatalog()).notice).toMatch(/did not answer/);
  });

  it("keeps showing the last good shelf through an outage", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 1_800_000_000_000 });
    shopAnswers();
    await loadCatalog();
    vi.setSystemTime(1_800_000_000_000 + 61_000);
    shopAnswers({ status: 503 });

    const during = await loadCatalog();

    expect(during.products.map((product) => product.slug)).toEqual(["crown-hoodie"]);
    expect(during.notice).toBeUndefined();
  });

  it("waits twenty seconds before asking a broken shop again", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 1_800_000_000_000 });
    shopAnswers({ status: 503 });
    await loadCatalog();
    await loadCatalog();
    expect(productCalls()).toHaveLength(1);
    vi.setSystemTime(1_800_000_000_000 + 21_000);
    shopAnswers();
    expect((await loadCatalog()).products).toHaveLength(1);
  });
});

describe("handing the bag to Fourthwall", () => {
  const cart = (respond: () => Response) => server.use(http.post(`${API}/carts`, respond));

  it("creates a cart with exactly the bag's lines and sends the shopper to the shop's checkout", async () => {
    shopAnswers();
    cart(() => HttpResponse.json({ id: "cart_abc" }));
    const started = await startCheckout([
      { variantId: VARIANT_S, quantity: 2 },
      { variantId: VARIANT_L, quantity: 1 },
    ]);
    expect(started).toEqual({
      mode: "fourthwall",
      url: "https://streetroyalty.fourthwall.com/checkout/?cartCurrency=USD&cartId=cart_abc",
    });
    const post = seenTo(HOST).find((call) => call.method === "POST");
    await vi.waitFor(() => expect(post?.body).not.toBe(""));
    expect(JSON.parse(post?.body ?? "{}")).toEqual({
      items: [
        { variantId: VARIANT_S, quantity: 2 },
        { variantId: VARIANT_L, quantity: 1 },
      ],
    });
  });

  it("uses the configured checkout domain over the one the shop reports", async () => {
    shopAnswers();
    cart(() => HttpResponse.json({ id: "cart_abc" }));
    process.env.FOURTHWALL_CHECKOUT_DOMAIN = "https://Shop.StreetRoyalty.com/anything";
    const started = await startCheckout([{ variantId: VARIANT_S, quantity: 1 }]);
    expect(started).toMatchObject({
      url: expect.stringMatching(/^https:\/\/shop\.streetroyalty\.com\/checkout\//),
    });
  });

  it("refuses to build a checkout link from a domain that is not a host name", async () => {
    shopAnswers();
    process.env.FOURTHWALL_CHECKOUT_DOMAIN = "evil.com@shop.com/?x=";
    await expect(startCheckout([{ variantId: VARIANT_S, quantity: 1 }])).rejects.toThrow(
      /not set up/,
    );
    expect(seenTo(HOST).filter((call) => call.method === "POST")).toEqual([]);
  });

  it("refuses an empty bag", async () => {
    await expect(startCheckout([])).rejects.toThrow(/empty/);
    expect(seenTo(HOST)).toEqual([]);
  });

  it("refuses a bag that still holds preview-drop pieces, before calling Fourthwall", async () => {
    await expect(
      startCheckout([
        { variantId: VARIANT_S, quantity: 1 },
        { variantId: "demo-lilac-hoodie-m", quantity: 1 },
      ]),
    ).rejects.toThrow(/preview drop/);
    expect(seenTo(HOST)).toEqual([]);
  });

  it.each([
    [
      "Fourthwall refuses the cart",
      () => HttpResponse.json({ error: "out of stock" }, { status: 422 }),
    ],
    ["the cart comes back with no id", () => HttpResponse.json({})],
  ])("tells the shopper checkout did not start when %s", async (_what, respond) => {
    shopAnswers();
    cart(respond);
    await expect(startCheckout([{ variantId: VARIANT_S, quantity: 1 }])).rejects.toThrow(
      /did not start/,
    );
  });
});

describe("a product photo for the lab", () => {
  const photoUrl = "https://cdn.fourthwall.test/crown-hoodie.png";
  const photo = (respond: () => Response) => server.use(http.get(photoUrl, respond));
  const png = () =>
    new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });

  it("comes back inline with the product's name", async () => {
    shopAnswers();
    photo(png);
    expect(await productPhoto("crown-hoodie")).toMatchObject({
      name: "crown hoodie",
      image: "data:image/png;base64,AQID",
    });
  });

  it("is downloaded once and then served from memory", async () => {
    shopAnswers();
    photo(png);
    await productPhoto("crown-hoodie");
    await productPhoto("crown-hoodie");
    expect(seenTo("cdn.fourthwall.test")).toHaveLength(1);
  });

  it.each([
    [
      "is declared larger than three megabytes",
      () =>
        new HttpResponse(null, {
          headers: { "content-type": "image/png", "content-length": "9000000" },
        }),
    ],
    // No body here: cancelling a mocked body never settles, which real fetch does not suffer from.
    [
      "is not an image",
      () =>
        new HttpResponse(null, { headers: { "content-type": "text/html", "content-length": "6" } }),
    ],
    ["is missing", () => new HttpResponse(null, { status: 404 })],
  ])("is refused when it %s", async (_what, respond) => {
    shopAnswers();
    photo(respond);
    expect(await productPhoto("crown-hoodie")).toBeNull();
  });

  // A body that overruns its declared size is cut off by readCappedBytes, tested in bounded-bytes.test.ts.

  it("is never fetched from an address that is not https", async () => {
    shopAnswers({
      products: [
        [
          fourthwallProduct("crown-hoodie", {
            images: [{ id: "i", url: "http://169.254.169.254/latest", width: 1, height: 1 }],
          }),
        ],
      ],
    });
    expect(await productPhoto("crown-hoodie")).toBeNull();
    expect(seenTo("169.254.169.254")).toEqual([]);
  });

  it("is nothing for a product that does not exist", async () => {
    shopAnswers();
    expect(await productPhoto("ghost")).toBeNull();
  });
});
