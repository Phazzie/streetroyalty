import { describe, expect, it } from "vitest";
import type { DesignLayer } from "../../pod/types.ts";
import {
  GARMENT_SHAPES,
  garmentFlatSvg,
  garmentLuminance,
  garmentMockupMarkup,
  garmentMockupSvg,
  resolveShape,
  resolveView,
} from "./index.ts";

const WORD: DesignLayer = {
  id: "t",
  type: "text",
  text: "CROWN",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};
const PICTURE: DesignLayer = {
  id: "i",
  type: "image",
  src: "data:image/png;base64,AAAA",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};
const PLACEMENTS = ["front", "back", "sleeve_left", "sleeve_right"];
const COLORS = ["#141414", "#efe6d6", "#ff2d95", "#2f5bff", "#d6ff3c"];
const PREFIX = "data:image/svg+xml;charset=utf-8,";

const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

/**
 * A strict reader for the XML this module writes: every tag closes in order, every
 * attribute is quoted and named once, and no bare `<` or `&` sits in text or a value.
 * It throws on the first thing a browser's XML parser would refuse.
 */
function parseXml(xml: string): { tags: string[]; ids: string[] } {
  const tags: string[] = [];
  const ids: string[] = [];
  const open: string[] = [];
  const entity = /&(?!(?:amp|lt|gt|quot|apos);)/;
  let at = 0;
  while (at < xml.length) {
    const next = xml.indexOf("<", at);
    const text = xml.slice(at, next === -1 ? xml.length : next);
    if (entity.test(text) || text.includes(">")) throw new Error(`bad text: ${text.slice(0, 40)}`);
    if (next === -1) break;
    const end = xml.indexOf(">", next);
    if (end === -1) throw new Error("tag never closes");
    const tag = xml.slice(next + 1, end);
    at = end + 1;
    if (tag.startsWith("/")) {
      const name = tag.slice(1);
      if (open.pop() !== name) throw new Error(`</${name}> closes the wrong tag`);
      continue;
    }
    const selfClosing = tag.endsWith("/");
    const match = /^([a-zA-Z][\w:-]*)((?:\s+[a-zA-Z][\w:-]*="[^"<]*")*)\s*\/?$/.exec(tag);
    if (!match) throw new Error(`bad tag: <${tag.slice(0, 80)}>`);
    const name = match[1] ?? "";
    const seen = new Set<string>();
    for (const attr of (match[2] ?? "").matchAll(/([a-zA-Z][\w:-]*)="([^"]*)"/g)) {
      const key = attr[1] ?? "";
      const value = attr[2] ?? "";
      if (seen.has(key)) throw new Error(`${key} twice on <${name}>`);
      seen.add(key);
      if (entity.test(value)) throw new Error(`bad value on ${key}`);
      if (key === "id") ids.push(value);
    }
    tags.push(name);
    if (!selfClosing) open.push(name);
  }
  if (open.length > 0) throw new Error(`<${open.join(", ")}> left open`);
  return { tags, ids };
}

describe("the reader these tests lean on", () => {
  it("refuses what a browser would refuse", () => {
    expect(() => parseXml("<a><b></a></b>")).toThrow();
    expect(() => parseXml('<a x="1" x="2"/>')).toThrow();
    expect(() => parseXml("<a>fish & chips</a>")).toThrow();
    expect(() => parseXml('<a x="<"/>')).toThrow();
    expect(() => parseXml("<a>")).toThrow();
    expect(parseXml('<a x="1"><b/>ok &amp; fine</a>').tags).toEqual(["a", "b"]);
  });
});

