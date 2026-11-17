import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClashMachine } from "./machine";
import {
  clashScore,
  DEFAULT_COLORWAY,
  encodeColorway,
  KEPT_KEY,
  paletteOf,
  PRESETS,
  type Colorway,
} from "@/lib/clash";

const seen: Colorway[] = [];

function Harness({ start = DEFAULT_COLORWAY }: { start?: Colorway }) {
  const [colors, setColors] = useState(start);
  return (
    <ClashMachine
      colors={colors}
      onChange={(next) => {
        seen.push(next);
        setColors(next);
      }}
    />
  );
}

/** The lever is drawn twice, once for phones and once for wide screens. Either will do. */
function pull() {
  const lever = screen.getAllByRole("button", { name: "Pull" })[0];
  if (!lever) throw new Error("no lever");
  fireEvent.click(lever);
}

function last(): Colorway {
  const colors = seen[seen.length - 1];
  if (!colors) throw new Error("nothing changed");
  return colors;
}

beforeEach(() => {
  seen.length = 0;
  window.localStorage.clear();
  // Reduced motion: the reels swap at once, so nothing here waits on a timer.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ClashMachine", () => {
  it("shows the score for the colours it was given", () => {
    render(<Harness />);
    const result = clashScore(paletteOf(DEFAULT_COLORWAY));
    const stage = screen.getByRole("region", { name: "The colourway" });
    expect(within(stage).getByText(result.label)).toBeTruthy();
    expect(within(stage).getByRole("img").getAttribute("aria-label")).toBe(
      "A drawing of the sweatsuit in lilac, cream and orange",
    );
  });

  it("rolls every reel on a pull", () => {
    render(<Harness />);
    pull();
    const next = last();
    expect(next.body).not.toBe(DEFAULT_COLORWAY.body);
    expect(next.panel).not.toBe(DEFAULT_COLORWAY.panel);
    expect(next.piping).not.toBe(DEFAULT_COLORWAY.piping);
    for (const hex of paletteOf(next)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("leaves a locked reel alone, and will not pull with all three locked", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Lock body" }));
    for (let i = 0; i < 5; i += 1) pull();
    expect(seen).toHaveLength(5);
    for (const colors of seen) expect(colors.body).toBe(DEFAULT_COLORWAY.body);
    fireEvent.click(screen.getByRole("button", { name: "Lock panels" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock piping" }));
    expect(screen.queryByRole("button", { name: "Pull" })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "All three are locked" })[0]?.hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Unlock body" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("steps one reel at a time, there and back", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Piping: colour after" }));
    const stepped = last();
    expect(stepped.piping).not.toBe(DEFAULT_COLORWAY.piping);
    expect(stepped.body).toBe(DEFAULT_COLORWAY.body);
    expect(stepped.panel).toBe(DEFAULT_COLORWAY.panel);
    fireEvent.click(screen.getByRole("button", { name: "Piping: colour before" }));
    expect(last()).toEqual(DEFAULT_COLORWAY);
  });

  it("takes an exact colour from the picker", async () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      fireEvent.change(screen.getByLabelText("Pick an exact body colour"), {
        target: { value: "#123456" },
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(last().body).toBe("#123456");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gets louder and quieter by the score", () => {
    render(<Harness />);
    const before = clashScore(paletteOf(DEFAULT_COLORWAY)).score;
    fireEvent.click(screen.getByRole("button", { name: "Louder" }));
    expect(clashScore(paletteOf(last())).score).toBeGreaterThan(before);
    fireEvent.click(screen.getByRole("button", { name: "Quieter" }));
    fireEvent.click(screen.getByRole("button", { name: "Quieter" }));
    expect(clashScore(paletteOf(last())).score).toBeLessThan(before);
  });

  it("loads the two house colourways", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    expect(last()).toEqual(PRESETS[1]?.colors);
    fireEvent.click(screen.getByRole("button", { name: "Lilac" }));
    expect(last()).toEqual(PRESETS[0]?.colors);
  });

  it("keeps a colourway on this device, loads it back and removes it", () => {
    render(<Harness />);
    expect(screen.getByText(/Nothing kept yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep this colourway" }));
    expect(JSON.parse(window.localStorage.getItem(KEPT_KEY) ?? "[]")).toEqual([
      encodeColorway(DEFAULT_COLORWAY),
    ]);
    expect(screen.getByRole("button", { name: "Kept" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Mint" }));
    fireEvent.click(screen.getByRole("button", { name: "Load lilac, cream and orange" }));
    expect(last()).toEqual(DEFAULT_COLORWAY);

    fireEvent.click(screen.getByRole("button", { name: "Remove lilac, cream and orange" }));
    expect(JSON.parse(window.localStorage.getItem(KEPT_KEY) ?? "[]")).toEqual([]);
    expect(screen.getByText(/Nothing kept yet/)).toBeTruthy();
  });

  it("reads the kept list back from storage, and shrugs off rubbish in it", () => {
    window.localStorage.setItem(KEPT_KEY, JSON.stringify(["a5dccb-f9c4a6-3d5fd0", "junk", 7]));
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Load mint, peach and royal blue" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the reels again beside the score, as decoration", () => {
    const { container } = render(<Harness />);
    const small = container.querySelectorAll(".cm-mini-window");
    expect(small).toHaveLength(3);
    expect(small[0]?.closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("copies a link built from the colours on screen", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<Harness start={PRESETS[1]?.colors} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText(/Link copied/)).toBeTruthy();
    const link = new URL(writeText.mock.calls[0]?.[0] ?? "");
    expect(link.searchParams.get("c")).toBe(encodeColorway(PRESETS[1]?.colors ?? DEFAULT_COLORWAY));
  });

  it("says so when the link cannot be copied", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("refused")) },
      configurable: true,
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText(/Copy the address/)).toBeTruthy();
  });

  it("carries a reel on from where it is when a second step lands mid-move", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.useFakeTimers();
    const { container } = render(<Harness />);
    const strip = () => container.querySelectorAll<HTMLElement>(".cm-window .cm-strip")[1];
    const offset = () => Number(/-?[\d.]+/.exec(strip()?.style.transform ?? "")?.[0]);
    const before = screen.getByRole("button", { name: "Panels: colour before" });

    // Cream is the first colour on the panel reel, so stepping back crosses the join in the strip.
    fireEvent.click(before);
    const first = offset();
    fireEvent.click(before);
    // One cell further, not a whole turn of the reel.
    expect(Math.abs(offset() - first)).toBe(44);
    expect(strip()?.style.transition).toContain("transform");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(strip()?.style.transition).toBe("none");
    expect(seen).toHaveLength(2);
  });

  it("says plainly that it is a toy", () => {
    render(<Harness />);
    expect(
      screen.getByText(/colour toy.*drawing.*being built.*nothing\s+here can be ordered yet/s),
    ).toBeTruthy();
  });
});
