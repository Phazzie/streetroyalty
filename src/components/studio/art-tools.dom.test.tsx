import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Make-art is a paid call. A signed-out visitor sees a sign-in prompt and the
 * request is never sent. A signed-in visitor's refusal from the server is the
 * same prompt, not the raw Unauthorized error.
 */

const mocks = vi.hoisted(() => ({
  generateArt: vi.fn(),
  session: { user: null as { id: string } | null, isPending: false },
}));

vi.mock("@/lib/ai/art", () => ({ generateArt: mocks.generateArt }));
vi.mock("@/lib/lab-api", () => ({ generateLook: vi.fn() }));
vi.mock("@/lib/store", () => ({
  hydrate: vi.fn(),
  useLab: (pick: (state: { refs: never[] }) => unknown) => pick({ refs: [] }),
}));
vi.mock("@/lib/gfx/canvas", () => ({
  fitPng: (pixels: unknown) => pixels,
  garmentPreview: vi.fn(),
  loadPixels: vi.fn(),
  urlToDataUrl: vi.fn(),
}));
vi.mock("@/lib/gfx/effects", () => ({
  halftone: vi.fn(),
  hexToRgb: vi.fn(),
  inkLightMarks: vi.fn(),
  knockout: (pixels: unknown) => pixels,
  oneColor: vi.fn(),
}));
vi.mock("@/lib/tryon/flat", () => ({ allOverSheet: vi.fn() }));
vi.mock("@/lib/tryon/garment", () => ({ allOverWords: vi.fn(), placementWords: vi.fn() }));
vi.mock("@/lib/tryon/reference", () => ({ mockupReference: vi.fn() }));
vi.mock("@/lib/tryon/faces", () => ({ tryOnFaces: vi.fn() }));
vi.mock("@/lib/auth/use-current-user", () => ({
  useCurrentUserState: () => mocks.session,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { ArtMaker } = await import("./art-tools.tsx");

function renderMaker(onNote: (text: string) => void = () => undefined) {
  return render(<ArtMaker full={false} onArt={() => undefined} onNote={onNote} />);
}

function submitIdea() {
  const input = screen.getByLabelText("Make art");
  fireEvent.change(input, { target: { value: "a crown" } });
  const form = input.closest("form");
  if (!form) throw new Error("missing form");
  fireEvent.submit(form);
}

beforeEach(() => {
  mocks.generateArt.mockReset();
  mocks.session = { user: null, isPending: false };
});

describe("make art while signed out", () => {
  it("shows a sign-in prompt and does not call the picture maker", () => {
    renderMaker();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByText(/Sign in to draw/)).toBeTruthy();
    submitIdea();
    expect(mocks.generateArt).not.toHaveBeenCalled();
  });

  it("waits out a session that is still loading", () => {
    mocks.session = { user: null, isPending: true };
    renderMaker();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("draws for a signed-in account", async () => {
    mocks.session = { user: { id: "ada" }, isPending: false };
    mocks.generateArt.mockResolvedValue({ ok: false, kind: "limit" });
    const notes: string[] = [];
    renderMaker((text) => notes.push(text));
    submitIdea();
    await waitFor(() =>
      expect(mocks.generateArt).toHaveBeenCalledWith({ data: { idea: "a crown", style: "ink" } }),
    );
    expect(notes.join(" ")).not.toMatch(/Unauthorized/);
  });

  it("turns a signed-out refusal into the sign-in prompt", async () => {
    mocks.session = { user: { id: "ada" }, isPending: false };
    mocks.generateArt.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401, name: "UnauthorizedError" }),
    );
    const notes: string[] = [];
    renderMaker((text) => notes.push(text));
    submitIdea();
    await waitFor(() => expect(notes.join(" ")).toMatch(/Sign in to draw/));
    expect(notes.join(" ")).not.toMatch(/Unauthorized/);
  });
});