describe("garment mockups", () => {
  it("draws every shape, placement and colour as well-formed XML", () => {
    for (const shape of GARMENT_SHAPES) {
      for (const placement of PLACEMENTS) {
        for (const colorHex of COLORS) {
          const url = garmentMockupSvg({ shape, colorHex, placement, layers: [WORD, PICTURE] });
          expect(url.startsWith(PREFIX)).toBe(true);
          const svg = decode(url);
          const { tags, ids } = parseXml(svg);
          expect(tags[0]).toBe("svg");
          expect(new Set(ids).size).toBe(ids.length);
          expect(svg).toContain(">CROWN</text>");
          expect(svg).toContain('href="data:image/png;base64,AAAA"');
          expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });

  it("is an svg an <img> can show: no script, no outside link, nothing to fetch", () => {
    for (const shape of GARMENT_SHAPES) {
      const svg = garmentMockupMarkup({
        shape,
        colorHex: "#2f5bff",
        placement: "front",
        layers: [WORD],
      });
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).not.toMatch(/<script|<foreignObject|<style|@import|javascript:/i);
      expect(svg.match(/https?:\/\/[^"\s]+/g)).toEqual(["http://www.w3.org/2000/svg"]);
      for (const ref of svg.matchAll(/url\(([^)]*)\)/g)) expect(ref[1]).toMatch(/^#[a-z]$/);
    }
  });

  it("has no dashed print box", () => {
    for (const shape of GARMENT_SHAPES) {
      for (const placement of PLACEMENTS) {
        const svg = garmentMockupMarkup({ shape, colorHex: "#efe6d6", placement, layers: [WORD] });
        // The only rectangles are the table and the clip. Neither has a stroke.
        for (const rect of svg.match(/<rect [^>]*>/g) ?? []) expect(rect).not.toContain("stroke");
      }
    }
  });

  it("stays small before any picture goes in", () => {
    for (const shape of GARMENT_SHAPES) {
      for (const placement of PLACEMENTS) {
        const url = garmentMockupSvg({
          shape,
          colorHex: "#141414",
          placement,
          layers: Array.from({ length: 12 }, () => WORD),
        });
        expect(url.length).toBeLessThan(60_000);
      }
      expect(garmentFlatSvg(shape, "#141414").length).toBeLessThan(40_000);
    }
  });

  it("gives the same picture for the same input", () => {
    for (const shape of GARMENT_SHAPES) {
      const input = { shape, colorHex: "#ff2d95", placement: "back", layers: [WORD, PICTURE] };
      expect(garmentMockupSvg(input)).toBe(garmentMockupSvg(structuredClone(input)));
      expect(garmentFlatSvg(shape, "#ff2d95")).toBe(garmentFlatSvg(shape, "#ff2d95"));
    }
  });

  it("draws a different picture for each shape and each view", () => {
    const seen = new Set<string>();
    for (const shape of GARMENT_SHAPES) {
      for (const placement of ["front", "back"]) {
        seen.add(garmentMockupSvg({ shape, colorHex: "#141414", placement, layers: [] }));
      }
    }
    expect(seen.size).toBe(GARMENT_SHAPES.length * 2);
    const tee = (placement: string) =>
      garmentMockupSvg({ shape: "tee", colorHex: "#141414", placement, layers: [] });
    expect(tee("sleeve_left")).not.toBe(tee("sleeve_right"));
    expect(tee("sleeve_left")).not.toBe(tee("front"));
  });

  it("shades a dark garment with light and a pale one with shadow", () => {
    expect(garmentLuminance("#141414")).toBeLessThan(0.2);
    expect(garmentLuminance("#efe6d6")).toBeGreaterThan(0.6);
    const read = (colorHex: string) => {
      const svg = garmentMockupMarkup({ shape: "tee", colorHex, placement: "front", layers: [] });
      const stitch = /stroke="(#[0-9a-f]{6})" stroke-width=".9"/.exec(svg)?.[1] ?? "";
      const grain = /filter="url\(#n\)" opacity="([\d.]+)"/.exec(svg)?.[1] ?? "";
      return { svg, stitch: garmentLuminance(stitch), grain: Number(grain) };
    };
    const black = read("#141414");
    const bone = read("#efe6d6");
    // Stitches have to show: lighter than black cloth, darker than bone cloth.
    expect(black.stitch).toBeGreaterThan(garmentLuminance("#141414"));
    expect(bone.stitch).toBeLessThan(garmentLuminance("#efe6d6"));
    expect(black.grain).toBeLessThan(bone.grain);
    expect(black.svg).toContain('fill="#141414"');
    expect(bone.svg).toContain('fill="#efe6d6"');
    for (const colorHex of COLORS) expect(() => parseXml(read(colorHex).svg)).not.toThrow();
  });

  it("falls back to the tee for a shape it does not know", () => {
    const tee = garmentMockupSvg({
      shape: "tee",
      colorHex: "#141414",
      placement: "front",
      layers: [WORD],
    });
    for (const shape of ["poncho", "", "<svg>", "TEE", "T-Shirt"]) {
      expect(
        garmentMockupSvg({ shape, colorHex: "#141414", placement: "front", layers: [WORD] }),
      ).toBe(tee);
    }
    expect(garmentFlatSvg("kilt", "#141414")).toBe(garmentFlatSvg("tee", "#141414"));
    // @ts-expect-error a caller with loose data can still pass nothing at all
    expect(() => parseXml(decode(garmentMockupSvg({})))).not.toThrow();
  });

  it("reads catalog type names as shapes", () => {
    expect(resolveShape("Hoodie")).toBe("hoodie");
    expect(resolveShape("Sweatshirt")).toBe("crew");
    expect(resolveShape("Hat")).toBe("hat");
    expect(resolveShape("Long Sleeve Tee")).toBe("longsleeve");
    expect(resolveShape("Track Jacket")).toBe("trackjacket");
    expect(resolveShape("Joggers")).toBe("jogger");
    expect(resolveShape("Tote Bag")).toBe("tote");
  });

  it("picks a view for every placement, and the front when it has no better answer", () => {
    expect(resolveView("tee", "back")).toBe("back");
    expect(resolveView("tee", "sleeve_left")).toBe("sleeve_left");
    expect(resolveView("tee", "sleeve_right")).toBe("sleeve_right");
    expect(resolveView("hat", "sleeve_left")).toBe("front");
    expect(resolveView("tote", "sleeve_right")).toBe("front");
    expect(resolveView("tee", "inside_label")).toBe("front");
    const svg = garmentMockupMarkup({
      shape: "tee",
      colorHex: "#141414",
      placement: "sleeve_left",
      layers: [],
    });
    expect(svg).toContain("PREVIEW / LEFT SLEEVE");
  });

  it("says it is a preview", () => {
    expect(
      garmentMockupMarkup({ shape: "hat", colorHex: "#141414", placement: "front", layers: [] }),
    ).toContain("PREVIEW / FRONT");
    expect(decode(garmentFlatSvg("tote", "#efe6d6"))).toContain("PREVIEW / FRONT");
  });
});

describe("what somebody typed never becomes markup", () => {
  const hostile = garmentMockupMarkup({
    shape: '"><script>alert(1)</script>',
    colorHex: '"/><script>alert(1)</script>',
    placement: '"><script>alert(2)</script>',
    layers: [
      { ...WORD, text: `<b>&"'</b><script>alert(3)</script>`, color: '"onload="alert(1)' },
      { ...WORD, text: "ok", color: "red;} </style><script>", font: `"><script>alert(4)</script>` },
      { ...WORD, text: "]]><!--", color: "url(https://evil.test/x)" },
    ],
  });

  it("escapes text and drops colours and fonts it cannot vouch for", () => {
    expect(() => parseXml(hostile)).not.toThrow();
    expect(hostile).not.toMatch(/<script|onload=|evil\.test|<\/style/);
    expect(hostile).toContain("&lt;b&gt;&amp;&quot;&apos;&lt;/b&gt;&lt;script&gt;");
    expect(hostile).toContain("]]&gt;&lt;!--");
    // A bad garment colour falls back to black, and a bad ink to the trim colour.
    expect(hostile).toContain('fill="#141414"');
    expect(parseXml(hostile).tags.filter((tag) => tag === "text")).toHaveLength(4);
  });

  it("keeps good colours as they were given", () => {
    const svg = garmentMockupMarkup({
      shape: "tee",
      colorHex: "EFE6D6",
      placement: "front",
      layers: [
        { ...WORD, color: "#D6FF3C" },
        { ...WORD, color: "#abc" },
        { ...WORD, color: "rebeccapurple" },
        { ...WORD, color: "rgb(255, 45, 149)" },
      ],
    });
    expect(svg).toContain('fill="#efe6d6"');
    for (const color of ["#d6ff3c", "#abc", "rebeccapurple", "rgb(255, 45, 149)"]) {
      expect(svg).toContain(`<text x="240" y="288" fill="${color}"`);
    }
  });

  it("drops characters XML cannot hold and cuts a long line without splitting a letter", () => {
    const svg = garmentMockupMarkup({
      shape: "tee",
      colorHex: "#141414",
      placement: "front",
      layers: [
        { ...WORD, text: "A\u0000B\u0008C￾D\uD800E\tF" },
        { ...WORD, text: "&".repeat(500) },
        { ...WORD, text: "\u{1F451}".repeat(500) },
        { ...WORD, text: "   " },
      ],
    });
    expect(() => parseXml(svg)).not.toThrow();
    expect(svg).toContain(">ABCDE F</text>");
    expect(svg).toContain(`>${"&amp;".repeat(120)}</text>`);
    expect(svg).toContain(`>${"\u{1F451}".repeat(120)}</text>`);
    // The caption, and three layers. The blank one is not drawn.
    expect(svg.match(/<text /g)).toHaveLength(4);
    expect(() =>
      garmentMockupSvg({
        shape: "tee",
        colorHex: "#141414",
        placement: "front",
        layers: [{ ...WORD, text: "lone \uDC00 half" }],
      }),
    ).not.toThrow();
  });

  it("only lets a picture in from inside the file", () => {
    const at = (src: string): DesignLayer => ({ ...PICTURE, src });
    const svg = garmentMockupMarkup({
      shape: "hoodie",
      colorHex: "#141414",
      placement: "back",
      layers: [
        at("data:image/png;base64,AAAA"),
        at("data:image/jpeg;base64,/9j/4AAQ=="),
        at("data:image/webp;base64,UklGRg=="),
        at("javascript:alert(1)"),
        at("https://cdn.test/a.png"),
        at("http://cdn.test/a.png"),
        at("//cdn.test/a.png"),
        at("data:image/svg+xml;base64,PHN2Zz4="),
        at("data:text/html;base64,PHNjcmlwdD4="),
        at('data:image/png;base64,AAAA" onload="alert(1)'),
        at("data:image/png;base64,AAAA\n<script>"),
        at("data:image/png,<svg onload=alert(1)>"),
        at(""),
      ],
    });
    expect(() => parseXml(svg)).not.toThrow();
    expect(svg.match(/<image /g)).toHaveLength(3);
    expect(svg).not.toMatch(/javascript:|cdn\.test|onload|svg\+xml;base64|text\/html/);
  });

  it("survives numbers that are not numbers", () => {
    const wild = { x: Number.NaN, y: Number.POSITIVE_INFINITY, scale: -4, rotation: Number.NaN };
    const svg = garmentMockupMarkup({
      shape: "crew",
      colorHex: "#141414",
      placement: "front",
      layers: [
        { ...WORD, ...wild },
        { ...PICTURE, ...wild },
        // @ts-expect-error stored rows are not always the shape the type promises
        { ...WORD, x: "0.5", y: null, scale: "big", rotation: {} },
        // @ts-expect-error a layer type from some later version
        { id: "v", type: "video", src: "x" },
      ],
    });
    expect(() => parseXml(svg)).not.toThrow();
    expect(svg).not.toMatch(/NaN|Infinity|undefined|null/);
  });
});

describe("the art sits where it prints", () => {
  const window = (shape: string, placement: string) => {
    const svg = garmentMockupMarkup({ shape, colorHex: "#141414", placement, layers: [] });
    const clip =
      /<clipPath id="p"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(
        svg,
      );
    return {
      x: Number(clip?.[1]),
      y: Number(clip?.[2]),
      w: Number(clip?.[3]),
      h: Number(clip?.[4]),
    };
  };

  it("keeps the print area's own proportions", () => {
    // Inches from the sandbox blanks: tee 12x16, hoodie 12x12, crew 12x14, hat 4x2, sleeve 3.5x3.5.
    const ratio = (shape: string, placement: string) => {
      const area = window(shape, placement);
      return area.w / area.h;
    };
    expect(ratio("tee", "front")).toBeCloseTo(12 / 16, 2);
    expect(ratio("tee", "back")).toBeCloseTo(12 / 16, 2);
    expect(ratio("hoodie", "front")).toBeCloseTo(1, 2);
    expect(ratio("hoodie", "back")).toBeCloseTo(12 / 16, 2);
    expect(ratio("crew", "front")).toBeCloseTo(12 / 14, 2);
    expect(ratio("hat", "front")).toBeCloseTo(2, 2);
    expect(ratio("tee", "sleeve_left")).toBeCloseTo(1, 2);
  });

  it("rides high on the chest, centred, and the hoodie print stays above the pocket", () => {
    for (const shape of ["tee", "crew", "longsleeve", "hoodie"]) {
      const area = window(shape, "front");
      expect(area.x + area.w / 2).toBeCloseTo(240, 5);
      // The chest is the upper half of the body: the middle of the print is above the middle of the table.
      expect(area.y + area.h / 2).toBeLessThan(300);
    }
    const hoodie = window("hoodie", "front");
    expect(hoodie.y + hoodie.h).toBeLessThan(338);
  });

  it("puts a layer at the same share of the area the print file does", () => {
    const area = window("tee", "front");
    const svg = garmentMockupMarkup({
      shape: "tee",
      colorHex: "#141414",
      placement: "front",
      layers: [
        { ...WORD, x: 0.25, y: 0.75, scale: 2, rotation: 15 },
        { ...PICTURE, x: 0.5, y: 0.5, scale: 1 },
      ],
    });
    const text =
      /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*textLength="([\d.]+)"[^>]*transform="rotate\(15 /.exec(
        svg,
      );
    expect(Number(text?.[1])).toBeCloseTo(area.x + area.w * 0.25, 1);
    expect(Number(text?.[2])).toBeCloseTo(area.y + area.h * 0.75, 1);
    // 14% of the area's height at scale 1, like the file.
    expect(Number(text?.[3])).toBeCloseTo(area.h * 0.14 * 2, 1);
    // Never wider than 92% of the area, like the file.
    expect(Number(text?.[4])).toBeLessThanOrEqual(area.w * 0.92 + 0.05);
    const image = /<image [^>]*width="([\d.]+)"/.exec(svg);
    expect(Number(image?.[1])).toBeCloseTo(area.w * 0.52, 1);
  });

  it("clips the art to the print area and to the garment", () => {
    const svg = garmentMockupMarkup({
      shape: "tee",
      colorHex: "#141414",
      placement: "front",
      layers: [WORD],
    });
    const art = svg.indexOf(">CROWN</text>");
    expect(svg.lastIndexOf('clip-path="url(#p)"', art)).toBeGreaterThan(-1);
    expect(svg.lastIndexOf('<g clip-path="url(#s)">', art)).toBeGreaterThan(-1);
    // Nothing is printed when there is no art.
    expect(
      garmentMockupMarkup({ shape: "tee", colorHex: "#141414", placement: "front", layers: [] }),
    ).not.toContain('clip-path="url(#p)"');
  });
});
