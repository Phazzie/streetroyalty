/**
 * Printful's size guide for a catalog product, read from the public v1 endpoint
 * `GET https://api.printful.com/products/{id}/sizes?unit=inches`. No environment
 * access here: the server function in src/lib/help/sizes.ts does the fetching.
 */

export type SizeRow = { label: string; values: Record<string, string> };

export type SizeTable = {
  /** "product" is the garment laid flat. "body" is how to measure yourself. */
  kind: "product" | "body";
  unit: string;
  sizes: string[];
  rows: SizeRow[];
};

export type SizeGuide = { sizes: string[]; tables: SizeTable[] };

const KIND: Record<string, SizeTable["kind"]> = {
  product_measure: "product",
  measure_yourself: "body",
};

function text(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 24);
}

function cell(entry: Record<string, unknown>): string {
  const single = text(entry.value);
  if (single) return single;
  const low = text(entry.min_value);
  const high = text(entry.max_value);
  if (low && high) return low === high ? low : `${low}–${high}`;
  return low || high;
}

/** Reads Printful's answer. Anything it can't read is dropped, never guessed. */
export function parseSizeGuide(payload: unknown): SizeGuide | null {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const result = (root.result && typeof root.result === "object" ? root.result : root) as Record<
    string,
    unknown
  >;
  const available = Array.isArray(result.available_sizes)
    ? result.available_sizes.map(text).filter(Boolean)
    : [];
  const tables: SizeTable[] = [];
  for (const raw of Array.isArray(result.size_tables) ? result.size_tables : []) {
    if (!raw || typeof raw !== "object") continue;
    const table = raw as Record<string, unknown>;
    const kind = KIND[String(table.type ?? "")];
    if (!kind) continue;
    const rows: SizeRow[] = [];
    const seen = new Set<string>();
    for (const rawRow of Array.isArray(table.measurements) ? table.measurements : []) {
      if (!rawRow || typeof rawRow !== "object") continue;
      const row = rawRow as Record<string, unknown>;
      const label = text(row.type_label);
      if (!label) continue;
      const values: Record<string, string> = {};
      for (const rawValue of Array.isArray(row.values) ? row.values : []) {
        if (!rawValue || typeof rawValue !== "object") continue;
        const entry = rawValue as Record<string, unknown>;
        const size = text(entry.size);
        const value = cell(entry);
        if (!size || !value) continue;
        values[size] = value;
        seen.add(size);
      }
      if (Object.keys(values).length > 0) rows.push({ label, values });
    }
    if (rows.length === 0) continue;
    const order = available.length > 0 ? available : [...seen];
    tables.push({
      kind,
      unit: text(table.unit) || "inches",
      sizes: order.filter((size) => seen.has(size)),
      rows,
    });
  }
  if (tables.length === 0) return null;
  tables.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "product" ? -1 : 1));
  return { sizes: available, tables };
}
