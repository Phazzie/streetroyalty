import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { createPrintfulProvider } from "./printful.ts";
import { PodError } from "./types.ts";
import { buildMockupSvg, createSandboxProvider } from "./sandbox.ts";
import { signPrintfulBody, verifyPrintfulSignature } from "./signature.ts";

type Call = { url: string; method: string; body?: unknown };

function mockFetch(routes: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const call = { url: String(input), method: init?.method ?? "GET", body };
    calls.push(call);
    const result = routes(call);
    return new Response(JSON.stringify(result.json), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

const variant = {
  id: 4011,
  name: "Tee Black M",
  size: "M",
  color: "Black",
  color_code: "#141414",
  placement_dimensions: [{ placement: "front", width: 12, height: 16 }],
};

describe("printful client", () => {
  it("lists catalog products from v2", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      json: {
        data: [{ id: 71, name: "Softstyle Tee", type: "T-Shirt", image: " https://cdn.example/tee.jpg ", is_discontinued: false, sizes: ["M"], colors: [{ name: "Black", value: "#111" }], techniques: [{ key: "dtg", display_name: "DTG", is_default: true }], placements: [{ placement: "front", technique: "dtg" }] }],
        paging: { total: 40, offset: 0, limit: 24 },
      },
    }));
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl, markup: 2 });
    const page = await provider.listProducts({ limit: 24, offset: 0 });
    assert.equal(calls[0]?.url.includes("/v2/catalog-products?"), true);
    assert.equal(page.products[0]?.name, "Softstyle Tee");
    assert.equal(page.products[0]?.imageUrl, "https://cdn.example/tee.jpg");
    assert.equal(page.total, 40);
  });

  it("loads variants and wholesale prices", async () => {
    const { fetchImpl } = mockFetch((call) => {
      if (call.url.includes("/catalog-variants")) return { json: { data: [variant] } };
      if (call.url.includes("/prices")) {
        return {
          json: {
            data: {
              currency: "USD",
              variant: { id: 4011, techniques: [{ technique_key: "dtg", discounted_price: "13.95" }] },
            },
          },
        };
      }
      return {
        json: {
          data: {
            id: 71,
            name: "Softstyle Tee",
            type: "T-Shirt",
            techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
            placements: [{ placement: "front", technique: "dtg", title: "Front" }],
          },
        },
      };
    });
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl, markup: 2 });
    const product = await provider.getProduct("71");
    assert.equal(product.variants[0]?.wholesaleCents, 1395);
    assert.equal(product.variants[0]?.retailCents, 2790);
    assert.equal(product.variants[0]?.printAreas[0]?.widthIn, 12);
  });

  it("creates a draft order and does not confirm it", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({ json: { data: { id: 55, external_id: "ord-1", status: "draft" } } }));
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl });
    const order = await provider.createDraftOrder({
      externalId: "ord-1",
      shippingMethod: "STANDARD",
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [
        {
          externalId: "item-1",
          variantId: "4011",
          quantity: 1,
          retailCents: 3200,
          name: "Night Tee",
          placement: "front",
          technique: "dtg",
          fileUrl: "https://shop.example/api/print-files/abc",
          printArea: { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 },
        },
      ],
    });
    assert.equal(order.id, "55");
    assert.equal(order.confirmed, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.url.endsWith("/v2/orders"), true);
    assert.equal(JSON.stringify(calls).includes("confirmation"), false);
    const body = calls[0]?.body as { order_items: { retail_price: string }[] };
    assert.equal(body.order_items[0]?.retail_price, "32.00");
  });

  it("confirms on its own endpoint", async () => {
    const { fetchImpl, calls } = mockFetch(() => ({ json: { data: { id: 55, status: "pending" } } }));
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl });
    const order = await provider.confirmOrder("55");
    assert.equal(order.confirmed, true);
    assert.equal(calls[0]?.url.endsWith("/v2/orders/55/confirmation"), true);
    assert.equal(calls[0]?.method, "POST");
  });

  it("maps shipping rates", async () => {
    const { fetchImpl } = mockFetch(() => ({
      json: { data: [{ shipping: "STANDARD", shipping_method_name: "Flat Rate", rate: "8.95", currency: "USD", min_delivery_days: 3, max_delivery_days: 5 }] },
    }));
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl });
    const rates = await provider.shippingRates({
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [{ variantId: "4011", quantity: 1, retailCents: 3200 }],
    });
    assert.equal(rates[0]?.rateCents, 895);
    assert.equal(rates[0]?.id, "STANDARD");
  });

  it("uploads a print file and syncs a v1 store product", async () => {
    const { fetchImpl, calls } = mockFetch((call) => {
      if (call.url.endsWith("/v2/files")) return { json: { data: { id: 9, url: "https://files.example/a.png", status: "ok" } } };
      return { json: { result: { id: 77, sync_product: { id: 77 } } } };
    });
    const provider = createPrintfulProvider({ apiKey: "pk_test", storeId: "42", fetchImpl });
    const file = await provider.uploadFile({ url: "https://shop.example/print.png", filename: "print.png" });
    assert.equal(file.id, "9");
    const synced = await provider.syncProduct({
      externalId: "design-1",
      name: "Night Tee",
      variants: [{ catalogVariantId: "4011", retailPrice: "32.00", files: [{ placement: "front", url: file.url }] }],
    });
    assert.equal(synced.id, "77");
    assert.equal(calls[1]?.url.endsWith("/store/products"), true);
    assert.equal(calls[1]?.method, "POST");
  });

  it("surfaces API errors", async () => {
    const { fetchImpl } = mockFetch(() => ({ status: 401, json: { error: { message: "bad token" } } }));
    const provider = createPrintfulProvider({ apiKey: "nope", fetchImpl });
    await assert.rejects(() => provider.listProducts(), (error: unknown) => error instanceof PodError && error.status === 401);
  });

  it("polls a pending mockup task", async () => {
    let polls = 0;
    const { fetchImpl } = mockFetch((call) => {
      if (call.method === "POST") return { json: { data: [{ id: 8, status: "pending", catalog_variant_mockups: [] }] } };
      polls += 1;
      return {
        json: {
          data: [{ id: 8, status: "completed", catalog_variant_mockups: [{ mockups: [{ mockup_url: "https://cdn.example/mock.jpg" }] }] }],
        },
      };
    });
    const provider = createPrintfulProvider({ apiKey: "pk_test", fetchImpl, mockupPoll: { attempts: 2, delayMs: 0 } });
    const mockup = await provider.createMockup({
      productId: "71",
      variantId: "4011",
      placement: "front",
      technique: "dtg",
      fileUrl: "https://shop.example/print.png",
      colorHex: "#111111",
      productType: "T-Shirt",
      layers: [],
    });
    assert.equal(polls, 1);
    assert.equal(mockup.mockupUrl, "https://cdn.example/mock.jpg");
  });
});

