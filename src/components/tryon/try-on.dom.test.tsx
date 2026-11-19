import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fitting room with the paid call, the lab and the canvas stood in for.
 * What is real here: the component, its wording and the rule that nothing is
 * spent until the visitor says yes. The real request is checked in a browser.
 */

const FACE = "data:image/jpeg;base64,face";
const MOCKUP = "data:image/jpeg;base64,mockup";
const PICTURE = "data:image/jpeg;base64,picture";

const mocks = vi.hoisted(() => ({
  generateLook: vi.fn(),
  tryOnStatus: vi.fn(),
  tryOnFaces: vi.fn(),
  mockupReference: vi.fn(),
  lab: { ready: true, refs: [] as { id: string; dataUrl: string }[] },
}));

vi.mock("@/lib/lab-api", () => ({ generateLook: mocks.generateLook }));
vi.mock("@/lib/tryon/api", () => ({ tryOnStatus: mocks.tryOnStatus }));
vi.mock("@/lib/tryon/faces", () => ({
  labReady: () => Promise.resolve(),
  tryOnFaces: mocks.tryOnFaces,
}));
vi.mock("@/lib/tryon/reference", () => ({ mockupReference: mocks.mockupReference }));
vi.mock("@/lib/store", () => ({
  useLab: <T,>(pick: (state: typeof mocks.lab) => T) => pick(mocks.lab),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { TryOn } = await import("@/components/rack/try-on");

const PIECE = {
  slug: "royal-blue-crown-tee",
  title: "Royal blue crown tee",
  mockupUrl: MOCKUP,
  productType: "T-shirt",
  colorName: "Royal",
  placement: "front",
};

async function room() {
  render(<TryOn {...PIECE} />);
  await waitFor(() => expect(mocks.tryOnStatus).toHaveBeenCalled());
}

async function sayYes() {
  fireEvent.click(await screen.findByRole("button", { name: /^See it on/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Yes, make it" }));
}

beforeEach(() => {
  mocks.lab = { ready: true, refs: [] };
  mocks.tryOnStatus.mockResolvedValue({ on: true, perDay: 30 });
  mocks.tryOnFaces.mockResolvedValue({ images: [FACE], yours: false });
  mocks.mockupReference.mockResolvedValue(MOCKUP);
  mocks.generateLook.mockResolvedValue({ ok: true, image: PICTURE, prompt: "p" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the fitting room", () => {
  it("says it is switched off when there is no key, and offers nothing to tap", async () => {
    mocks.tryOnStatus.mockResolvedValue({ on: false, perDay: 30 });
    await room();

    expect(await screen.findByText("Try-on is switched off for now.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(mocks.generateLook).not.toHaveBeenCalled();
  });

  it("asks before it spends, and spends nothing on a no", async () => {
    await room();

    fireEvent.click(await screen.findByRole("button", { name: "See it on the house model" }));
    expect(
      await screen.findByText(
        "This makes one generated picture, and pictures cost money. Each visitor gets 30 generated pictures a day.",
      ),
    ).toBeTruthy();
    expect(mocks.generateLook).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(await screen.findByRole("button", { name: "See it on the house model" })).toBeTruthy();
    expect(mocks.generateLook).not.toHaveBeenCalled();
  });

  it("sends one look with the face first and the mockup as the clothing", async () => {
    await room();
    await sayYes();

    await waitFor(() => expect(mocks.generateLook).toHaveBeenCalledTimes(1));
    expect(mocks.generateLook).toHaveBeenCalledWith({
      data: {
        mode: "look",
        spoken:
          "the exact royal t-shirt shown in the clothing reference, with the same print in the same place on the front, same colours and same size, plain black trousers and white sneakers",
        characterImages: [FACE],
        clothingImages: [MOCKUP],
      },
    });
  });

  it("labels what comes back as generated, and names the house model", async () => {
    await room();
    await sayYes();

    const picture = await screen.findByAltText(
      "Royal blue crown tee, worn by the house model. A generated picture.",
    );
    expect(picture.getAttribute("src")).toBe(PICTURE);
    expect(screen.getByText("Generated picture")).toBeTruthy();
    expect(screen.getByText(/Not a photo and not a print proof\./)).toBeTruthy();
    expect(
      screen.getByText("That is the house model. Lock your face in the lab to see it on you."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lock your face" }).getAttribute("href")).toBe("/lab");
  });

  it("says it is you when a face is locked in the lab", async () => {
    mocks.lab = { ready: true, refs: [{ id: "front", dataUrl: FACE }] };
    mocks.tryOnFaces.mockResolvedValue({ images: [FACE], yours: true });
    await room();

    expect(
      await screen.findByText("Your face is locked in the lab, so the mirror shows you."),
    ).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See it on you" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, make it" }));

    expect(await screen.findByText("That is you in it.")).toBeTruthy();
  });

  it("asks again before a second picture", async () => {
    await room();
    await sayYes();

    fireEvent.click(await screen.findByRole("button", { name: "Try it again" }));
    expect(await screen.findByRole("button", { name: "Yes, make it" })).toBeTruthy();
    expect(mocks.generateLook).toHaveBeenCalledTimes(1);
  });

  it("warns that the print will be missing when the mockup cannot be read", async () => {
    mocks.mockupReference.mockResolvedValue(null);
    await room();

    fireEvent.click(await screen.findByRole("button", { name: /^See it on/ }));
    expect(await screen.findByText(/shows the cut and colour only/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, make it" }));

    await waitFor(() => expect(mocks.generateLook).toHaveBeenCalledTimes(1));
    const sent = mocks.generateLook.mock.calls[0]?.[0] as {
      data: { clothingImages: string[]; spoken: string };
    };
    expect(sent.data.clothingImages).toEqual([]);
    expect(sent.data.spoken).toBe(
      "a plain royal t-shirt with no print, plain black trousers and white sneakers",
    );
  });

  it("closes the room when the paid call says there is no key", async () => {
    mocks.generateLook.mockResolvedValue({ ok: false, kind: "unavailable" });
    await room();
    await sayYes();

    expect(await screen.findByText("Try-on is switched off for now.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says the day is used up at the cap, and stops offering", async () => {
    mocks.generateLook.mockResolvedValue({ ok: false, kind: "limit" });
    await room();
    await sayYes();

    expect(
      await screen.findByText(
        "That is today's pictures used up. The fitting room opens again tomorrow.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers another go when a picture is turned down", async () => {
    mocks.generateLook.mockResolvedValue({ ok: false, kind: "missed" });
    await room();
    await sayYes();

    expect(await screen.findByText(/That one did not come out\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "See it on the house model" })).toBeTruthy();
  });

  it("says so when the server cannot be reached", async () => {
    mocks.generateLook.mockRejectedValue(new TypeError("Failed to fetch"));
    await room();
    await sayYes();

    expect(await screen.findByText(/The fitting room could not be reached\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "See it on the house model" })).toBeTruthy();
  });

  it("makes no call when there is nobody to dress", async () => {
    mocks.tryOnFaces.mockResolvedValue({ images: [], yours: false });
    await room();
    await sayYes();

    expect(await screen.findByText(/That one did not come out\./)).toBeTruthy();
    expect(mocks.generateLook).not.toHaveBeenCalled();
  });
});
