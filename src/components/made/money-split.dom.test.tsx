import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const config = vi.fn();

vi.mock("@/lib/studio/api", () => ({ getStudioConfig: () => config() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

const { MoneySplit } = await import("../rack/money-split.tsx");
const { SeamBar } = await import("./seam-bar.tsx");

afterEach(() => {
  cleanup();
  config.mockReset();
});

describe("where the money goes", () => {
  it("splits the price by the studio markup and says it is an estimate", async () => {
    config.mockResolvedValue({ markup: 2.2, currency: "USD", podMode: "sandbox" });
    render(<MoneySplit retailCents={4800} productType="Hoodie" />);

    await waitFor(() => expect(screen.getByText("Where the money goes")).toBeTruthy());
    expect(screen.getByText("Estimate")).toBeTruthy();
    const bar = screen.getByRole("img");
    expect(bar.getAttribute("aria-label")).toBe(
      "Making it $21.82, The card fee $1.69, What is left $24.49",
    );
    expect(screen.getByText(/Maker payouts are not switched on yet/)).toBeTruthy();
    expect(screen.getByText(/goes to Street Royalty/)).toBeTruthy();
    expect(screen.getByText(/The blank hoodie and the print/)).toBeTruthy();
    expect(screen.getByText("Do the math on your own piece").getAttribute("href")).toBe("/math");
  });

  it("shows nothing when the markup can not be read", async () => {
    config.mockRejectedValue(new Error("offline"));
    const view = render(<MoneySplit retailCents={4800} productType="Hoodie" />);
    await waitFor(() => expect(config).toHaveBeenCalled());
    expect(view.container.textContent).toBe("");
  });

  it("shows nothing for a piece with no price", async () => {
    config.mockResolvedValue({ markup: 2.2, currency: "USD", podMode: "sandbox" });
    const view = render(<MoneySplit retailCents={0} productType="Hoodie" />);
    await waitFor(() => expect(config).toHaveBeenCalled());
    expect(view.container.textContent).toBe("");
  });
});

describe("the seam bar", () => {
  it("leaves empty parts out of the bar but keeps them in the list", () => {
    const view = render(
      <SeamBar
        parts={[
          { key: "a", label: "Making it", cents: 1000, tone: "ink" },
          { key: "b", label: "The house", cents: 0, tone: "cross" },
          { key: "c", label: "You keep", cents: 3000, tone: "soft" },
        ]}
      />,
    );
    expect(view.container.querySelectorAll(".seam-seg")).toHaveLength(2);
    expect(view.container.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("$0")).toBeTruthy();
  });
});
