import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MAX_LINE_QUANTITY, type BagLine } from "./types.ts";

/**
 * The shop bag lives in the browser. These run the real store against an
 * in-memory localStorage that starts empty for each test, with a fresh copy of
 * the module standing in for a new visit. A real browser's storage is covered
 * by the shop journey in e2e/shop.spec.ts.
 */

const HOODIE: BagLine = {
  variantId: "55555555-5555-4555-8555-555555555551",
  slug: "crown-hoodie",
  name: "Crown Hoodie",
  variantLabel: "Lilac, M",
  priceCents: 6450,
  imageUrl: "/shop/hoodie.jpg",
  quantity: 1,
};

async function visit() {
  vi.resetModules();
  const { useBag } = await import("./bag.ts");
  const hook = renderHook(() => useBag());
  act(() => hook.result.current.hydrate());
  return hook;
}

describe("the shop bag", () => {
  it("is still there on the next visit", async () => {
    const first = await visit();
    act(() => first.result.current.add(HOODIE));
    act(() => first.result.current.add(HOODIE));

    const second = await visit();

    expect(second.result.current.lines).toEqual([{ ...HOODIE, quantity: 2 }]);
  });

  it("opens when a piece is added", async () => {
    const bag = await visit();
    expect(bag.result.current.open).toBe(false);
    act(() => bag.result.current.add(HOODIE));
    expect(bag.result.current.open).toBe(true);
  });

  it("stops at the most one shopper can order of a piece", async () => {
    const bag = await visit();
    act(() => bag.result.current.add(HOODIE));
    act(() => bag.result.current.setQuantity(HOODIE.variantId, 999));
    expect(bag.result.current.lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("drops a line whose quantity is set to zero, and remembers that", async () => {
    const bag = await visit();
    act(() => bag.result.current.add(HOODIE));
    act(() => bag.result.current.setQuantity(HOODIE.variantId, 0));
    expect(bag.result.current.lines).toEqual([]);
    expect((await visit()).result.current.lines).toEqual([]);
  });

  it("remembers that the bag was sent to checkout, until something new is added", async () => {
    const bag = await visit();
    act(() => bag.result.current.add(HOODIE));
    act(() => bag.result.current.markSent());

    const back = await visit();
    expect(back.result.current.sent).toBe(true);

    act(() =>
      back.result.current.add({ ...HOODIE, variantId: "55555555-5555-4555-8555-555555555552" }),
    );
    expect(back.result.current.sent).toBe(false);
    expect((await visit()).result.current.sent).toBe(false);
  });

  it("does not say an empty bag was sent", async () => {
    localStorage.setItem("sr-bag-sent", "1");
    expect((await visit()).result.current.sent).toBe(false);
  });

  it.each([
    ["text that is not JSON", "{not json"],
    ["something that is not a list", '{"variantId":"x"}'],
    ["a line with a price of minus one", JSON.stringify([{ ...HOODIE, priceCents: -1 }])],
    ["a line with no variant", JSON.stringify([{ ...HOODIE, variantId: "" }])],
  ])("starts empty rather than breaking when storage holds %s", async (_what, stored) => {
    localStorage.setItem("sr-bag-v1", stored);
    expect((await visit()).result.current.lines).toEqual([]);
  });

  it("clamps a stored quantity someone edited by hand", async () => {
    localStorage.setItem("sr-bag-v1", JSON.stringify([{ ...HOODIE, quantity: 5000 }]));
    expect((await visit()).result.current.lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("keeps working when the browser refuses to store anything", async () => {
    const bag = await visit();
    // A stand-in for the whole store. Spying on the real one's methods does not hold in this
    // environment once the store has been used, so the outcome would depend on test order.
    const setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });
    vi.stubGlobal("localStorage", { setItem, getItem: () => null, removeItem: () => undefined });
    try {
      act(() => bag.result.current.add(HOODIE));
      act(() => bag.result.current.markSent());
      expect(setItem).toHaveBeenCalled();
      expect(bag.result.current.lines).toHaveLength(1);
      expect(bag.result.current.sent).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
    localStorage.setItem("probe", "1");
    expect(localStorage.getItem("probe")).toBe("1");
  });

  it("empties on clear, here and on the next visit", async () => {
    const bag = await visit();
    act(() => bag.result.current.add(HOODIE));
    act(() => bag.result.current.clear());
    expect(bag.result.current.lines).toEqual([]);
    expect((await visit()).result.current.lines).toEqual([]);
  });
});
