import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { truncateAll } from "../../test/db.ts";
import { rackList, rackPiece } from "../social/rack.server.ts";
import { LABEL_MAKER, LAUNCH_PIECES, printName, type LaunchPiece } from "./launch.ts";
import {
  ensureLabelStock,
  launchPrint,
  resetLabelStockForTests,
  stockLabel,
} from "./stock.server.ts";

beforeEach(async () => {
  await truncateAll();
  resetLabelStockForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the label's launch pieces", () => {
  it("has a print file for every spot of every piece", async () => {
    for (const piece of LAUNCH_PIECES) {
      for (const spot of piece.spots) {
        const url = await launchPrint(piece, spot.placement);
        expect(url, printName(piece, spot.placement)).toMatch(/^data:image\/png;base64,/);
      }
    }
    await expect(launchPrint(LAUNCH_PIECES[0]!, "pocket")).rejects.toThrow(/No print file/);
  });

  it("puts every piece on the rack once, under the label's name, priced like the cart", async () => {
    const first = await stockLabel();
    expect(first.failed).toEqual([]);
    expect(first.made).toHaveLength(LAUNCH_PIECES.length);
    expect(await stockLabel()).toEqual({ made: [], failed: [] });

    const rack = await rackList(null, "fresh");
    expect(rack).toHaveLength(LAUNCH_PIECES.length);
    expect(new Set(rack.map((piece) => piece.maker.handle))).toEqual(new Set([LABEL_MAKER.handle]));
    expect(rack.every((piece) => piece.retailCents % 100 === 0)).toBe(true);

    // The hoodie prints on the back too: its rack price carries the back, as the cart will.
    const hoodie = rack.find((piece) => piece.title === "Crown Never Came Off Hoodie");
    expect(hoodie).toBeTruthy();
    const page = await rackPiece(null, hoodie!.slug);
    const chosen = page.sizes.find((size) => size.variantId === page.variantId);
    expect(chosen?.retailCents).toBe(page.retailCents);
    expect(page.colorName).toBe("Lavender");
  });

  it("gives a failed piece its claim back so it is tried again", async () => {
    const broken: LaunchPiece = { ...LAUNCH_PIECES[1]!, key: "broken", blank: "no-such-blank" };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await stockLabel([broken])).toEqual({ made: [], failed: ["broken"] });
    expect(warn).toHaveBeenCalled();
    const sql = await getSql();
    expect(await sql`select * from label_stock`).toEqual([]);

    const noColour: LaunchPiece = { ...LAUNCH_PIECES[1]!, key: "no-colour", color: "plaid" };
    expect((await stockLabel([noColour])).failed).toEqual(["no-colour"]);
    const noSpots: LaunchPiece = { ...LAUNCH_PIECES[1]!, key: "no-spots", spots: [] };
    expect((await stockLabel([noSpots])).failed).toEqual(["no-spots"]);
  });

  it("takes a piece back off when it can't be published", async () => {
    const designs = await import("../studio/designs.server.ts");
    vi.spyOn(designs, "publishDesign").mockRejectedValueOnce(new Error("Printful said no"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await stockLabel([LAUNCH_PIECES[1]!])).failed).toEqual([LAUNCH_PIECES[1]!.key]);
    const sql = await getSql();
    expect(await sql`select id from designs where user_id = ${LABEL_MAKER.id}`).toEqual([]);
  });

  it("stocks the rack once per server, and only outside tests unless asked", async () => {
    await ensureLabelStock();
    const sql = await getSql();
    expect(await sql`select * from label_stock`).toEqual([]);
    vi.stubEnv("SR_LABEL_STOCK", "1");
    await Promise.all([ensureLabelStock(), ensureLabelStock()]);
    const rows = await sql<{ count: number }>`select count(*)::int as count from label_stock`;
    expect(rows[0]?.count).toBe(LAUNCH_PIECES.length);
  });
});
