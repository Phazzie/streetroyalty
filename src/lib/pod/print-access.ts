import { createHmac } from "node:crypto";
import { safeEqualText } from "./signature.ts";
import type { PodMode } from "./types.ts";

/** Sandbox-only signing secret. Live mode refuses to mint print URLs without PRINT_FILE_SIGNING_SECRET. */
export const SANDBOX_PRINT_SECRET = "sandbox-print-file";

type SecretEnv = { PRINT_FILE_SIGNING_SECRET?: string };

export function printSigningSecret(env: SecretEnv, mode: PodMode): string {
  const configured = env.PRINT_FILE_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (mode === "sandbox") return SANDBOX_PRINT_SECRET;
  throw new Error("Set PRINT_FILE_SIGNING_SECRET so print files are not world-readable.");
}

export function printFileToken(fileId: string, secret: string): string {
  return createHmac("sha256", secret).update(fileId).digest("hex");
}

export function printFileAuthorized(fileId: string, token: string | null | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  return safeEqualText(printFileToken(fileId, secret), token.trim());
}

export function signedPrintFileUrl(origin: string, fileId: string, secret: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/print-files/${fileId}?token=${printFileToken(fileId, secret)}`;
}
