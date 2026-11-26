import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BlankSizes } from "@/lib/help/sizes";
import { convert } from "@/lib/help/units";
import { SizeChart } from "./size-chart";

const HOODIE: BlankSizes = {
  id: "hoodie-pullover",
  printfulId: 380,
  name: "Premium Pullover Hoodie",
  model: "Cotton Heritage M2580",
  sizes: ["S", "M"],
  guide: {
    sizes: ["S", "M"],
    tables: [
      {
        kind: "product",
        unit: "inches",
        sizes: ["S", "M"],
        rows: [{ label: "Length", values: { S: "27", M: "28.5" } }],
      },
      {
        kind: "body",
        unit: "inches",
        sizes: ["S", "M"],
        rows: [{ label: "Chest", values: { S: "34–37" } }],
      },
    ],
  },
};

describe("the size chart", () => {
  it("shows Printful's measurements and switches to centimetres", () => {
    render(<SizeChart blank={HOODIE} highlight="M" />);
    expect(screen.getByText(/runs small/)).toBeTruthy();
    expect(screen.getByText("The piece laid flat.")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "28.5" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "–" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "cm" }));
    expect(screen.getByRole("cell", { name: "72.4" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "86.4–94" })).toBeTruthy();
  });

  it("links Printful's own guide when the measurements did not load", () => {
    render(<SizeChart blank={{ ...HOODIE, printfulId: 412, guide: null }} />);
    expect(screen.getByText(/didn't load/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toContain("productId=412");
  });

  it("converts every number in a cell", () => {
    expect(convert("10", "in")).toBe("10");
    expect(convert("10–12", "cm")).toBe("25.4–30.5");
  });
});
