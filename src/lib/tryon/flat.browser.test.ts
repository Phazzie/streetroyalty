import { describe, expect, it } from "vitest";
import { defaultGarment } from "@/lib/studio/garments.ts";
import { allOverSheet } from "@/lib/tryon/flat.ts";
import { mockupReference } from "@/lib/tryon/reference.ts";
import { MAX_IMAGE_CHARS, containBox } from "@/lib/tryon/words.ts";

/**
 * The picture maker reads the all-over reference as one JPEG drawn on a canvas, so this runs
 * in a real browser: the garment nested inside the sheet has to come out in its own colours.
 */

async function pixelsOf(jpeg: string): Promise<CanvasRenderingContext2D> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("reference did not open"));
    image.src = jpeg;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(image, 0, 0);
  return ctx;
}

function near(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string): boolean {
  const [r, g, b] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  const want = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return [r ?? 0, g ?? 0, b ?? 0].every(
    (value, index) => Math.abs(value - (want[index] ?? 0)) < 24,
  );
}

describe("the all-over reference in a browser", () => {
  it("draws the whole hoodie, front and back, in the lilac colourway", async () => {
    const reference = await mockupReference(allOverSheet(defaultGarment("aop-hoodie")));
    expect(reference?.startsWith("data:image/jpeg")).toBe(true);
    expect(reference?.length ?? Infinity).toBeLessThanOrEqual(MAX_IMAGE_CHARS);
    const ctx = await pixelsOf(reference ?? "");
    // The sheet is 448 wide and 992 tall: front at y 24, back at y 508, both 400 by 460.
    const box = containBox({ width: 448, height: 992 });
    const scale = box.width / 448;
    const at = (x: number, y: number) => [box.x + x * scale, box.y + y * scale] as const;
    const [fx, fy] = at(24 + 200, 24 + 230);
    const [bx, by] = at(24 + 200, 508 + 230);
    expect(near(ctx, fx, fy, "#c4a6e0")).toBe(true);
    expect(near(ctx, bx, by, "#c4a6e0")).toBe(true);
  });

  it("follows the colourway the maker picked", async () => {
    const mine = {
      id: "mine",
      name: "Mine",
      colors: { body: "#2f5bff", contrast: "#ffffff", trim: "#ff2d95", mark: "#141414" },
    };
    const garment = {
      ...defaultGarment("aop-hoodie"),
      colorways: [mine],
      activeColorwayId: "mine",
    };
    const reference = await mockupReference(allOverSheet(garment));
    const ctx = await pixelsOf(reference ?? "");
    const box = containBox({ width: 448, height: 992 });
    const scale = box.width / 448;
    expect(near(ctx, box.x + 224 * scale, box.y + 254 * scale, "#2f5bff")).toBe(true);
    expect(near(ctx, box.x + 224 * scale, box.y + 738 * scale, "#2f5bff")).toBe(true);
  });
});
