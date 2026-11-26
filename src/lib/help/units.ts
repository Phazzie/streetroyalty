export type Unit = "in" | "cm";

/** Inches as Printful gives them, or the same numbers in centimetres. */
export function convert(value: string, unit: Unit): string {
  if (unit === "in") return value;
  return value.replace(/\d+(?:\.\d+)?/g, (number) => String(Math.round(Number(number) * 25.4) / 10));
}
