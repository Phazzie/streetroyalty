/**
 * A QR encoder, written out here so the tag needs no library.
 *
 * It only does what the crown tag needs: bytes in, error correction level H out.
 * Level H rebuilds about three in ten codewords, which is what lets a crown sit in
 * the middle of the code and still scan.
 */

/** What a module is for. Data can be covered by the centre mark; nothing else can. */
export const KIND = {
  data: 0,
  finder: 1,
  timing: 2,
  alignment: 3,
  format: 4,
} as const;

export type ModuleKind = (typeof KIND)[keyof typeof KIND];

export type QrMatrix = {
  /** 1 to 40. */
  version: number;
  /** Modules per side, 21 to 177. */
  size: number;
  /** The mask the encoder chose, 0 to 7. */
  mask: number;
  /** Row by row. 1 is dark. */
  modules: Uint8Array;
  /** Row by row, one of KIND. */
  kinds: Uint8Array;
};

/** Error correction codewords per block at level H, by version. */
const ECC_PER_BLOCK = [
  -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
];

/** Error correction blocks at level H, by version. */
const BLOCKS = [
  -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37,
  40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
];

/** Level H as the two format bits. */
const FORMAT_H = 2;

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** How many bytes of data a version holds at level H, before the header. */
export function dataCodewords(version: number): number {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version]! * BLOCKS[version]!;
}

/** How many bytes of text fit at level H, after the mode and length header. */
export function byteCapacity(version: number): number {
  const headerBits = 4 + (version < 10 ? 8 : 16);
  return Math.floor((dataCodewords(version) * 8 - headerBits) / 8);
}

/** The centres of the alignment patterns along one axis. */
export function alignmentCentres(version: number): number[] {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < count; position -= step) {
    result.splice(1, 0, position);
  }
  return result;
}

/** Every alignment pattern in the code, as centre points. The three by the finders do not exist. */
export function alignmentPatterns(version: number): { x: number; y: number }[] {
  const centres = alignmentCentres(version);
  const last = centres.length - 1;
  const result: { x: number; y: number }[] = [];
  centres.forEach((y, row) => {
    centres.forEach((x, column) => {
      const byFinder =
        (row === 0 && column === 0) ||
        (row === 0 && column === last) ||
        (row === last && column === 0);
      if (!byFinder) result.push({ x, y });
    });
  });
  return result;
}

// Arithmetic in the field the codes use: bytes, with x^8 + x^4 + x^3 + x^2 + 1.
function multiply(a: number, b: number): number {
  let result = 0;
  for (let bit = 7; bit >= 0; bit -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> bit) & 1) * a;
  }
  return result;
}

function divisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let step = 0; step < degree; step += 1) {
    for (let index = 0; index < degree; index += 1) {
      result[index] = multiply(result[index]!, root);
      if (index + 1 < degree) result[index] = result[index]! ^ result[index + 1]!;
    }
    root = multiply(root, 2);
  }
  return result;
}

function remainder(data: Uint8Array, generator: Uint8Array): Uint8Array {
  const result = new Uint8Array(generator.length);
  for (const byte of data) {
    const factor = byte ^ result[0]!;
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let index = 0; index < result.length; index += 1) {
      result[index] = result[index]! ^ multiply(generator[index]!, factor);
    }
  }
  return result;
}

/** Split the data into blocks, add error correction to each, and weave them together. */
function interleave(version: number, data: Uint8Array): Uint8Array {
  const blocks = BLOCKS[version]!;
  const eccLength = ECC_PER_BLOCK[version]!;
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortData = Math.floor(raw / blocks) - eccLength;
  const generator = divisor(eccLength);

  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let block = 0; block < blocks; block += 1) {
    const length = shortData + (block < shortBlocks ? 0 : 1);
    const slice = data.subarray(offset, offset + length);
    offset += length;
    dataBlocks.push(slice);
    eccBlocks.push(remainder(slice, generator));
  }

  const result = new Uint8Array(raw);
  let cursor = 0;
  for (let index = 0; index <= shortData; index += 1) {
    for (const block of dataBlocks) {
      if (index < block.length) {
        result[cursor] = block[index]!;
        cursor += 1;
      }
    }
  }
  for (let index = 0; index < eccLength; index += 1) {
    for (const block of eccBlocks) {
      result[cursor] = block[index]!;
      cursor += 1;
    }
  }
  return result;
}

function pickVersion(byteLength: number, minVersion: number): number {
  for (let version = Math.max(MIN_VERSION, minVersion); version <= MAX_VERSION; version += 1) {
    if (byteLength <= byteCapacity(version)) return version;
  }
  throw new Error("That link is too long for a tag.");
}

