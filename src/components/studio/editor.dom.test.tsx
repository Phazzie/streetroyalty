import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrintfulProvider } from "@/lib/pod/printful";
import { createSandboxProvider } from "@/lib/pod/sandbox";

/**
 * The studio against the real sandbox catalog and a mocked Printful catalog.
 * The panel editor attaches only when the product carries a template id from
 * the mapping, which is what live mode was missing.
 */
const harness = vi.hoisted(() => ({ mode: "sandbox" as "sandbox" | "live" }));

const TRACKSUIT = [
  {
    id: 388,
    name: "All-Over Hoodie",
    type: "Hoodie",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
  {
    id: 400,
    name: "All-Over Joggers",
    type: "Joggers",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
  {
    id: 801,
    name: "All-Over Track Jacket",
    type: "Jacket",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
];

const TEE = {
  id: 586,
  name: "Garment-Dyed Heavyweight T-Shirt",
  type: "T-Shirt",
  techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
  placements: [{ placement: "front", technique: "dtg", title: "Front" }],
};

function printfulFetch(input: RequestInfo | URL): Response {
  const url = String(input);
  if (url.includes("/catalog-variants")) {
    return Response.json({
      data: [
        {
          id: 9001,
          name: "Printed M",
          size: "M",
          color: "Printed",
          color_code: "#c4a6e0",
          placement_dimensions: [{ placement: "front", width: 12, height: 16 }],
        },
        {
          id: 15115,
          name: "Black M",
          size: "M",
          color: "Black",
          color_code: "#1b1b1c",
          placement_dimensions: [{ placement: "front", width: 12, height: 16 }],
        },
      ],
    });
  }
  if (url.includes("/prices")) {
    return Response.json({
      data: {
        currency: "USD",
        variants: [9001, 15115].map((id) => ({
          id,
          techniques: [{ technique_key: "dtg", discounted_price: "40.75" }],
        })),
      },
    });
  }
  const id = url.match(/catalog-products\/(\d+)/)?.[1];
  if (id) {
    const found = [TEE, ...TRACKSUIT].find((item) => String(item.id) === id) ?? null;
    return Response.json({ data: found });
  }
  return Response.json({
    data: [TEE, ...TRACKSUIT],
    paging: { total: 4, offset: 0, limit: 24 },
  });
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => async () => undefined,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/lib/ai/api", () => ({
  suggestLines: async () => [],
}));

vi.mock("@/lib/studio/api", () => {
  const sandbox = createSandboxProvider(new Map(), 2);
  const live = createPrintfulProvider({
    apiKey: "pk_test",
    fetchImpl: (input) => Promise.resolve(printfulFetch(input)),
    markup: 2,
  });
  const provider = () => (harness.mode === "live" ? live : sandbox);
  return {
    listCatalog: async () => provider().listProducts({ offset: 0, limit: 24 }),
    getCatalogProduct: async ({ data }: { data: { productId: string } }) =>
      provider().getProduct(data.productId),
    myCollections: async () => [],
    myDesign: async () => {
      throw new Error("no design");
    },
    savePiece: async () => ({ id: "design-1" }),
    publishPiece: async () => ({ id: "design-1" }),
    makeMockup: async () => ({ mockupUrl: "", status: "completed" }),
    cartAdd: async () => undefined,
    addCollection: async () => ({ id: "c", name: "Capsules", count: 0 }),
  };
});

import { Editor } from "./editor";

async function openHoodie(firstHeading: string) {
  render(<Editor designId="" />);
  expect(await screen.findByRole("heading", { name: firstHeading })).toBeTruthy();
  expect(screen.getByRole("button", { name: /All-Over Hoodie/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /All-Over Joggers/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /All-Over Track Jacket/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /All-Over Hoodie/ }));
  expect(await screen.findByRole("img", { name: "All-Over Hoodie, front" })).toBeTruthy();
  const titles = screen.getAllByRole("button").map((button) => button.textContent ?? "");
  expect(titles).toContain("Hood");
  // All-over pieces print from real Printful pieces now, so ordering is open.
  expect(screen.queryByText(/cannot be ordered yet/)).toBeNull();
  expect(screen.getByText(/These checks cover your logo layers/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "See print sheets" }));
  expect(await screen.findByRole("img", { name: "Hood print sheet" })).toBeTruthy();
  expect(screen.queryByText(/Print area/)).toBeNull();
  expect(screen.queryByRole("button", { name: "See the set" })).toBeNull();
}

describe("the studio's all-over pieces", () => {
  beforeEach(() => {
    harness.mode = "sandbox";
  });

  it("lists the all-over pieces and attaches the hoodie panel editor in the sandbox", async () => {
    await openHoodie("Heavyweight Tee");
  });

  it("lists only the studio's own pieces on live Printful and attaches the panel editor", async () => {
    harness.mode = "live";
    await openHoodie("Garment-Dyed Heavyweight T-Shirt");
  });
});

describe("a regular piece with art on every spot", () => {
  beforeEach(() => {
    harness.mode = "sandbox";
  });

  it("keeps each spot's art apart, marks the spots that print, and prices the extra ones", async () => {
    render(<Editor designId="" />);
    expect(await screen.findByRole("heading", { name: "Heavyweight Tee" })).toBeTruthy();
    const chip = (name: RegExp) => screen.getByRole("button", { name });
    // The starter line sits on the front only.
    expect(chip(/^Front, has art$/)).toBeTruthy();
    const starter = () => screen.queryAllByRole("button", { name: "STREET ROYALTY" });
    expect(starter().length).toBeGreaterThan(0);
    expect(screen.queryByText(/Includes/)).toBeNull();

    fireEvent.click(chip(/^Back$/));
    expect(starter()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Add text" }));
    expect(await screen.findByRole("button", { name: "Back, has art" })).toBeTruthy();
    expect(screen.getByText(/2 spots print on this piece/)).toBeTruthy();
    // The back is $5.95 at Printful, marked up 2x in this harness.
    expect(screen.getByText("Includes $11.90 for the extra print spots.")).toBeTruthy();

    fireEvent.click(chip(/^Front, has art$/));
    expect(starter().length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: "NEW" })).toEqual([]);
  });
});
