import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The remix button and the family tree, with the router, the session and the server
 * calls swapped for stand-ins. The real calls are covered by remix.int.test.ts.
 */

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  remixPiece: vi.fn(),
  pieceFamily: vi.fn(),
  session: { user: null as { id: string } | null, isPending: false },
}));

vi.mock("@tanstack/react-router", async () => {
  const { createElement } = await import("react");
  type LinkProps = {
    to: string;
    params?: Record<string, string>;
    children?: unknown;
    className?: string;
    "aria-label"?: string;
  };
  return {
    Link: ({ to, params, children, ...rest }: LinkProps) =>
      createElement(
        "a",
        { href: to.replace(/\$(\w+)/g, (_match, key: string) => params?.[key] ?? ""), ...rest },
        children as never,
      ),
    useNavigate: () => mocks.navigate,
  };
});
vi.mock("@/lib/social/remix-api", () => ({
  remixPiece: mocks.remixPiece,
  pieceFamily: mocks.pieceFamily,
}));
vi.mock("@/lib/auth/use-current-user", () => ({ useCurrentUserState: () => mocks.session }));
vi.mock("@/components/site/shell", () => ({ Crown: () => null }));

const { RemixButton } = await import("../rack/remix-button.tsx");
const { FamilyTree, FamilyTreeView } = await import("../rack/family-tree.tsx");

const stop = (title: string, handle: string | null, onRack = true) => ({
  slug: onRack ? title.toLowerCase().replace(/ /g, "-") : null,
  title,
  mockupUrl: onRack ? "data:image/svg+xml;utf8,%3Csvg%2F%3E" : null,
  maker: { name: handle ? `${handle} name` : "Plain Name", handle },
  onRack,
});

beforeEach(() => {
  mocks.navigate.mockReset().mockResolvedValue(undefined);
  mocks.remixPiece.mockReset();
  mocks.pieceFamily.mockReset();
  mocks.session = { user: null, isPending: false };
});

describe("the remix button", () => {
  it("sends a signed-out visitor to sign in and copies nothing", () => {
    render(<RemixButton designId="d1" slug="crown-tee-1" />);
    // Signing in lands on the studio, not back here, so the line under the button says so first.
    expect(screen.getByText(/Sign in first, then come back here/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Remix this/ }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(mocks.remixPiece).not.toHaveBeenCalled();
  });

  it("does not ask a signed-in maker to sign in", () => {
    mocks.session = { user: { id: "bo" }, isPending: false };
    render(<RemixButton designId="d1" slug="crown-tee-1" />);
    expect(screen.getByText(/The original maker stays credited/)).toBeTruthy();
    expect(screen.queryByText(/Sign in first/)).toBeNull();
  });

  it("makes one copy however many times it is tapped, then opens it in the studio", async () => {
    mocks.session = { user: { id: "bo" }, isPending: false };
    let finish: (value: { designId: string }) => void = () => undefined;
    mocks.remixPiece.mockReturnValue(
      new Promise<{ designId: string }>((resolve) => {
        finish = resolve;
      }),
    );
    render(<RemixButton designId="d1" slug="crown-tee-1" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.remixPiece).toHaveBeenCalledTimes(1);
    expect(mocks.remixPiece).toHaveBeenCalledWith({ data: { slug: "crown-tee-1" } });
    await waitFor(() => expect(button.textContent).toMatch(/Making your copy/));

    finish({ designId: "new-id" });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/studio", search: { design: "new-id" } }),
    );
    // Still locked once the copy exists, so a late tap cannot make a second one.
    fireEvent.click(button);
    expect(mocks.remixPiece).toHaveBeenCalledTimes(1);
  });

  it("says what went wrong and lets the person try again", async () => {
    mocks.session = { user: { id: "bo" }, isPending: false };
    mocks.remixPiece.mockRejectedValueOnce(new Error("That piece is not on the rack."));
    render(<RemixButton designId="d1" slug="crown-tee-1" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That piece is not on the rack.");

    mocks.remixPiece.mockResolvedValueOnce({ designId: "second" });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.remixPiece).toHaveBeenCalledTimes(2));
  });

  it("goes to sign in when the session ran out on the way", async () => {
    mocks.session = { user: { id: "bo" }, isPending: false };
    mocks.remixPiece.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    );
    render(<RemixButton designId="d1" slug="crown-tee-1" />);

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the family tree", () => {
  it("stays one line for an original nobody has remixed", () => {
    const { container } = render(
      <FamilyTreeView
        family={{
          chain: [stop("Solo", "ada")],
          broken: false,
          remixes: [],
          remixCount: 0,
          descendants: 0,
          atLeast: false,
        }}
      />,
    );
    expect(container.textContent).toBe("An original. Nobody has remixed it yet.");
    expect(container.querySelector("section")).toBeNull();
  });

  it("links what is on the rack and credits what left it without a link", () => {
    const { container } = render(
      <FamilyTreeView
        family={{
          chain: [
            stop("Do Better", "ada"),
            stop("Loud Pack", "cy", false),
            { slug: null, title: null, mockupUrl: null, maker: null, onRack: false },
            stop("Royal Blue", null),
          ],
          broken: false,
          remixes: [{ ...stop("Royal Red", "bo"), below: 2 }],
          remixCount: 1,
          descendants: 3,
          atLeast: false,
        }}
      />,
    );
    const hrefs = [...container.querySelectorAll("a:not([aria-hidden])")].map((link) =>
      link.getAttribute("href"),
    );
    // The original and the remix link to their rack pages; makers with a handle link to /m.
    expect(hrefs).toEqual(["/rack/do-better", "/m/ada", "/m/cy", "/rack/royal-red", "/m/bo"]);
    expect(container.textContent).toContain("Loud Pack");
    expect(container.textContent).toContain("A piece that was deleted");
    expect(container.textContent?.match(/No longer on the rack\./g)).toHaveLength(2);
    expect(container.textContent).toContain("by Plain Name");
    expect(container.textContent).toContain("2 more pieces down this branch.");
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain("Royal Blue");
    // Pictures only for pieces still on the rack.
    expect(container.querySelectorAll("img")).toHaveLength(3);
  });

  it("loads by slug and shows nothing when the piece is not on the rack", async () => {
    mocks.pieceFamily.mockRejectedValueOnce(new Error("That piece is not on the rack."));
    const { container } = render(<FamilyTree slug="gone-1" />);
    expect(mocks.pieceFamily).toHaveBeenCalledWith({ data: { slug: "gone-1" } });
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
