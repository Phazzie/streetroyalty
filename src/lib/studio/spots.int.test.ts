import { beforeEach, describe, expect, it } from "vitest";
import { addToCart, listCart, priceCart } from "./cart.server.ts";
import { getDesign, publishDesign, saveDesign, storePrintFile } from "./designs.server.ts";
import { applyMarkup } from "../pod/money.ts";
import { designSpots, type DesignRow } from "./shared.server.ts";
import { parseLayers } from "./validate.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { seedUser } from "../../test/seed.ts";

const MOCK = "data:image/svg+xml;utf8,%3Csvg%2F%3E";
const word = (text: string) => [
  { id: text, type: "text", text, x: 0.5, y: 0.4, scale: 1, rotation: 0 },
];

function tee(spots?: unknown) {
  return {
    title: "Every side tee",
    productId: "tee-heavy",
    variantId: "tee-heavy-black-m",
    placement: "front",
    layers: word("FRONT"),
    printFile: pngDataUrl(1800, 2400),
    mockupUrl: MOCK,
    spots,
  };
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("a regular piece with art on more than one spot", () => {
  it("keeps every spot, prices each extra spot, and sends one file per spot", async () => {
    const back = await storePrintFile("ada", pngDataUrl(1800, 2400));
    const sleeve = await storePrintFile("ada", pngDataUrl(525, 525));
    const saved = await saveDesign(
      "ada",
      tee([
        { placement: "back", layers: word("BACK"), printFileId: back },
        { placement: "sleeve_left", layers: word("L"), printFileId: sleeve },
        // A spot with no art is not printed.
        { placement: "sleeve_right", layers: [], printFileId: null },
      ]),
    );
    const again = await getDesign("ada", saved.id);
    expect(again.spots.map((spot) => spot.placement)).toEqual(["front", "back", "sleeve_left"]);
    expect(again.spots[1]?.layers[0]).toMatchObject({ text: "BACK" });
    expect(again.spots[2]?.printFileId).toBe(sleeve);
    // M black is $15.60 wholesale; the back adds $5.95 and a short sleeve $2.49.
    const base = applyMarkup(1560, 2.2);
    const extra = applyMarkup(595, 2.2) + applyMarkup(249, 2.2);
    expect(again.retailCents).toBe(base + extra);

    await publishDesign("ada", saved.id);
    await addToCart("bo", saved.id, "tee-heavy-black-l");
    const [line] = await listCart("bo");
    expect(line?.unitCents).toBe(base + extra);
    const priced = await priceCart("bo");
    const order = priced.lines[0];
    expect(order?.unitCents).toBe(base + extra);
    expect(order?.files?.map((file) => file.placement)).toEqual(["front", "back", "sleeve_left"]);
    expect(order?.files?.[2]?.area).toMatchObject({ placement: "sleeve_left", widthIn: 3.5 });
  });

  it("refuses a spot the blank does not print, and a print file that is not the maker's", async () => {
    const theirs = await storePrintFile("bo", pngDataUrl(1800, 2400));
    await expect(
      saveDesign("ada", tee([{ placement: "leg_front_left", layers: word("X") }])),
    ).rejects.toThrow(/does not print there/);
    await expect(
      saveDesign("ada", tee([{ placement: "back", layers: word("X"), printFileId: theirs }])),
    ).rejects.toThrow(/print file/);
  });

  it("keeps a one-spot piece exactly as before", async () => {
    const saved = await saveDesign("ada", tee());
    const again = await getDesign("ada", saved.id);
    expect(again.spots).toHaveLength(1);
    expect(again.retailCents).toBe(applyMarkup(1560, 2.2));
    await addToCart("ada", saved.id, "tee-heavy-black-m");
    const priced = await priceCart("ada");
    expect(priced.lines[0]?.files).toBeUndefined();
  });

  it("will not publish a spot that lost its print file", async () => {
    const saved = await saveDesign(
      "ada",
      tee([{ placement: "back", layers: word("BACK"), printFileId: null }]),
    );
    await expect(publishDesign("ada", saved.id)).rejects.toThrow(/every spot/);
  });

  it("reads a damaged spots column as the row's own spot", () => {
    const layers = JSON.stringify(word("FRONT"));
    const row = {
      placement: "front",
      technique: "dtg",
      layers_json: layers,
      print_file_id: "front-file",
    } as DesignRow;
    const only = [
      {
        placement: "front",
        technique: "dtg",
        layers: parseLayers(word("FRONT")),
        printFileId: "front-file",
      },
    ];
    expect(designSpots({ ...row, spots_json: null })).toEqual(only);
    expect(designSpots({ ...row, spots_json: "{not json" })).toEqual(only);
    expect(designSpots({ ...row, spots_json: "{}" })).toEqual(only);
    expect(designSpots({ ...row, spots_json: "[]" })).toEqual(only);
    const mixed = JSON.stringify([
      null,
      { placement: 7 },
      { placement: "front", layers: word("OLD") },
      { placement: "back", layers: word("BACK") },
      {
        placement: "sleeve_left",
        technique: "dtg",
        layers: parseLayers(word("L")),
        printFileId: "left-file",
      },
    ]);
    expect(designSpots({ ...row, spots_json: mixed })).toEqual([
      only[0],
      { placement: "back", technique: "dtg", layers: parseLayers(word("BACK")), printFileId: null },
      {
        placement: "sleeve_left",
        technique: "dtg",
        layers: parseLayers(word("L")),
        printFileId: "left-file",
      },
    ]);
  });
});