describe("printful webhook signature", () => {
  it("accepts a hex secret the way Printful documents it", () => {
    const secretHex = Buffer.from("street-royalty-key", "utf8").toString("hex");
    const body = JSON.stringify({ type: "order_updated" });
    const signature = signPrintfulBody(body, secretHex);
    assert.equal(verifyPrintfulSignature(body, signature, secretHex), true);
    assert.equal(verifyPrintfulSignature(body, signature, "wrong-secret"), false);
    assert.equal(verifyPrintfulSignature(`${body} `, signature, secretHex), false);
    assert.equal(verifyPrintfulSignature(body, null, secretHex), false);
    const undecoded = createHmac("sha256", Buffer.from(secretHex, "utf8")).update(body, "utf8").digest("hex");
    assert.equal(verifyPrintfulSignature(body, undecoded, secretHex), false);
  });

  it("accepts a raw utf-8 test secret", () => {
    const body = "{\"type\":\"shipment_sent\"}";
    const signature = signPrintfulBody(body, "sandbox-secret");
    assert.equal(verifyPrintfulSignature(body, signature.toUpperCase(), "sandbox-secret"), true);
  });
});

describe("sandbox provider", () => {
  it("quotes, drafts, and confirms without shipping twice", async () => {
    const orders = new Map();
    const provider = createSandboxProvider(orders, 2);
    const product = await provider.getProduct("tee-heavy");
    const variant = product.variants[0];
    assert.ok(variant);
    assert.equal(variant.retailCents, (variant.wholesaleCents ?? 0) * 2);
    const mockup = await provider.createMockup({
      productId: product.id,
      variantId: variant.id,
      placement: "front",
      technique: "dtg",
      colorHex: variant.colorHex,
      productType: product.type,
      layers: [{ id: "t", type: "text", text: "ROYALTY <3", font: "Archivo Black", color: "#d6ff3c", x: 0.5, y: 0.4, scale: 1, rotation: -6 }],
    });
    assert.equal(mockup.status, "completed");
    assert.match(mockup.mockupUrl ?? "", /^data:image\/svg\+xml/);
    const rates = await provider.shippingRates({
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [{ variantId: variant.id, quantity: 2, retailCents: variant.retailCents ?? 0 }],
    });
    assert.equal(rates[0]?.id, "STANDARD");
    const draft = await provider.createDraftOrder({
      externalId: "local-1",
      shippingMethod: "STANDARD",
      currency: "USD",
      recipient: { name: "Ada", address1: "1 Main", city: "Austin", stateCode: "TX", countryCode: "US", zip: "78701" },
      items: [
        {
          externalId: "line-1",
          variantId: variant.id,
          quantity: 1,
          retailCents: variant.retailCents ?? 0,
          name: "Night Tee",
          placement: "front",
          technique: "dtg",
          fileUrl: "http://127.0.0.1/api/print-files/x",
        },
      ],
    });
    assert.equal(draft.confirmed, false);
    const confirmed = await provider.confirmOrder(draft.id);
    assert.equal(confirmed.confirmed, true);
    await assert.rejects(() => provider.confirmOrder(draft.id), /already confirmed/);
  });

  it("escapes text in the mockup svg", () => {
    const url = buildMockupSvg({
      shape: "tee",
      colorHex: "#141414",
      placement: "front",
      layers: [{ id: "t", type: "text", text: `<script>alert("x")</script>`, font: "Outfit", color: "#fff", x: 0.5, y: 0.5, scale: 1, rotation: 0 }],
    });
    const svg = decodeURIComponent(url.split(",")[1] ?? "");
    assert.equal(svg.includes("<script>"), false);
    assert.equal(svg.includes("&lt;script&gt;"), true);
  });
});
