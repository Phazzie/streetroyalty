import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSizeGuideCache, fetchSizeGuide } from "./sizes.ts";

const BODY = {
  result: {
    available_sizes: ["S"],
    size_tables: [
      { type: "product_measure", measurements: [{ type_label: "Length", values: [{ size: "S", value: "27" }] }] },
    ],
  },
};

afterEach(() => clearSizeGuideCache());

describe("fetchSizeGuide", () => {
  it("asks Printful once a day for a product's sizes", async () => {
    const fetchImpl = vi.fn(async () => Response.json(BODY));
    const first = await fetchSizeGuide(586, fetchImpl as unknown as typeof fetch, 0);
    const second = await fetchSizeGuide(586, fetchImpl as unknown as typeof fetch, 1000);
    expect(first?.tables[0]?.rows[0]?.values.S).toBe("27");
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toContain("/products/586/sizes");
  });

  it("keeps yesterday's table when Printful is down", async () => {
    const ok = vi.fn(async () => Response.json(BODY));
    const kept = await fetchSizeGuide(380, ok as unknown as typeof fetch, 0);
    const down = vi.fn(async () => new Response("no", { status: 503 }));
    expect(await fetchSizeGuide(380, down as unknown as typeof fetch, 2 * 86_400_000)).toBe(kept);
    const thrown = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await fetchSizeGuide(380, thrown as unknown as typeof fetch, 3 * 86_400_000)).toBe(kept);
  });

  it("says nothing rather than guess", async () => {
    const empty = vi.fn(async () => Response.json({ result: {} }));
    expect(await fetchSizeGuide(411, empty as unknown as typeof fetch, 0)).toBeNull();
    const down = vi.fn(async () => new Response("no", { status: 500 }));
    expect(await fetchSizeGuide(412, down as unknown as typeof fetch, 0)).toBeNull();
  });
});