/** The text as data codewords: byte mode, a length, the bytes, then padding. */
function dataBytes(bytes: Uint8Array, version: number): Uint8Array {
  const capacity = dataCodewords(version);
  const result = new Uint8Array(capacity);
  let bitCount = 0;
  const push = (value: number, length: number) => {
    for (let bit = length - 1; bit >= 0; bit -= 1) {
      if ((value >>> bit) & 1)
        result[bitCount >>> 3] = result[bitCount >>> 3]! | (0x80 >>> (bitCount & 7));
      bitCount += 1;
    }
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity * 8 - bitCount));
  bitCount = Math.ceil(bitCount / 8) * 8;
  for (let pad = 0xec; bitCount < capacity * 8; pad ^= 0xec ^ 0x11) push(pad, 8);
  return result;
}

function maskAt(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** The standard's four penalties. A lower score is easier for a camera to read. */
function penalty(modules: Uint8Array, size: number): number {
  let score = 0;
  const at = (x: number, y: number) => modules[y * size + x]!;

  for (let axis = 0; axis < 2; axis += 1) {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      let history = 0;
      for (let b = 0; b < size; b += 1) {
        const value = axis === 0 ? at(b, a) : at(a, b);
        history = ((history << 1) | value) & 0x7ff;
        // Dark, light, dark dark dark, light, dark with four light on either side: it looks like a finder.
        if (b >= 10 && (history === 0b10111010000 || history === 0b00001011101)) score += 40;
        if (b === 0) continue;
        const before = axis === 0 ? at(b - 1, a) : at(a, b - 1);
        if (value === before) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = at(x, y);
      dark += value;
      if (x + 1 < size && y + 1 < size) {
        if (value === at(x + 1, y) && value === at(x, y + 1) && value === at(x + 1, y + 1))
          score += 3;
      }
    }
  }

  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/**
 * The module matrix for a piece of text at error correction level H.
 * The same text always gives the same matrix.
 */
export function encodeQr(text: string, options: { minVersion?: number } = {}): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length, options.minVersion ?? MIN_VERSION);
  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const kinds = new Uint8Array(size * size);

  const set = (x: number, y: number, dark: boolean, kind: ModuleKind) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y * size + x] = dark ? 1 : 0;
    kinds[y * size + x] = kind;
  };

  // Timing: the dotted lines that give a camera the grid.
  for (let index = 0; index < size; index += 1) {
    set(6, index, index % 2 === 0, KIND.timing);
    set(index, 6, index % 2 === 0, KIND.timing);
  }

  // Finders: the three big eyes, each with a light moat around it.
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, ring !== 2 && ring !== 4, KIND.finder);
      }
    }
  }

  // Alignment: the small eyes that keep a bent or tilted code readable.
  for (const { x: cx, y: cy } of alignmentPatterns(version)) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, KIND.alignment);
      }
    }
  }

  const drawFormat = (mask: number) => {
    const data = (FORMAT_H << 3) | mask;
    let rem = data;
    for (let step = 0; step < 10; step += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (index: number) => ((bits >>> index) & 1) === 1;

    for (let index = 0; index <= 5; index += 1) set(8, index, bit(index), KIND.format);
    set(8, 7, bit(6), KIND.format);
    set(8, 8, bit(7), KIND.format);
    set(7, 8, bit(8), KIND.format);
    for (let index = 9; index < 15; index += 1) set(14 - index, 8, bit(index), KIND.format);

    for (let index = 0; index < 8; index += 1) set(size - 1 - index, 8, bit(index), KIND.format);
    for (let index = 8; index < 15; index += 1) set(8, size - 15 + index, bit(index), KIND.format);
    set(8, size - 8, true, KIND.format);
  };
  drawFormat(0);

  if (version >= 7) {
    let rem = version;
    for (let step = 0; step < 12; step += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let index = 0; index < 18; index += 1) {
      const dark = ((bits >>> index) & 1) === 1;
      const a = size - 11 + (index % 3);
      const b = Math.floor(index / 3);
      set(a, b, dark, KIND.format);
      set(b, a, dark, KIND.format);
    }
  }

  // The data snakes up and down in two-module columns from the bottom right.
  const codewords = interleave(version, dataBytes(bytes, version));
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let side = 0; side < 2; side += 1) {
        const x = right - side;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (kinds[y * size + x] !== KIND.data) continue;
        if (bitIndex < codewords.length * 8) {
          const dark = ((codewords[bitIndex >>> 3]! >>> (7 - (bitIndex & 7))) & 1) === 1;
          modules[y * size + x] = dark ? 1 : 0;
          bitIndex += 1;
        }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (kinds[y * size + x] === KIND.data && maskAt(mask, x, y)) modules[y * size + x]! ^= 1;
      }
    }
  };

  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules, size);
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    applyMask(mask);
  }
  applyMask(best);
  drawFormat(best);

  return { version, size, mask: best, modules, kinds };
}
