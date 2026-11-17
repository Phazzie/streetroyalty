import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem, ShelfPiece } from "@/lib/social/activity-api";

/**
 * The two components on their own: the server calls, the session and the router are
 * stood in for, so these check what a person reads and can tab to. The SQL behind
 * the calls is covered in src/lib/social/activity.int.test.ts.
 */

const session = vi.hoisted(() => ({
  state: { user: null as { id: string } | null, isPending: false },
}));
const api = vi.hoisted(() => ({ myActivity: vi.fn(), myShelf: vi.fn() }));

vi.mock("@/lib/auth/use-current-user", () => ({ useCurrentUserState: () => session.state }));
vi.mock("@/lib/social/activity-api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a
      className={className}
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
    >
      {children}
    </a>
  ),
}));

const { ActivityFeed } = await import("./activity-feed");
const { CrownedShelf } = await import("./crowned-shelf");

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Midday on a day a whole number of days back, so the day it lands on never depends on the clock. */
function daysAgo(days: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12, 0).toISOString();
}

const CROWN: ActivityItem = {
  id: "crown:do-better:bo",
  kind: "crown",
  when: daysAgo(0),
  rollup: false,
  parts: [
    { text: "Bo", to: "maker", handle: "bo" },
    { text: " crowned " },
    { text: "Do Better Hoodie", to: "piece", slug: "do-better" },
    { text: "." },
  ],
};
const FOLLOW: ActivityItem = {
  id: "follow:cy",
  kind: "follow",
  when: daysAgo(1),
  rollup: false,
  parts: [{ text: "Cy" }, { text: " started following you." }],
};
const BATTLE: ActivityItem = {
  id: "battle:do-better:day",
  kind: "battle",
  when: daysAgo(3),
  rollup: true,
  won: 3,
  lost: 1,
  parts: [
    { text: "Do Better Hoodie", to: "piece", slug: "do-better" },
    { text: " won 3 battles and lost 1." },
  ],
};

