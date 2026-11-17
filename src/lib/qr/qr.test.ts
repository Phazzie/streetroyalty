import { describe, expect, it } from "vitest";
import {
  alignmentCentres,
  alignmentPatterns,
  byteCapacity,
  encodeQr,
  KIND,
  MAX_VERSION,
  type QrMatrix,
} from "./encode.ts";
import { isCovered, markZone, MAX_MARK_SHARE } from "./mark.ts";
import { qrSvg, QUIET_ZONE, svgDataUrl } from "./svg.ts";
import { tagSvg, tagUrl } from "./index.ts";

const URL_SHORT = tagUrl("https://streetroyalty.example", "do-better-hoodie");

function at(matrix: QrMatrix, x: number, y: number): number {
  return matrix.modules[y * matrix.size + x]!;
}

/** The dark modules the square style draws, read back out of the path. */
function drawn(svg: string): Set<string> {
  const cells = new Set<string>();
  const path = /<path fill="[^"]+" shape-rendering="crispEdges" d="([^"]+)"/.exec(svg)?.[1] ?? "";
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, length] = [Number(match[1]), Number(match[2]), Number(match[3])];
    for (let step = 0; step < length; step += 1) cells.add(`${x + step},${y}`);
  }
  return cells;
}

describe("tagUrl", () => {
  it("points at the piece on the rack and says it came from a tag", () => {
    expect(tagUrl("https://sr.example", "crown-heavy-tee")).toBe(
      "https://sr.example/rack/crown-heavy-tee?via=tag",
    );
  });

  it("copes with a trailing slash and an odd slug", () => {
    expect(tagUrl("https://sr.example/", "a b/c")).toBe(
      "https://sr.example/rack/a%20b%2Fc?via=tag",
    );
  });
});

