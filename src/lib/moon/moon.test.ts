import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceTicker, tickerDelta, EMBROIDERY_CENTS, EXTRA_LAYER_CENTS } from "./pricing.ts";
import { colorwaysFromPalette, extractPalette, nearestColor, CURATED_COLORWAYS } from "./colorway.ts";
import { arcLayout, clampFx, TEXT_PRESETS } from "./textfx.ts";
import { canPublish, effectiveDpi, preflightVerdict, runPrintChecks } from "./preflight.ts";
import { canForkDesign, forkCredit } from "./fork.ts";
import { cuttingRoomFloor, groupDrops, pipelineFor } from "./drops.ts";
import { dashboardStats } from "./dashboard.ts";
import { nextTheme, themeById } from "./theme.ts";
import type { DesignSummary, OrderSummary } from "../studio/models.ts";
import { createSandboxProvider } from "../pod/sandbox.ts";
import { parseLayers } from "../studio/validate.ts";

describe("sandbox catalog + layer fx persistence", () => {
  it("carries seven blanks including joggers, long-sleeve, and tote", async () => {
    const provider = createSandboxProvider(new Map(), 2.2);
    const page = await provider.listProducts({ offset: 0, limit: 24 });
    assert.equal(page.total, 7);
    const types = page.products.map((product) => product.type);
    for (const type of ["Joggers", "Long-Sleeve", "Tote", "T-Shirt", "Hoodie", "Hat", "Sweatshirt"]) {
      assert.ok(types.includes(type), `missing ${type}`);
    }
    const joggers = await provider.getProduct("jogger-court");
    assert.deepEqual(
      joggers.placements.map((placement) => placement.placement),
      ["front", "back"],
    );
    const mock = await provider.createMockup({
      productId: "tote-corner",
      variantId: joggers.variants[0] ? "tote-corner-bone-one-size" : "",
      placement: "front",
      technique: "dtg",
      colorHex: "#efe6d6",
      productType: "Tote",
      layers: [{ id: "t", type: "text", text: "SR", font: "Archivo Black", color: "#141414", x: 0.5, y: 0.5, scale: 1, rotation: 0, outline: true, tracking: 0.1 }],
    });
    assert.equal(mock.status, "completed");
  });

  it("keeps text fx through validation and drops flat defaults", () => {
    const [curved] = parseLayers([
      { id: "a", type: "text", text: "ARCH", font: "Archivo Black", color: "#ffffff", x: 0.5, y: 0.5, scale: 1, rotation: 0, arc: -40, outline: true, tracking: 0.1 },
    ]);
    assert.equal(curved?.type, "text");
    if (curved?.type === "text") {
      assert.equal(curved.arc, -40);
      assert.equal(curved.outline, true);
      assert.equal(curved.tracking, 0.1);
    }
    const [flat] = parseLayers([
      { id: "b", type: "text", text: "FLAT", font: "Archivo Black", color: "#ffffff", x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    ]);
    if (flat?.type === "text") {
      assert.equal(flat.arc, undefined);
      assert.equal(flat.outline, undefined);
    }
    const [wild] = parseLayers([
      { id: "c", type: "text", text: "WILD", font: "Archivo Black", color: "#ffffff", x: 0.5, y: 0.5, scale: 1, rotation: 0, arc: "nope", tracking: 42 },
    ]);
    if (wild?.type === "text") {
      assert.equal(wild.arc, undefined);
      assert.equal(wild.tracking, 0.6);
    }
  });
});

describe("priceTicker", () => {
  it("starts from the catalog pair and applies markup once", () => {
    const result = priceTicker({ wholesaleCents: 1395, markup: 2.2, layerCount: 1, finish: "print" });
    assert.equal(result.wholesaleCents, 1395);
    assert.equal(result.retailCents, 3069);
    assert.equal(result.catalogRetailCents, 3069);
    assert.equal(result.lines.length, 1);
  });

  it("itemizes extra layers and finishes in integer cents", () => {
    const result = priceTicker({ wholesaleCents: 1000, markup: 2, layerCount: 3, finish: "embroidery" });
    assert.equal(result.wholesaleCents, 1000 + 2 * EXTRA_LAYER_CENTS + EMBROIDERY_CENTS);
    assert.equal(result.retailCents, result.wholesaleCents * 2);
    assert.deepEqual(
      result.lines.map((line) => line.key),
      ["blank", "layers", "finish"],
    );
    for (const line of result.lines) assert.equal(Number.isInteger(line.cents), true);
  });

  it("clamps a wild markup and handles an unloaded variant", () => {
    const wild = priceTicker({ wholesaleCents: 1000, markup: 99, layerCount: 1, finish: "print" });
    assert.equal(wild.retailCents, 5000);
    const empty = priceTicker({ wholesaleCents: null, markup: 2.2, layerCount: 2, finish: "vintage" });
    assert.equal(empty.catalogRetailCents, null);
    assert.ok(empty.wholesaleCents > 0);
  });

  it("reports the delta between two states", () => {
    const before = priceTicker({ wholesaleCents: 1000, markup: 2, layerCount: 1, finish: "print" });
    const after = priceTicker({ wholesaleCents: 1000, markup: 2, layerCount: 2, finish: "print" });
    assert.equal(tickerDelta(before, after), EXTRA_LAYER_CENTS * 2);
  });
});

describe("colorway engine", () => {
  it("extracts the dominant palette and skips transparent pixels", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 12; i += 1) {
      pixels.set([255, 45, 149, 255], i * 4);
    }
    for (let i = 12; i < 16; i += 1) {
      pixels.set([20, 20, 20, 0], i * 4);
    }
    const palette = extractPalette(pixels, 3);
    assert.equal(palette[0], "#ff2d95");
  });

  it("only offers colorways whose ink survives on the garment", () => {
    const ways = colorwaysFromPalette(["#777777", "#888888"]);
    for (const way of ways) assert.ok(way.contrast >= 3, `${way.name} contrast ${way.contrast}`);
    assert.ok(CURATED_COLORWAYS.length >= 4);
    for (const way of CURATED_COLORWAYS) assert.ok(way.contrast >= 3);
  });

  it("maps a colorway onto the nearest real blank color", () => {
    const options = [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
    ];
    assert.equal(nearestColor("#101010", options)?.name, "Black");
    assert.equal(nearestColor("#ffffff", options)?.name, "Bone");
    assert.equal(nearestColor("#fff", []), null);
  });
});

