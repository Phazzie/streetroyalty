/** Only a path on this site, never another host ("//evil" or "/\\evil"). */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/studio";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/studio";
  return value;
}
