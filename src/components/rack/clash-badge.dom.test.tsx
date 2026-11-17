import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClashBadge } from "./clash-badge";

describe("ClashBadge", () => {
  it("renders nothing for an empty palette, or one with no real colours", () => {
    expect(render(<ClashBadge palette={[]} />).container.innerHTML).toBe("");
    expect(render(<ClashBadge palette={["nope", ""]} />).container.innerHTML).toBe("");
  });

  it("shows the label, the number and one swatch per colour", () => {
    const { container } = render(
      <ClashBadge palette={["#ff2d95", "#19e06a", "#ff6a00", "#FF2D95"]} />,
    );
    const badge = screen.getByRole("img");
    expect(badge.getAttribute("aria-label")).toMatch(/^Clash score \d+ out of 100\. Riot\.$/);
    expect(badge.textContent).toMatch(/Riot\s*\d+/);
    expect(container.querySelectorAll("[style*='background']")).toHaveLength(3);
  });

  it("adds the first reason at the larger size", () => {
    render(<ClashBadge palette={["#111111", "#888888", "#eeeeee"]} size="md" />);
    const badge = screen.getByRole("img");
    expect(badge.textContent).toContain("Quiet");
    expect(badge.textContent).toContain("all neutrals, nobody raising their voice");
    expect(badge.getAttribute("aria-label")).toContain("All neutrals, nobody raising their voice.");
  });

  it("never reaches for lime, whatever the score", () => {
    for (const palette of [["#111111"], ["#ff2d95", "#19e06a", "#ff6a00"]]) {
      const { container } = render(<ClashBadge palette={palette} size="md" />);
      expect(container.innerHTML).not.toMatch(/accent|lime|chip-on/);
    }
  });
});
