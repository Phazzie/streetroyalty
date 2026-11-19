import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { tagUrl } from "@/lib/qr";
import { PieceTag } from "@/components/rack/piece-tag";

// The router's Link needs a whole router around it. Here it only has to say where it points.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
    className,
  }: {
    to: string;
    params: { slug: string };
    search: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={`${to.replace("$slug", params.slug)}${search.m ? `?m=${search.m}` : ""}`}
      className={className}
    >
      {children}
    </a>
  ),
}));

describe("PieceTag", () => {
  it("draws the code for this piece and links to its tag, with the maker", async () => {
    render(<PieceTag slug="crown-heavy-tee" title="Crown Heavy Tee" makerHandle="@Ada" />);

    expect(screen.getByRole("heading", { name: "Scan the fit" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get the tag" }).getAttribute("href")).toBe(
      "/tag/crown-heavy-tee?m=ada",
    );

    const code = await waitFor(() =>
      screen.getByRole("img", { name: "Code that opens Crown Heavy Tee on the rack" }),
    );
    expect(code.querySelector('[data-mark="crown"]')).not.toBeNull();
    expect(tagUrl(window.location.origin, "crown-heavy-tee")).toMatch(
      /\/rack\/crown-heavy-tee\?via=tag$/,
    );
  });

  it("leaves the maker off the link when there is none, or it is not a handle", () => {
    const { unmount } = render(<PieceTag slug="paid-hat" title="Paid" />);
    expect(screen.getByRole("link", { name: "Get the tag" }).getAttribute("href")).toBe(
      "/tag/paid-hat",
    );
    unmount();

    render(<PieceTag slug="paid-hat" title="Paid" makerHandle="not a handle" />);
    expect(screen.getByRole("link", { name: "Get the tag" }).getAttribute("href")).toBe(
      "/tag/paid-hat",
    );
  });
});
