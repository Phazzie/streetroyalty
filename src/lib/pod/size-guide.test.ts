import { describe, expect, it } from "vitest";
import { parseSizeGuide } from "./size-guide.ts";

const PAYLOAD = {
  code: 200,
  result: {
    product_id: 380,
    available_sizes: ["S", "M", "L"],
    size_tables: [
      {
        type: "measure_yourself",
        unit: "inches",
        measurements: [
          {
            type_label: "Chest",
            values: [
              { size: "S", min_value: "34", max_value: "37" },
              { size: "M", min_value: "38", max_value: "41" },
              { size: "L", min_value: "42", max_value: "42" },
            ],
          },
        ],
      },
      {
        type: "product_measure",
        unit: "inches",
        measurements: [
          {
            type_label: "Length",
            values: [
              { size: "M", value: "28" },
              { size: "S", value: 27 },
              { size: "L", value: "" },
            ],
          },
          { type_label: "", values: [{ size: "S", value: "1" }] },
          { type_label: "Empty", values: [] },
        ],
      },
      { type: "international", unit: "inches", measurements: [] },
      null,
    ],
  },
};

describe("parseSizeGuide", () => {
  it("puts the garment measurements first and keeps Printful's size order", () => {
    const guide = parseSizeGuide(PAYLOAD);
    expect(guide?.tables.map((table) => table.kind)).toEqual(["product", "body"]);
    expect(guide?.tables[0]?.sizes).toEqual(["S", "M"]);
    expect(guide?.tables[0]?.rows).toEqual([{ label: "Length", values: { S: "27", M: "28" } }]);
    expect(guide?.tables[1]?.rows[0]?.values).toEqual({ S: "34–37", M: "38–41", L: "42" });
  });

  it("returns nothing when Printful sends nothing it can read", () => {
    expect(parseSizeGuide(null)).toBeNull();
    expect(parseSizeGuide({ result: { size_tables: [{ type: "odd", measurements: [] }] } })).toBeNull();
    expect(parseSizeGuide({ result: { size_tables: "no" } })).toBeNull();
  });

  it("falls back to the sizes it saw when Printful lists none", () => {
    const guide = parseSizeGuide({
      size_tables: [
        {
          type: "product_measure",
          measurements: [{ type_label: "Width", values: [{ size: "XL", min_value: "30" }] }],
        },
      ],
    });
    expect(guide?.tables[0]).toMatchObject({ unit: "inches", sizes: ["XL"] });
    expect(guide?.tables[0]?.rows[0]?.values.XL).toBe("30");
  });
});
