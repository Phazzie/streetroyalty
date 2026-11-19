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
    name: "AOP Hoodie",
    type: "Hoodie",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
  {
    id: 400,
    name: "AOP Joggers",
    type: "Joggers",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
  {
    id: 801,
    name: "AOP Track Jacket",
    type: "Jacket",
    techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
    placements: [{ placement: "front", technique: "dtg", title: "Front" }],
  },
];

const TEE = {
  id: 71,
  name: "Softstyle Tee",
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
      ],
    });
  }
  if (url.includes("/prices")) {
    return Response.json({
      data: {
        currency: "USD",
        variant: { id: 9001, techniques: [{ technique_key: "dtg", discounted_price: "40.75" }] },
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
  expect(screen.getByRole("button", { name: /AOP Hoodie/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /AOP Joggers/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /AOP Track Jacket/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /AOP Hoodie/ }));
  expect(await screen.findByRole("img", { name: "AOP Hoodie, front" })).toBeTruthy();
  const titles = screen.getAllByRole("button").map((button) => button.textContent ?? "");
  expect(titles).toContain("Hood");
  expect(
    screen.getAllByText(/Ordering opens once the printer's panel templates/).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText(/Print area/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "See the set" }));
  await waitFor(() => {
    expect(screen.getByText(/Joggers:/)).toBeTruthy();
  });
}

describe("the studio tracksuit", () => {
  beforeEach(() => {
    harness.mode = "sandbox";
  });

  it("shows the tracksuit and attaches the hoodie panel editor in the sandbox", async () => {
    await openHoodie("Heavyweight Street Tee");
  });

  it("shows the tracksuit and attaches the hoodie panel editor on live Printful", async () => {
    harness.mode = "live";
    await openHoodie("Softstyle Tee");
  });
});
