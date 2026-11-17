import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSandboxProvider } from "@/lib/pod/sandbox";

/**
 * The page against the real sandbox catalog, with the network, the router, the
 * session and the canvas stood in. The real roads are walked in a browser.
 */
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(async () => undefined),
  user: { current: null as { id: string } | null },
  mic: { current: false },
  makeMockup: vi.fn(async () => ({
    mockupUrl: "data:image/svg+xml;charset=utf-8,x",
    status: "completed",
  })),
  savePiece: vi.fn(async () => ({ id: "design-1" })),
  renderArt: vi.fn(async () => "data:image/png;base64,AAAA"),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/lib/auth/use-current-user", () => ({
  useCurrentUserState: () => ({ user: mocks.user.current, isPending: false }),
}));

vi.mock("@/lib/voice", () => ({
  micAvailable: () => mocks.mic.current,
  listen: () => null,
}));

vi.mock("@/lib/say/art", () => ({ renderArt: mocks.renderArt }));

vi.mock("@/lib/studio/api", () => {
  const provider = createSandboxProvider(new Map(), 2);
  return {
    listCatalog: async () => provider.listProducts({ offset: 0, limit: 24 }),
    getCatalogProduct: async ({ data }: { data: { productId: string } }) =>
      provider.getProduct(data.productId),
    makeMockup: mocks.makeMockup,
    savePiece: mocks.savePiece,
  };
});

import { SayPage } from "./say-page";

function type(sentence: string) {
  fireEvent.change(screen.getByLabelText("Type what you want"), { target: { value: sentence } });
  fireEvent.click(screen.getByRole("button", { name: "Make it" }));
}

function chips(): string[] {
  const piece = screen.getByRole("region", { name: "Your piece" });
  return within(piece)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

const HOODIE = "put DO BETTER on the back of a black hoodie in pink, big";

describe("the say it page", () => {
  beforeEach(() => {
    mocks.user.current = null;
    mocks.mic.current = false;
    mocks.navigate.mockClear();
    mocks.makeMockup.mockClear();
    mocks.savePiece.mockClear();
    mocks.renderArt.mockClear();
  });

  it("says plainly when the browser cannot listen, and the text box still works", async () => {
    render(<SayPage />);
    expect(await screen.findByText(/This browser cannot listen/)).toBeTruthy();
    type(HOODIE);
    await waitFor(() =>
      expect(chips()).toEqual(["Black hoodie", "Back", "DO BETTER in pink, big"]),
    );
  });

  it("draws the preview on the blank, colour and placement that were said", async () => {
    render(<SayPage />);
    type(HOODIE);
    await waitFor(() =>
      expect(mocks.makeMockup).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "hoodie-pullover",
          variantId: "hoodie-pullover-black-m",
          placement: "back",
          layers: [expect.objectContaining({ type: "text", text: "DO BETTER", color: "#ff5fa2" })],
        }),
      }),
    );
    expect(
      await screen.findByRole("img", { name: /black Pullover Hoodie that reads DO BETTER/ }),
    ).toBeTruthy();
  });

  it("shows back kindly what it missed, and says when a colour is the closest there is", async () => {
    render(<SayPage />);
    type("a white tee that says free world in blue");
    expect(await screen.findByText("Closest this blank comes in: Bone.")).toBeTruthy();
    type("make it holographic");
    const missed = await screen.findByText(/Did not catch/);
    expect(missed.parentElement?.textContent).toBe("Did not catch: make it holographic");
    // Nothing was understood, so it offers to print the words as said.
    fireEvent.click(screen.getByRole("button", { name: "Print those words" }));
    await waitFor(() => expect(chips()).toContain("MAKE IT HOLOGRAPHIC in blue, medium"));
  });

  it("follow-up chips change the piece and undo takes the last change back", async () => {
    render(<SayPage />);
    type(HOODIE);
    fireEvent.click(await screen.findByRole("button", { name: "Bigger" }));
    await waitFor(() => expect(chips()).toContain("DO BETTER in pink, huge"));
    fireEvent.click(screen.getByRole("button", { name: "On the front" }));
    await waitFor(() => expect(chips()).toContain("Front"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(chips()).toContain("Back"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(chips()).toContain("DO BETTER in pink, big"));
  });

  it("signed out, carries the words to the studio as a picture and says what signing in keeps", async () => {
    render(<SayPage />);
    type(HOODIE);
    expect(await screen.findByText(/Sign in first/)).toBeTruthy();
    const take = screen.getByRole("button", { name: "Take it to the studio" });
    await waitFor(() => expect((take as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(take);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/studio" }));
    expect(sessionStorage.getItem("sr-print-art")).toBe("data:image/png;base64,AAAA");
    expect(mocks.savePiece).not.toHaveBeenCalled();
  });

  it("signed in, saves the piece with editable words and opens it in the studio", async () => {
    mocks.user.current = { id: "user-1" };
    render(<SayPage />);
    type(HOODIE);
    const take = screen.getByRole("button", { name: "Take it to the studio" });
    await waitFor(() => expect((take as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(take);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/studio",
        search: { design: "design-1" },
      }),
    );
    expect(mocks.savePiece).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "DO BETTER",
        productId: "hoodie-pullover",
        variantId: "hoodie-pullover-black-m",
        placement: "back",
        layers: [expect.objectContaining({ type: "text", text: "DO BETTER" })],
      }),
    });
    expect(mocks.renderArt).not.toHaveBeenCalled();
  });

  it("will not take an empty piece anywhere", async () => {
    render(<SayPage />);
    const take = await screen.findByRole("button", { name: "Take it to the studio" });
    expect((take as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Say the words you want on it first.")).toBeTruthy();
  });
});