describe("textfx", () => {
  it("keeps flat text flat", () => {
    const cells = arcLayout("ROYAL", { arc: 0, outline: false, tracking: 0 });
    assert.equal(cells.length, 5);
    for (const cell of cells) {
      assert.equal(cell.rotate, 0);
      assert.equal(cell.lift, 0);
    }
  });

  it("arches symmetrically: edges drop, right side tips clockwise", () => {
    const cells = arcLayout("ARCHED", { arc: -40, outline: false, tracking: 0 });
    const first = cells[0]!;
    const last = cells[cells.length - 1]!;
    const middle = cells[Math.floor(cells.length / 2)]!;
    assert.ok(Math.abs(first.lift - last.lift) < 0.01);
    assert.ok(first.lift > middle.lift);
    assert.ok(last.rotate > 0);
    assert.ok(first.rotate < 0);
  });

  it("clamps wild fx and every preset is valid", () => {
    const clamped = clampFx({ arc: 999, outline: true, tracking: 9 });
    assert.equal(clamped.arc, 120);
    assert.equal(clamped.tracking, 0.6);
    for (const preset of TEXT_PRESETS) {
      const fx = clampFx(preset.fx);
      assert.deepEqual(fx, preset.fx);
    }
  });
});

const area = { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 };
const textLayer = {
  id: "t",
  type: "text" as const,
  text: "ROYAL",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};

describe("preflight", () => {
  it("passes a clean piece and fails an invisible one", () => {
    const clean = runPrintChecks({ layers: [textLayer], area, garmentHex: "#141414" });
    assert.equal(preflightVerdict(clean), "pass");
    const invisible = runPrintChecks({
      layers: [{ ...textLayer, color: "#181818" }],
      area,
      garmentHex: "#141414",
    });
    assert.equal(preflightVerdict(invisible), "fail");
    assert.equal(canPublish("fail", false), false);
    assert.equal(canPublish("fail", true), true);
    assert.equal(canPublish("pass", false), true);
  });

  it("computes effective DPI from placed size", () => {
    const image = { id: "i", type: "image" as const, src: "x", x: 0.5, y: 0.5, scale: 1, rotation: 0 };
    const dpi = effectiveDpi({ layerId: "i", widthPx: 1800, heightPx: 1800 }, image, area);
    assert.equal(dpi, Math.round(1800 / (0.52 * 12)));
    const checks = runPrintChecks({
      layers: [image],
      area,
      garmentHex: "#141414",
      images: [{ layerId: "i", widthPx: 200, heightPx: 200 }],
    });
    assert.equal(checks.find((check) => check.key === "dpi")?.level, "fail");
  });

  it("warns when art spills past the box", () => {
    const wide = { id: "i", type: "image" as const, src: "x", x: 0.5, y: 0.5, scale: 2, rotation: 0 };
    const checks = runPrintChecks({ layers: [wide], area, garmentHex: "#141414" });
    assert.equal(checks.find((check) => check.key === "bounds")?.level, "warn");
    const edged = { ...textLayer, x: 0.92 };
    const edgeChecks = runPrintChecks({ layers: [edged], area, garmentHex: "#141414" });
    assert.equal(edgeChecks.find((check) => check.key === "bounds")?.level, "warn");
  });
});

