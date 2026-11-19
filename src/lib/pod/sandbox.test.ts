import { describe, expect, it } from "vitest";
import { getPodProvider, readMarkup, readPaymentsMode, readPodMode } from "./index.ts";
import { applyMarkup, centsToDecimal, clampMarkup, formatMoney, moneyToCents } from "./money.ts";
import { buildMockupSvg, createSandboxProvider, sandboxVariantId } from "./sandbox.ts";
import type { DesignLayer } from "./types.ts";
import { defaultGarment } from "../garments/index.ts";

const WORD: DesignLayer = {
  id: "t",
  type: "text",
  text: "CROWN",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};
const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));
const DRAFT = {
  externalId: "ord-1",
  shippingMethod: "STANDARD",
  currency: "USD",
  recipient: {
    name: "Ada",
    address1: "1 Main",
    city: "Austin",
    stateCode: "TX",
    countryCode: "US",
    zip: "78701",
  },
  items: [
    {
      externalId: "l",
      variantId: "tee-heavy-black-m",
      quantity: 1,
      retailCents: 3069,
      name: "Tee",
      placement: "front",
      technique: "dtg",
      fileUrl: "https://x.test/f.png",
    },
  ],
};

describe("the sandbox catalog", () => {
  const provider = createSandboxProvider();

  it("lists the house blanks, a page at a time", async () => {
    const all = await provider.listProducts();
    expect(all.products.map((product) => product.id)).toEqual([
      "tee-heavy",
      "hoodie-pullover",
      "hat-dad",
      "crew-sweat",
      "longsleeve-block",
      "jogger-court",
      "tote-corner",
      "aop-hoodie",
      "aop-joggers",
      "aop-track-jacket",
    ]);
    const page = await provider.listProducts({ offset: 1, limit: 2 });
    expect(page).toMatchObject({ total: 10, offset: 1, limit: 2 });
    expect(page.products.map((product) => product.id)).toEqual(["hoodie-pullover", "hat-dad"]);
  });

  it("prices every variant from its wholesale cost and the markup", async () => {
    for (const { id } of (await provider.listProducts()).products) {
      const product = await provider.getProduct(id);
      expect(product.variants.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        expect(variant.retailCents).toBe(applyMarkup(variant.wholesaleCents ?? 0, 2.2));
        expect(variant.printAreas.length).toBeGreaterThan(0);
      }
    }
  });

  it("charges more for the largest size", async () => {
    const tee = await provider.getProduct("tee-heavy");
    const price = (size: string) =>
      tee.variants.find((variant) => variant.id === `tee-heavy-black-${size}`)?.retailCents ?? 0;
    expect(price("2xl")).toBeGreaterThan(price("m"));
  });

  it("builds variant ids from color and size codes, not the labels", async () => {
    expect(sandboxVariantId("tee-heavy", "black", "m")).toBe("tee-heavy-black-m");
    expect(sandboxVariantId("tee-heavy", "black", "m")).not.toBe(sandboxVariantId("tee-heavy", "ink", "m"));
    const tee = await provider.getProduct("tee-heavy");
    const hot = tee.variants.find((variant) => variant.colorCode === "hot-pink" && variant.sizeCode === "m");
    expect(hot?.color).toBe("Hot Pink");
    expect(hot?.id).toBe("tee-heavy-hot-pink-m");
    expect(hot?.id).not.toContain("Hot");
    const renamed = tee.variants.map((variant) =>
      variant.colorCode === "black" ? { ...variant, color: "Ink" } : variant,
    );
    const ink = renamed.find((variant) => variant.sizeCode === "m" && variant.color === "Ink");
    expect(ink?.id).toBe("tee-heavy-black-m");
  });

  it("follows a different markup", async () => {
    const cheap = await createSandboxProvider(new Map(), 1).getProduct("tee-heavy");
    expect(cheap.variants[0]?.retailCents).toBe(cheap.variants[0]?.wholesaleCents);
  });

  it("labels all-over blanks as sublimation on polyester, not sewn cotton", async () => {
    const hoodie = await provider.getProduct("aop-hoodie");
    expect(hoodie.construction).toBe("aop");
    expect(hoodie.techniques[0]?.key).toBe("sublimation");
    expect(hoodie.materialNote).toMatch(/sublimation/);
    expect(hoodie.materialNote).toMatch(/not sewn cotton/);
    expect(hoodie.description).toMatch(/388/);
    for (const id of ["aop-joggers", "aop-track-jacket"]) {
      const piece = await provider.getProduct(id);
      expect(piece.materialNote).toMatch(/fabric is not confirmed/);
      expect(piece.materialNote).not.toMatch(/sublimation|polyester|cotton/);
      expect(piece.description).not.toMatch(/polyester|spandex/);
    }
  });

  it("draws an all-over mockup from the garment it is given", async () => {
    const mockup = await provider.createMockup({
      productId: "aop-hoodie",
      variantId: "aop-hoodie-printed-m",
      placement: "front",
      technique: "sublimation",
      colorHex: "#c4a6e0",
      productType: "Hoodie",
      layers: [],
      garment: { ...defaultGarment("aop-hoodie"), activeColorwayId: "black-gold" },
    });
    const svg = decodeURIComponent(mockup.mockupUrl ?? "");
    expect(svg).toContain("#141414");
    expect(svg).not.toContain("#c4a6e0");
  });

  it("answers 404 for a product it does not carry", async () => {
    await expect(provider.getProduct("yacht")).rejects.toMatchObject({ status: 404 });
  });
});

