import { describe, expect, it } from "vitest";
import { defaultGarment, getTemplate } from "../studio/garments.ts";
import { allOverSheet } from "./flat.ts";

const PRINT = "data:image/png;base64,iVBORw0KGgo=";

function decode(dataUrl: string): string {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  expect(dataUrl.startsWith(prefix)).toBe(true);
  return decodeURIComponent(dataUrl.slice(prefix.length));
}

function part(svg: string, name: string): string | null {
  const match = new RegExp(`data-part="${name}" href="([^"]+)"`).exec(svg);
  return match?.[1] ?? null;
}

describe("allOverSheet", () => {
  it("shows the whole garment, front above back, in the active colourway", () => {
    const garment = { ...defaultGarment("aop-hoodie"), activeColorwayId: "black-gold" };
    const svg = decode(allOverSheet(garment, PRINT));
    const front = part(svg, "front");
    const back = part(svg, "back");
    expect(front).not.toBeNull();
    expect(back).not.toBeNull();
    const frontSvg = decode(front ?? "");
    const backSvg = decode(back ?? "");
    // Black / gold: the body is black and the side panels gold, on both faces.
    for (const face of [frontSvg, backSvg]) {
      expect(face).toContain('fill="#141414"');
      expect(face).toContain('fill="#c6a15b"');
    }
    expect(frontSvg).toContain('data-panel="body_front"');
    expect(backSvg).toContain('data-panel="body_back"');
    expect(backSvg).not.toContain('data-panel="body_front"');
  });

  it("puts the chest print on the logo panel of the front, not as the whole picture", () => {
    const garment = defaultGarment("aop-hoodie");
    const svg = decode(allOverSheet(garment, PRINT));
    const mark = getTemplate("aop-hoodie")?.panels.find((item) => item.role === "mark")?.box;
    expect(mark).toBeDefined();
    expect(svg).toContain(
      `data-part="chest-print" href="${PRINT}" x="${24 + (mark?.x ?? 0)}" y="${24 + (mark?.y ?? 0)}" width="${mark?.w}" height="${mark?.h}"`,
    );
  });

  it("is taller than wide, so it fills the portrait reference frame", () => {
    for (const id of ["aop-hoodie", "aop-joggers", "aop-track-jacket"]) {
      const svg = decode(allOverSheet(defaultGarment(id)));
      const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
      expect(Number(box?.[2])).toBeGreaterThan(Number(box?.[1]));
    }
  });

  it("leaves out a chest print it cannot trust", () => {
    const garment = defaultGarment("aop-joggers");
    for (const bad of [
      null,
      "",
      "https://x.example/a.png",
      'data:image/png;base64,AA"/><script>',
    ]) {
      expect(decode(allOverSheet(garment, bad))).not.toContain("chest-print");
    }
  });

  it("refuses a garment the studio does not have", () => {
    expect(() => allOverSheet({ ...defaultGarment("aop-hoodie"), templateId: "nope" })).toThrow(
      "not in the studio",
    );
  });
});
