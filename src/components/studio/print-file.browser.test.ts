import { describe, expect, it, vi } from "vitest";
import { renderPrintFile } from "@/components/studio/print-file";
import { createSandboxProvider } from "@/lib/pod/sandbox.ts";
import type { DesignLayer, PrintArea } from "@/lib/pod/types.ts";
import { imageDimensions, parsePrintFile, printQualityWarning } from "@/lib/studio/validate.ts";

/**
 * The print file is the one thing a factory actually receives, and it is drawn
 * on a canvas, so these run in a real browser. They check what comes out of the
 * exporter with the same code the server uses to judge an upload.
 */

const WORD: DesignLayer = {
  id: "t",
  type: "text",
  text: "CROWN",
  font: "Archivo Black",
  color: "#ff2d95",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};

type Slot = { product: string; area: PrintArea };

async function everyPrintArea(): Promise<Slot[]> {
  const provider = createSandboxProvider();
  const { products } = await provider.listProducts();
  const slots: Slot[] = [];
  for (const listed of products) {
    const product = await provider.getProduct(listed.id);
    const seen = new Set<string>();
    for (const variant of product.variants) {
      for (const area of variant.printAreas) {
        if (seen.has(area.placement)) continue;
        seen.add(area.placement);
        slots.push({ product: product.name, area });
      }
    }
  }
  return slots;
}

function sizeOf(dataUrl: string): { width: number; height: number } {
  const file = parsePrintFile(dataUrl);
  const size = file && imageDimensions(file.mime, file.base64);
  if (!size) throw new Error("The export is not a readable image.");
  return size;
}

async function pixels(dataUrl: string): Promise<ImageData> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Where the ink is: the box around every pixel that is not transparent. */
function inkBox(data: ImageData) {
  let left = data.width;
  let right = -1;
  let top = data.height;
  let bottom = -1;
  for (let y = 0; y < data.height; y += 1) {
    for (let x = 0; x < data.width; x += 1) {
      if ((data.data[(y * data.width + x) * 4 + 3] ?? 0) < 32) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    cx: (left + right) / 2 / data.width,
    cy: (top + bottom) / 2 / data.height,
  };
}

function squareArt(color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  return canvas.toDataURL("image/png");
}

const slots = await everyPrintArea();
const TEE_FRONT: PrintArea = { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 };

describe("the print file the studio exports", () => {
  it("covers every product and placement in the catalog", () => {
    expect(slots.length).toBeGreaterThanOrEqual(8);
  });

  it.each(slots)("is sharp enough for the $product $area.placement", async ({ area }) => {
    const size = sizeOf(await renderPrintFile(area, [WORD]));
    expect(printQualityWarning(size, area)).toBeNull();
  });

  it.each(slots)("keeps the shape of the $product $area.placement", async ({ area }) => {
    const size = sizeOf(await renderPrintFile(area, [WORD]));
    expect(size.width / size.height).toBeCloseTo(area.widthIn / area.heightIn, 1);
  });

  it("is accepted by the server as an upload", async () => {
    const file = await renderPrintFile(TEE_FRONT, [WORD]);
    expect(parsePrintFile(file)?.mime).toBe("image/png");
  });

  it("is transparent wherever nothing was placed", async () => {
    const data = await pixels(await renderPrintFile(TEE_FRONT, [WORD]));
    const alphaAt = (x: number, y: number) => data.data[(y * data.width + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(data.width - 1, data.height - 1)).toBe(0);
    expect(inkBox(data)).not.toBeNull();
  });

  it("puts a layer where the designer put it", async () => {
    const art: DesignLayer = {
      id: "a",
      type: "image",
      src: squareArt("#00ff00"),
      x: 0.25,
      y: 0.75,
      scale: 0.5,
      rotation: 0,
    };
    const data = await pixels(await renderPrintFile(TEE_FRONT, [art]));
    const box = inkBox(data);
    expect(box?.cx).toBeCloseTo(0.25, 2);
    expect(box?.cy).toBeCloseTo(0.75, 2);
    // Artwork is drawn at 52% of the print width at scale 1.
    expect((box?.width ?? 0) / data.width).toBeCloseTo(0.26, 2);
    expect(box?.width).toBeCloseTo(box?.height ?? 0, -1);
  });

  it("scales a layer by the designer's scale", async () => {
    const at = async (scale: number) => {
      const art: DesignLayer = {
        id: "a",
        type: "image",
        src: squareArt("#00ff00"),
        x: 0.5,
        y: 0.5,
        scale,
        rotation: 0,
      };
      return inkBox(await pixels(await renderPrintFile(TEE_FRONT, [art])))?.width ?? 0;
    };
    expect((await at(1)) / (await at(0.5))).toBeCloseTo(2, 1);
  });

  it("turns a layer by the designer's rotation", async () => {
    const flat = inkBox(await pixels(await renderPrintFile(TEE_FRONT, [WORD])));
    const turned = inkBox(
      await pixels(await renderPrintFile(TEE_FRONT, [{ ...WORD, rotation: 90 }])),
    );
    expect(flat && flat.width > flat.height).toBe(true);
    expect(turned && turned.height > turned.width).toBe(true);
    expect(turned?.cx).toBeCloseTo(0.5, 1);
    expect(turned?.cy).toBeCloseTo(0.5, 1);
  });

  it("prints text in the color the designer chose", async () => {
    const data = await pixels(await renderPrintFile(TEE_FRONT, [WORD]));
    let pink = 0;
    let other = 0;
    const near = (value: number | undefined, want: number) => Math.abs((value ?? 0) - want) <= 2;
    for (let index = 0; index < data.data.length; index += 4) {
      // Edge pixels are blended with the transparent backdrop. Only solid ink has to match.
      if (data.data[index + 3] !== 255) continue;
      const isPink =
        near(data.data[index], 0xff) &&
        near(data.data[index + 1], 0x2d) &&
        near(data.data[index + 2], 0x95);
      if (isPink) pink += 1;
      else other += 1;
    }
    expect(pink).toBeGreaterThan(1000);
    expect(other).toBe(0);
  });

  it("asks for both studio fonts before it draws any text", async () => {
    const load = vi.spyOn(document.fonts, "load");
    await renderPrintFile(TEE_FRONT, [WORD]);
    const asked = load.mock.calls.map((call) => String(call[0]));
    expect(asked.some((font) => font.includes("Archivo Black"))).toBe(true);
    expect(asked.some((font) => font.includes("Outfit"))).toBe(true);
    load.mockRestore();
  });

  it("says so when a piece of artwork cannot be drawn, instead of printing without it", async () => {
    const broken: DesignLayer = {
      id: "a",
      type: "image",
      src: "data:image/png;base64,AAAA",
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
    };
    await expect(renderPrintFile(TEE_FRONT, [WORD, broken])).rejects.toThrow(/artwork/i);
  });
});