describe("sandbox mockups", () => {
  const provider = createSandboxProvider();

  it("draws every blank in every placement it offers", async () => {
    for (const { id } of (await provider.listProducts()).products) {
      const product = await provider.getProduct(id);
      const variant = product.variants[0];
      for (const placement of product.placements) {
        const mockup = await provider.createMockup({
          productId: id,
          variantId: variant?.id ?? "",
          placement: placement.placement,
          technique: placement.technique,
          colorHex: variant?.colorHex ?? "#000000",
          productType: product.type,
          layers: [WORD],
          printArea: variant?.printAreas[0],
        });
        expect(mockup.status).toBe("completed");
        expect(decode(mockup.mockupUrl ?? "")).toContain(">CROWN</text>");
      }
    }
  });

  it("refuses a placement the blank does not have, and a variant it does not carry", async () => {
    const request = {
      productId: "hat-dad",
      variantId: "hat-dad-black-one-size",
      placement: "back",
      technique: "embroidery",
      colorHex: "#000000",
      productType: "Hat",
      layers: [WORD],
    };
    await expect(provider.createMockup(request)).rejects.toMatchObject({ status: 400 });
    await expect(
      provider.createMockup({ ...request, placement: "front", variantId: "hat-dad-gold-xl" }),
    ).rejects.toThrow();
  });

  it("uses dark ink on a light garment and light ink on a dark one", () => {
    const outline = (colorHex: string) =>
      /stroke="(#[0-9a-f]{6})" stroke-width="3"/.exec(
        decode(buildMockupSvg({ shape: "tee", colorHex, placement: "front", layers: [] })),
      )?.[1];
    expect(outline("#efe6d6")).toBe("#141018");
    expect(outline("#141414")).toBe("#f6f1ff");
  });

  it("escapes text, colors and links so a design cannot inject markup", () => {
    const svg = decode(
      buildMockupSvg({
        shape: "tee",
        colorHex: '"/><script>alert(1)</script>',
        placement: "front",
        layers: [
          { ...WORD, text: `<b>&"'`, color: '"onload="alert(1)' },
          {
            id: "i",
            type: "image",
            src: 'https://cdn.test/a.png"><script>',
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
          },
          {
            id: "j",
            type: "image",
            src: "javascript:alert(1)",
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
          },
        ],
      }),
    );
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain('onload="alert');
    expect(svg).not.toContain("javascript:");
    expect(svg).toContain("&lt;b&gt;&amp;&quot;&apos;");
  });

  it("places picture layers, from a data image or an https link", () => {
    const svg = decode(
      buildMockupSvg({
        shape: "hoodie",
        colorHex: "#141414",
        placement: "back",
        layers: [
          {
            id: "a",
            type: "image",
            src: "data:image/png;base64,AAAA",
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
          },
          {
            id: "b",
            type: "image",
            src: "https://cdn.test/a.png",
            x: 0.2,
            y: 0.2,
            scale: 0.5,
            rotation: 12,
          },
        ],
      }),
    );
    expect(svg.match(/<image /g)).toHaveLength(2);
  });

  it("draws an arched word one letter at a time", () => {
    const svg = decode(
      buildMockupSvg({
        shape: "tee",
        colorHex: "#141414",
        placement: "front",
        layers: [{ ...WORD, arc: -40 }],
      }),
    );
    expect(svg.match(/<text /g)).toHaveLength(5);
    expect(svg).toContain(">C</text>");
    expect(svg).toContain(">N</text>");
  });
});

