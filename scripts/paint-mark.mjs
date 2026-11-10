import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const den = dot00 * dot11 - dot01 * dot01;
  if (den === 0) return false;
  const u = (dot11 * dot02 - dot01 * dot12) / den;
  const v = (dot00 * dot12 - dot01 * dot02) / den;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function png(size) {
  const bg = [0x0c, 0x0c, 0x0b];
  const fg = [0xf3, 0xf1, 0xec];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const s = size;
  const baseY = s * 0.68;
  const baseH = s * 0.07;
  const left = s * 0.28;
  const right = s * 0.72;
  const peaks = [
    [s * 0.3, baseY, s * 0.4, s * 0.36, s * 0.48, baseY],
    [s * 0.42, baseY, s * 0.5, s * 0.22, s * 0.58, baseY],
    [s * 0.52, baseY, s * 0.6, s * 0.36, s * 0.7, baseY],
  ];
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      let on = y >= baseY && y <= baseY + baseH && x >= left && x <= right;
      if (!on) {
        for (const tri of peaks) {
          if (pointInTri(x, y, tri[0], tri[1], tri[2], tri[3], tri[4], tri[5])) {
            on = true;
            break;
          }
        }
      }
      const color = on ? fg : bg;
      const i = row + 1 + x * 4;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/pwa", { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(`public/pwa/icon-${size}.png`, png(size));
}
