/** True when auth middleware refused the call. The message is the stable contract. */
export function isUnauthorized(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { status?: unknown; name?: unknown; message?: unknown };
  return (
    error.status === 401 || error.name === "UnauthorizedError" || error.message === "Unauthorized"
  );
}
