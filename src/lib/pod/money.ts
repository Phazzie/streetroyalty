/** Currency helpers. No environment access, safe on the client. */

export function moneyToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function clampMarkup(markup: number): number {
  if (!Number.isFinite(markup)) return 2.2;
  return Math.min(5, Math.max(1, markup));
}

export function applyMarkup(wholesaleCents: number, markup: number): number {
  const factor = clampMarkup(markup);
  return Math.max(0, Math.round(wholesaleCents * factor));
}

export function formatMoney(cents: number, currency = "USD"): string {
  const value = Number.isFinite(cents) ? cents : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
  } catch {
    return `$${(value / 100).toFixed(2)}`;
  }
}
