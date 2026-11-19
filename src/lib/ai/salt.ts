/**
 * Salt for hashes that must not be reversible across days. There is no default.
 * A missing secret fails closed instead of sharing one well-known salt.
 */
export function usageSalt(): string {
  const salt = process.env.BETTER_AUTH_SECRET?.trim();
  if (!salt) throw new Error("BETTER_AUTH_SECRET is required.");
  return salt;
}
