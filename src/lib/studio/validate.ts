import type { DesignLayer, Recipient } from "../pod/types.ts";

export const STUDIO_FONTS = ["Archivo Black", "Outfit"] as const;

export const MAX_LAYERS = 8;
const MAX_LAYER_SRC = 1_400_000;
const MAX_PRINT = 2_400_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parseLayers(input: unknown): DesignLayer[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error("Add at least one layer.");
  if (input.length > MAX_LAYERS) throw new Error("Eight layers is the limit.");
  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error("A layer is incomplete.");
    const layer = entry as Record<string, unknown>;
    const shared = {
      id: String(layer.id ?? `layer-${index}`).slice(0, 40),
      x: clamp(Number(layer.x), 0, 1),
      y: clamp(Number(layer.y), 0, 1),
      scale: clamp(Number(layer.scale), 0.15, 3),
      rotation: clamp(Number(layer.rotation), -180, 180),
    };
    if (layer.type === "image") {
      const src = String(layer.src ?? "");
      if (!isArtworkSrc(src)) throw new Error("Artwork has to be a PNG, JPEG, WebP, or GIF.");
      if (src.length > MAX_LAYER_SRC)
        throw new Error("That artwork is too heavy. Use a smaller file.");
      return { ...shared, type: "image" as const, src };
    }
    const font = STUDIO_FONTS.includes(layer.font as (typeof STUDIO_FONTS)[number])
      ? String(layer.font)
      : "Archivo Black";
    const color = /^#[0-9a-fA-F]{6}$/.test(String(layer.color ?? ""))
      ? String(layer.color)
      : "#d6ff3c";
    const text = String(layer.text ?? "")
      .trim()
      .slice(0, 80);
    if (!text) throw new Error("Text layers need words.");
    return { ...shared, type: "text" as const, text, font, color };
  });
}

export function parsePrintFile(input: unknown): { mime: string; base64: string } | null {
  if (input == null || input === "") return null;
  const value = String(input);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("The print file has to be a PNG or JPEG.");
  if (value.length > MAX_PRINT) throw new Error("The print file is too large.");
  return { mime: match[1] ?? "image/png", base64: match[2] ?? "" };
}

export function parseRecipient(input: unknown): Recipient {
  const raw = (input ?? {}) as Record<string, unknown>;
  const recipient: Recipient = {
    name: String(raw.name ?? "")
      .trim()
      .slice(0, 80),
    address1: String(raw.address1 ?? "")
      .trim()
      .slice(0, 120),
    address2:
      String(raw.address2 ?? "")
        .trim()
        .slice(0, 120) || undefined,
    city: String(raw.city ?? "")
      .trim()
      .slice(0, 80),
    stateCode:
      String(raw.stateCode ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 8) || undefined,
    countryCode: String(raw.countryCode ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 2),
    zip: String(raw.zip ?? "")
      .trim()
      .slice(0, 16),
    phone:
      String(raw.phone ?? "")
        .trim()
        .slice(0, 32) || undefined,
    email:
      String(raw.email ?? "")
        .trim()
        .slice(0, 120) || undefined,
  };
  if (recipient.name.length < 2) throw new Error("Add the recipient name.");
  if (recipient.address1.length < 3) throw new Error("Add a street address.");
  if (recipient.city.length < 2) throw new Error("Add a city.");
  if (!/^[A-Z]{2}$/.test(recipient.countryCode)) throw new Error("Use a two-letter country code.");
  if (recipient.zip.length < 3) throw new Error("Add a postal code.");
  if ((recipient.countryCode === "US" || recipient.countryCode === "CA") && !recipient.stateCode) {
    throw new Error("Add a state or province.");
  }
  if (recipient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
    throw new Error("That email does not look right.");
  }
  return recipient;
}

export function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "piece"}-${id.replace(/-/g, "").slice(0, 8)}`;
}

const ARTWORK_DATA = /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/;

export function isArtworkSrc(src: string): boolean {
  if (ARTWORK_DATA.test(src)) return true;
  if (!src.startsWith("https://") || src.includes(" ")) return false;
  return true;
}

/** Owner can buy their own draft. Everyone else only sees published pieces. */
export function canBuyDesign(
  design: { ownerId: string; status: string },
  buyerId: string,
): boolean {
  if (!buyerId || !design.ownerId) return false;
  if (design.ownerId === buyerId) return true;
  return design.status === "published";
}

export function parseMockupUrl(input: unknown): string | null {
  if (input == null || input === "") return null;
  const value = String(input);
  if (value.length > 2_000_000) throw new Error("That mockup is too large.");
  if (
    value.startsWith("data:image/svg+xml") ||
    ARTWORK_DATA.test(value) ||
    value.startsWith("data:image/jpeg")
  )
    return value;
  if (value.startsWith("https://")) return value;
  throw new Error("Mockup has to be an image.");
}

export function imageDimensions(
  mime: string,
  base64: string,
): { width: number; height: number } | null {
  let binary: string;
  try {
    binary = atob(base64.slice(0, 80_000));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (mime === "image/png") return pngSize(bytes);
  if (mime === "image/jpeg") return jpegSize(bytes);
  if (mime === "image/webp") return webpSize(bytes);
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    const length = (bytes[offset + 2] ?? 0) * 256 + (bytes[offset + 3] ?? 0);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const tag = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
  if (tag !== "VP8X") return null;
  const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
  const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
  return { width, height };
}

export function printQualityWarning(
  size: { width: number; height: number },
  area: { widthIn: number; heightIn: number; dpi?: number },
): string | null {
  const dpi = area.dpi && area.dpi > 0 ? area.dpi : 150;
  const needW = Math.round(area.widthIn * dpi);
  const needH = Math.round(area.heightIn * dpi);
  if (size.width >= needW * 0.75 && size.height >= needH * 0.75) return null;
  return `Print file is ${size.width}×${size.height}px. About ${needW}×${needH}px (${dpi} DPI) keeps the print sharp.`;
}

export function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