beforeEach(() => {
  session.state = { user: { id: "ada" }, isPending: false };
  api.myActivity.mockReset();
  api.myShelf.mockReset();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

describe("ActivityFeed", () => {
  it("draws nothing and asks for nothing when signed out, or while the session is loading", () => {
    session.state = { user: null, isPending: false };
    const signedOut = render(<ActivityFeed />);
    expect(signedOut.container.innerHTML).toBe("");
    signedOut.unmount();

    session.state = { user: null, isPending: true };
    const loading = render(<ActivityFeed />);
    expect(loading.container.innerHTML).toBe("");
    expect(api.myActivity).not.toHaveBeenCalled();
  });

  it("says so when there is nothing yet", async () => {
    api.myActivity.mockResolvedValue([]);
    render(<ActivityFeed />);
    expect(
      await screen.findByText("Nothing yet. Publish a piece and it starts here."),
    ).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("groups the news under Today, Yesterday and the date, one sentence a row", async () => {
    api.myActivity.mockResolvedValue([CROWN, FOLLOW, BATTLE]);
    render(<ActivityFeed />);
    const today = await screen.findByRole("region", { name: "Today" });
    expect(within(today).getByRole("listitem").textContent).toContain(
      "Bo crowned Do Better Hoodie.",
    );
    const yesterday = screen.getByRole("region", { name: "Yesterday" });
    expect(within(yesterday).getByRole("listitem").textContent).toContain(
      "Cy started following you.",
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings.slice(0, 2)).toEqual(["Today", "Yesterday"]);
    expect(headings[2]).not.toMatch(/Today|Yesterday/);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("links names to maker pages and pieces to the rack, and leaves the rest as words", async () => {
    api.myActivity.mockResolvedValue([CROWN, FOLLOW]);
    render(<ActivityFeed />);
    const maker = await screen.findByRole("link", { name: "Bo" });
    expect(maker.getAttribute("href")).toBe("/m/bo");
    expect(screen.getByRole("link", { name: "Do Better Hoodie" }).getAttribute("href")).toBe(
      "/rack/do-better",
    );
    // Cy has no page, so the name is plain text.
    expect(screen.queryByRole("link", { name: "Cy" })).toBeNull();
  });

  it("gives every row a spoken name for its mark, so the kind is not colour alone", async () => {
    api.myActivity.mockResolvedValue([CROWN, FOLLOW, BATTLE]);
    render(<ActivityFeed />);
    await screen.findByText("Crown:");
    expect(screen.getByText("New follower:")).toBeTruthy();
    expect(screen.getByText("Battles:")).toBeTruthy();
  });

  it("can show one kind at a time", async () => {
    api.myActivity.mockResolvedValue([CROWN, FOLLOW, BATTLE]);
    render(<ActivityFeed />);
    const all = await screen.findByRole("button", { name: "All 3" });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Followers 1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem").textContent).toContain("Cy started following you.");
    expect(screen.getByRole("button", { name: "Followers 1" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "All 3" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("has no filter when all the news is one kind", async () => {
    api.myActivity.mockResolvedValue([CROWN]);
    render(<ActivityFeed />);
    await screen.findByRole("region", { name: "Today" });
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("marks what arrived since the last visit, and nothing on a first visit", async () => {
    api.myActivity.mockResolvedValue([FOLLOW, BATTLE]);
    const first = render(<ActivityFeed />);
    await screen.findByRole("region", { name: "Yesterday" });
    expect(screen.queryByText("New")).toBeNull();
    first.unmount();

    api.myActivity.mockResolvedValue([{ ...CROWN, when: hoursAgo(0) }, FOLLOW, BATTLE]);
    render(<ActivityFeed />);
    expect(await screen.findByText("1 new since you last looked.")).toBeTruthy();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("offers another go when the news does not load", async () => {
    api.myActivity.mockRejectedValueOnce(new Error("down"));
    api.myActivity.mockResolvedValue([CROWN]);
    render(<ActivityFeed />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Today" })).toBeTruthy();
  });
});

describe("CrownedShelf", () => {
  const PIECES: ShelfPiece[] = [
    {
      slug: "loud-pack",
      title: "Loud Pack Hoodie",
      mockupUrl: "/mock/loud.svg",
      maker: { name: "Cy", handle: "cy" },
      crownedAt: daysAgo(0),
    },
    {
      slug: "quiet-money",
      title: "Quiet Money Tee",
      mockupUrl: null,
      maker: { name: "Dee", handle: null },
      crownedAt: daysAgo(1),
    },
  ];

  it("draws nothing when signed out", () => {
    session.state = { user: null, isPending: false };
    const view = render(<CrownedShelf />);
    expect(view.container.innerHTML).toBe("");
    expect(api.myShelf).not.toHaveBeenCalled();
  });

  it("hangs each crowned piece in a region the keyboard can reach and slide", async () => {
    api.myShelf.mockResolvedValue(PIECES);
    render(<CrownedShelf />);
    const rail = await screen.findByRole("region", { name: /Pieces you crowned, 2/ });
    expect(rail.getAttribute("tabindex")).toBe("0");
    expect(within(rail).getAllByRole("listitem")).toHaveLength(2);
    expect(within(rail).getByRole("link", { name: "Loud Pack Hoodie" }).getAttribute("href")).toBe(
      "/rack/loud-pack",
    );
    expect(within(rail).getByRole("link", { name: "by Cy" }).getAttribute("href")).toBe("/m/cy");
    // A maker with no page is named, not linked.
    expect(within(rail).queryByRole("link", { name: /Dee/ })).toBeNull();
    expect(within(rail).getByText("Dee")).toBeTruthy();
  });

  it("points to the rack when nothing has been crowned", async () => {
    api.myShelf.mockResolvedValue([]);
    render(<CrownedShelf />);
    await waitFor(() => expect(screen.getByText(/No crowns given yet/)).toBeTruthy());
    expect(screen.getByRole("link", { name: "Go to the rack" }).getAttribute("href")).toBe("/rack");
    expect(screen.queryByRole("region", { name: /Pieces you crowned/ })).toBeNull();
  });
});