describe("fork rules", () => {
  it("never forks another user's private draft", () => {
    const draft = { ownerId: "owner", status: "draft", title: "Secret" };
    assert.equal(canForkDesign(draft, "someone-else"), false);
    assert.equal(canForkDesign(draft, "owner"), true);
    assert.equal(canForkDesign({ ...draft, status: "published" }, "someone-else"), true);
    assert.equal(canForkDesign({ ...draft, status: "published" }, ""), false);
    assert.match(forkCredit(draft), /Secret/);
  });
});

function piece(partial: Partial<DesignSummary>): DesignSummary {
  return {
    id: "p1",
    title: "Piece",
    slug: "piece-p1",
    status: "published",
    collectionId: null,
    productId: "tee-heavy",
    productName: "Heavyweight Street Tee",
    productType: "T-Shirt",
    variantId: "v1",
    variantLabel: "Tee / Black / M",
    colorName: "Black",
    colorHex: "#141414",
    sizeLabel: "M",
    placement: "front",
    technique: "dtg",
    mockupUrl: null,
    retailCents: 3069,
    currency: "USD",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

function order(partial: Partial<OrderSummary>): OrderSummary {
  return {
    id: "o1",
    status: "pending",
    paymentStatus: "paid",
    currency: "USD",
    subtotalCents: 3000,
    shippingCents: 595,
    totalCents: 3595,
    shippingMethod: "STANDARD",
    providerOrderId: "sb-1",
    providerStatus: null,
    trackingNumber: null,
    trackingUrl: null,
    sandbox: true,
    failureReason: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    items: [{ title: "Piece", quantity: 2, variantLabel: "M", unitCents: 1500 }],
    ...partial,
  };
}

describe("drops, floor, pipeline", () => {
  it("groups drops by collection and flags live ones", () => {
    const now = new Date("2026-11-15T00:00:00.000Z");
    const drops = groupDrops(
      [piece({ collectionId: "c1" }), piece({ id: "p2", collectionId: "c2" })],
      [
        { id: "c1", name: "Core Four", dropAt: "2026-11-10T00:00:00.000Z" },
        { id: "c2", name: "Later", dropAt: "2026-12-01T00:00:00.000Z" },
        { id: "c3", name: "Plain collection", dropAt: null },
      ],
      now,
    );
    assert.equal(drops.length, 2);
    assert.equal(drops[0]?.live, true);
    assert.equal(drops[1]?.live, false);
  });

  it("floor takes only old, uncollected, published pieces — oldest first", () => {
    const now = new Date("2026-11-15T00:00:00.000Z");
    const floor = cuttingRoomFloor(
      [
        piece({ id: "old", updatedAt: "2026-09-01T00:00:00.000Z" }),
        piece({ id: "fresh", updatedAt: "2026-11-14T00:00:00.000Z" }),
        piece({ id: "kept", collectionId: "c1", updatedAt: "2026-08-01T00:00:00.000Z" }),
        piece({ id: "drafty", status: "draft", updatedAt: "2026-08-01T00:00:00.000Z" }),
      ],
      4,
      now,
    );
    assert.deepEqual(
      floor.map((item) => item.id),
      ["old"],
    );
  });

  it("walks the pipeline and blocks stuck orders", () => {
    assert.equal(pipelineFor(order({ paymentStatus: "unpaid" })).stage, "Design locked");
    assert.equal(pipelineFor(order({})).stage, "Print");
    assert.equal(pipelineFor(order({ trackingNumber: "1Z" })).stage, "Shipped");
    const stuck = pipelineFor(order({ status: "failed" }));
    assert.equal(stuck.blocked, true);
  });
});

describe("dashboard + themes", () => {
  it("sums only paid orders and ranks movers", () => {
    const stats = dashboardStats(
      [piece({}), piece({ id: "p2", status: "draft", forkedFromTitle: "Origin" })],
      [order({}), order({ id: "o2", paymentStatus: "unpaid", totalCents: 9999 })],
    );
    assert.equal(stats.published, 1);
    assert.equal(stats.drafts, 1);
    assert.equal(stats.forks, 1);
    assert.equal(stats.revenueCents, 3595);
    assert.equal(stats.units, 2);
    assert.equal(stats.bestMovers[0]?.title, "Piece");
  });

  it("switches themes and defaults to maximal", () => {
    assert.equal(themeById("matte").id, "matte");
    assert.equal(themeById("nope").id, "maximal");
    assert.equal(nextTheme("matte").id, "maximal");
    assert.equal(nextTheme("maximal").id, "matte");
  });
});
