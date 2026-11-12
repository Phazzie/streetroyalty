/** Comma-separated sign-in emails allowed to reconfigure the shared Printful webhook. */
export function isStudioAdmin(
  email: string | null | undefined,
  allowList: string | undefined,
): boolean {
  const allow = (allowList ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!email || allow.length === 0) return false;
  return allow.includes(email.trim().toLowerCase());
}