describe("sandbox orders", () => {
  it("keeps a draft unconfirmed until told, then refuses a second confirm", async () => {
    const provider = createSandboxProvider();
    const draft = await provider.createDraftOrder(DRAFT);
    expect(draft).toMatchObject({ status: "draft", confirmed: false, externalId: "ord-1" });
    expect(await provider.confirmOrder(draft.id)).toMatchObject({
      status: "pending",
      confirmed: true,
    });
    await expect(provider.confirmOrder(draft.id)).rejects.toMatchObject({ status: 409 });
    expect((await provider.getOrder(draft.id)).confirmed).toBe(true);
  });

  it.each([
    ["no items", { items: [] }],
    ["a variant it cannot print", { items: [{ ...DRAFT.items[0], variantId: "yacht-1" }] }],
    ["an item with no print file", { items: [{ ...DRAFT.items[0], fileUrl: "" }] }],
  ])("refuses a draft with %s", async (_what, change) => {
    await expect(
      createSandboxProvider().createDraftOrder({ ...DRAFT, ...change } as typeof DRAFT),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("will not confirm a canceled draft, or cancel a confirmed order", async () => {
    const provider = createSandboxProvider();
    const canceled = await provider.createDraftOrder(DRAFT);
    await provider.cancelOrder(canceled.id);
    await expect(provider.confirmOrder(canceled.id)).rejects.toThrow(/Canceled/);
    const confirmed = await provider.createDraftOrder(DRAFT);
    await provider.confirmOrder(confirmed.id);
    await expect(provider.cancelOrder(confirmed.id)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 404 for an order it never saw, and ignores a cancel for one", async () => {
    const provider = createSandboxProvider();
    await expect(provider.getOrder("sb-0")).rejects.toMatchObject({ status: 404 });
    await expect(provider.confirmOrder("sb-0")).rejects.toMatchObject({ status: 404 });
    await expect(provider.cancelOrder("sb-0")).resolves.toBeUndefined();
  });

  it("gives every order its own id", async () => {
    const provider = createSandboxProvider();
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => provider.createDraftOrder(DRAFT).then((order) => order.id)),
    );
    expect(new Set(ids).size).toBe(5);
  });

  it("charges shipping by the piece, with express on top", async () => {
    const provider = createSandboxProvider();
    const rates = await provider.shippingRates({
      recipient: DRAFT.recipient,
      currency: "USD",
      items: [{ variantId: "x", quantity: 3, retailCents: 1 }],
    });
    expect(rates.map((rate) => [rate.id, rate.rateCents])).toEqual([
      ["STANDARD", 1095],
      ["EXPRESS", 1995],
    ]);
  });

  it("stands in for file upload, product sync and webhook setup without calling anyone", async () => {
    const provider = createSandboxProvider();
    expect(
      await provider.uploadFile({ url: "https://x.test/f.png", filename: "f.png" }),
    ).toMatchObject({ url: "https://x.test/f.png", status: "ok" });
    expect(await provider.getMockup("task-1")).toEqual({ id: "task-1", status: "completed" });
    expect(await provider.syncProduct({ externalId: "d1", name: "Tee", variants: [] })).toEqual({
      id: "sync-d1",
    });
    expect(
      await provider.syncProduct({ externalId: "d1", name: "Tee", variants: [], existingId: "77" }),
    ).toEqual({ id: "77" });
    expect((await provider.registerWebhooks("https://x.test/hook")).secretHex).toBeUndefined();
  });
});

describe("which mode the shop runs in", () => {
  it("stays unset until POD_MODE says sandbox or live", () => {
    expect(() => readPodMode({})).toThrow(/POD_MODE must be sandbox or live/);
    expect(() => readPodMode({ PRINTFUL_API_KEY: "pf" })).toThrow(/POD_MODE must be sandbox or live/);
    expect(readPodMode({ PRINTFUL_API_KEY: "pf", POD_MODE: " Sandbox " })).toBe("sandbox");
    expect(readPodMode({ POD_MODE: "LIVE" })).toBe("live");
    expect(() => readPodMode({ PRINTFUL_API_KEY: "   " })).toThrow(/POD_MODE must be sandbox or live/);
    expect(readPaymentsMode({})).toBe("sandbox");
    expect(readPaymentsMode({ STRIPE_SECRET_KEY: "sk" })).toBe("sandbox");
    expect(readPaymentsMode({ STRIPE_SECRET_KEY: "sk", PAYMENTS_MODE: "sandbox" })).toBe("sandbox");
    expect(readPaymentsMode({ PAYMENTS_MODE: "live" })).toBe("live");
    expect(readPaymentsMode({ STRIPE_SECRET_KEY: "sk", PAYMENTS_MODE: "live" })).toBe("live");
    expect(readPaymentsMode({ PAYMENTS_MODE: "banana" })).toBe("sandbox");
  });

  it("keeps the markup between one and five", () => {
    expect(readMarkup({})).toBe(2.2);
    expect(readMarkup({ STUDIO_MARKUP: "3" })).toBe(3);
    expect(readMarkup({ STUDIO_MARKUP: "0.2" })).toBe(1);
    expect(readMarkup({ STUDIO_MARKUP: "40" })).toBe(5);
    expect(readMarkup({ STUDIO_MARKUP: "free" })).toBe(2.2);
  });

  it("refuses to go live without a key, a store and a public address", () => {
    expect(() => getPodProvider({ POD_MODE: "live" })).toThrow(/PRINTFUL_API_KEY/);
    expect(() => getPodProvider({ POD_MODE: "live", PRINTFUL_API_KEY: "pf" })).toThrow(
      /PRINTFUL_STORE_ID/,
    );
    expect(() =>
      getPodProvider({ POD_MODE: "live", PRINTFUL_API_KEY: "pf", PRINTFUL_STORE_ID: "12" }),
    ).toThrow(/APP_PUBLIC_URL/);
    expect(
      getPodProvider({
        POD_MODE: "live",
        PRINTFUL_API_KEY: "pf",
        PRINTFUL_STORE_ID: " 12 ",
        APP_PUBLIC_URL: "https://shop.example",
      }).id,
    ).toBe("printful");
    expect(getPodProvider({ POD_MODE: "sandbox" }).id).toBe("sandbox");
    expect(() => getPodProvider({})).toThrow(/POD_MODE/);
  });
});

describe("money", () => {
  it("reads prices as whole cents, and refuses anything that is not a plain price", () => {
    expect(moneyToCents("13.95")).toBe(1395);
    expect(moneyToCents("13.9")).toBe(1390);
    expect(moneyToCents("13")).toBe(1300);
    expect(moneyToCents(" 4.75 ")).toBe(475);
    expect(moneyToCents(19.999)).toBe(2000);
    for (const bad of [
      "13.955",
      "-1",
      "1e3",
      "",
      "abc",
      "$5",
      null,
      undefined,
      {},
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(moneyToCents(bad)).toBeNull();
    }
  });

  it("writes cents back as a decimal string", () => {
    expect(centsToDecimal(3069)).toBe("30.69");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(-250)).toBe("-2.50");
    expect(centsToDecimal(1999.6)).toBe("20.00");
  });

  it("never marks a price below cost or above five times it", () => {
    expect(clampMarkup(Number.NaN)).toBe(2.2);
    expect(applyMarkup(1000, 0)).toBe(1000);
    expect(applyMarkup(1000, 99)).toBe(5000);
    expect(applyMarkup(-50, 2)).toBe(0);
  });

  it("formats for display, and survives a currency it does not know", () => {
    expect(formatMoney(6983)).toBe("$69.83");
    expect(formatMoney(Number.NaN)).toBe("$0.00");
    expect(formatMoney(500, "not-a-currency")).toBe("$5.00");
  });
});