describe("encodeQr", () => {
  it("holds what level H is known to hold", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 40].map(byteCapacity)).toEqual([
      7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 382, 1273,
    ]);
  });

  it("picks the smallest version that fits", () => {
    expect(encodeQr("hi")).toMatchObject({ version: 1, size: 21 });
    expect(encodeQr("1234567")).toMatchObject({ version: 1, size: 21 });
    expect(encodeQr("12345678")).toMatchObject({ version: 2, size: 25 });
    expect(encodeQr("x".repeat(58))).toMatchObject({ version: 6, size: 41 });
    expect(encodeQr("x".repeat(59))).toMatchObject({ version: 7, size: 45 });
    expect(encodeQr("x".repeat(84))).toMatchObject({ version: 8, size: 49 });
  });

  it("counts bytes, not letters", () => {
    expect(encodeQr("ééé").version).toBe(1);
    expect(encodeQr("éééé").version).toBe(2);
  });

  it("gives the same matrix for the same link, every time", () => {
    const first = encodeQr(URL_SHORT);
    const second = encodeQr(URL_SHORT);
    expect(second.mask).toBe(first.mask);
    expect(Array.from(second.modules)).toEqual(Array.from(first.modules));
    expect(Array.from(encodeQr(`${URL_SHORT}x`).modules)).not.toEqual(Array.from(first.modules));
  });

  it("draws all three finder patterns with their light moat", () => {
    const eye = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
    for (const text of ["hi", URL_SHORT, "x".repeat(300)]) {
      const matrix = encodeQr(text);
      const last = matrix.size - 7;
      for (const [left, top] of [
        [0, 0],
        [last, 0],
        [0, last],
      ] as const) {
        for (let y = 0; y < 7; y += 1) {
          let row = "";
          for (let x = 0; x < 7; x += 1) row += at(matrix, left + x, top + y);
          expect(row).toBe(eye[y]);
        }
      }
      for (let index = 0; index < 8; index += 1) {
        expect(at(matrix, 7, index)).toBe(0);
        expect(at(matrix, index, 7)).toBe(0);
        expect(at(matrix, matrix.size - 8, index)).toBe(0);
        expect(at(matrix, index, matrix.size - 8)).toBe(0);
      }
    }
  });

  it("draws the timing lines and the one module that is always dark", () => {
    const matrix = encodeQr(URL_SHORT);
    for (let index = 8; index < matrix.size - 8; index += 1) {
      expect(at(matrix, index, 6)).toBe(index % 2 === 0 ? 1 : 0);
      expect(at(matrix, 6, index)).toBe(index % 2 === 0 ? 1 : 0);
    }
    expect(at(matrix, 8, matrix.size - 8)).toBe(1);
  });

  it("puts alignment eyes where the standard says", () => {
    expect(alignmentCentres(1)).toEqual([]);
    expect(alignmentCentres(2)).toEqual([6, 18]);
    expect(alignmentCentres(7)).toEqual([6, 22, 38]);
    expect(alignmentCentres(14)).toEqual([6, 26, 46, 66]);
    expect(alignmentCentres(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentCentres(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
    expect(alignmentPatterns(7)).toHaveLength(6);
  });

  it("takes a long link, and refuses one that cannot fit", () => {
    const long = tagUrl("https://streetroyalty.example", "long-slug-".repeat(60));
    const matrix = encodeQr(long);
    expect(matrix.size).toBe(matrix.version * 4 + 17);
    expect(matrix.version).toBeGreaterThan(20);
    expect(encodeQr("x".repeat(1273))).toMatchObject({ version: 40, size: 177 });
    expect(() => encodeQr("x".repeat(1274))).toThrow("too long");
  });
});

describe("the centre mark", () => {
  it("never hides a finder, timing, alignment or format module, in any version", () => {
    for (let version = 1; version <= MAX_VERSION; version += 1) {
      const matrix = encodeQr("crown", { minVersion: version });
      expect(matrix.version).toBe(version);
      const mark = markZone(matrix);
      if (!mark) continue;
      const { zone } = mark;
      let hidden = 0;
      for (let y = 0; y < matrix.size; y += 1) {
        for (let x = 0; x < matrix.size; x += 1) {
          const kind = matrix.kinds[y * matrix.size + x];
          const inside =
            x >= zone.x && y >= zone.y && x < zone.x + zone.width && y < zone.y + zone.height;
          if (isCovered(matrix, mark, x, y)) {
            hidden += 1;
            expect(kind).toBe(KIND.data);
            expect(inside).toBe(true);
          } else if (inside) {
            // Whatever is left showing inside the zone is the centre eye.
            expect(kind).toBe(KIND.alignment);
          }
        }
      }
      expect(hidden).toBe(mark.covered);
      expect(mark.share).toBeLessThanOrEqual(MAX_MARK_SHARE);
      // The crown is drawn inside the cleared block.
      expect(mark.crown.x).toBeGreaterThanOrEqual(zone.x);
      expect(mark.crown.y).toBeGreaterThanOrEqual(zone.y);
      expect(mark.crown.x + mark.crown.width).toBeLessThanOrEqual(zone.x + zone.width);
      expect(mark.crown.y + mark.crown.height).toBeLessThanOrEqual(zone.y + zone.height);
    }
  });

  it("sits in the middle, on the centre eye when there is one", () => {
    const plain = markZone(encodeQr("x".repeat(40)));
    expect(plain?.eye).toBeNull();
    expect(plain && plain.zone.x + plain.zone.width / 2).toBe(37 / 2);
    expect(plain && plain.zone.y + plain.zone.height / 2).toBe(37 / 2);

    const crowned = markZone(encodeQr("x".repeat(70)));
    expect(crowned?.eye).toEqual({ x: 24, y: 24 });
    expect(crowned && crowned.zone.x + crowned.zone.width / 2).toBe(49 / 2);
    // The crown stops short of the eye.
    expect(crowned && crowned.crown.y + crowned.crown.height).toBeLessThanOrEqual(22);
  });

  it("covers a real tag link by well under fifteen percent", () => {
    const mark = markZone(
      encodeQr(tagUrl("https://streetroyalty.example", "do-better-hoodie-1a2b")),
    );
    expect(mark).not.toBeNull();
    expect(mark!.share).toBeGreaterThan(0.04);
    expect(mark!.share).toBeLessThan(0.12);
  });
});

describe("qrSvg", () => {
  it("keeps a four module quiet zone on every side", () => {
    const matrix = encodeQr(URL_SHORT);
    const svg = qrSvg(matrix);
    const side = matrix.size + QUIET_ZONE * 2;
    expect(QUIET_ZONE).toBe(4);
    expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`);
    expect(svg).toContain(`<rect width="${side}" height="${side}" fill="#ffffff"/>`);
    for (const cell of drawn(svg)) {
      const [x, y] = cell.split(",").map(Number) as [number, number];
      expect(x).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(y).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(x).toBeLessThan(matrix.size + QUIET_ZONE);
      expect(y).toBeLessThan(matrix.size + QUIET_ZONE);
    }
  });

  it("draws every dark module except the ones under the crown", () => {
    const matrix = encodeQr(URL_SHORT);
    const mark = markZone(matrix);
    const cells = drawn(qrSvg(matrix));
    const bare = drawn(qrSvg(matrix, { mark: false }));
    let expected = 0;
    let all = 0;
    for (let y = 0; y < matrix.size; y += 1) {
      for (let x = 0; x < matrix.size; x += 1) {
        if (at(matrix, x, y) !== 1) continue;
        all += 1;
        const key = `${x + QUIET_ZONE},${y + QUIET_ZONE}`;
        expect(bare.has(key)).toBe(true);
        if (isCovered(matrix, mark, x, y)) {
          expect(cells.has(key)).toBe(false);
        } else {
          expected += 1;
          expect(cells.has(key)).toBe(true);
        }
      }
    }
    expect(cells.size).toBe(expected);
    expect(bare.size).toBe(all);
  });

  it("puts one crown in, and leaves it out when asked", () => {
    const matrix = encodeQr(URL_SHORT);
    expect(qrSvg(matrix).match(/data-mark="crown"/g)).toHaveLength(1);
    expect(qrSvg(matrix, { mark: false })).not.toContain("data-mark");
    expect(qrSvg(matrix, { markColor: "#ff2d95" })).toContain('fill="#ff2d95"');
  });

  it("is the same string for the same link, and scales without a fixed size", () => {
    expect(tagSvg(URL_SHORT)).toBe(tagSvg(URL_SHORT));
    expect(tagSvg(URL_SHORT)).not.toContain('width="256"');
    expect(tagSvg(URL_SHORT, { pixels: 256 })).toContain('width="256" height="256"');
  });

  it("stitches the data and keeps the eyes whole", () => {
    const matrix = encodeQr("x".repeat(70));
    const svg = qrSvg(matrix, { style: "stitched", dark: "#17101f", light: "#fffaf2" });
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('fill-rule="evenodd"');
    // Three finder pupils and one pupil for each of the six alignment eyes.
    expect(svg.match(/width="3" height="3"/g)).toHaveLength(3);
    expect(svg.match(/width="1" height="1"/g)).toHaveLength(6);
    expect(svg).not.toContain("crispEdges");
  });

  it("escapes the title and survives being a data URL", () => {
    const svg = tagSvg(URL_SHORT, { title: 'Scan "the" <fit> & go' });
    expect(svg).toContain('aria-label="Scan &quot;the&quot; &lt;fit&gt; &amp; go"');
    expect(svgDataUrl(svg).startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
  });
});
