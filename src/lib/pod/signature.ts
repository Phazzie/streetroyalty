import { createHmac, timingSafeEqual } from "node:crypto";

/** Compare two strings without leaking the matching prefix through timing. */
export function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Printful returns `secret_key` as hex and signs the raw body with the decoded
 * bytes. A non-hex secret (used in tests and sandbox) is taken as UTF-8.
 */
export function printfulSigningKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 16 && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "utf8");
}

/** HMAC-SHA256 of the raw request body, hex-encoded. Header: `x-pf-webhook-signature`. */
export function signPrintfulBody(rawBody: string, secret: string): string {
  return createHmac("sha256", printfulSigningKey(secret)).update(rawBody, "utf8").digest("hex");
}

export function verifyPrintfulSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = signPrintfulBody(rawBody, secret);
  return safeEqualText(expected.toLowerCase(), signature.trim().toLowerCase());
}
