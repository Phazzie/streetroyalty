import { useState } from "react";
import { cn } from "@/lib/cn";
import type { BlankSizes } from "@/lib/help/sizes";
import { FIT_NOTES, printfulSizeGuideUrl } from "@/lib/help/size-notes";
import type { SizeTable } from "@/lib/pod/size-guide";

type Unit = "in" | "cm";

/** Inches as Printful gives them, or the same numbers in centimetres. */
export function convert(value: string, unit: Unit): string {
  if (unit === "in") return value;
  return value.replace(/\d+(?:\.\d+)?/g, (number) => {
    const cm = Number(number) * 2.54;
    return String(Math.round(cm * 10) / 10);
  });
}

function Table({ table, unit, highlight }: { table: SizeTable; unit: Unit; highlight?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <caption className="pb-2 text-left text-sm text-subtle">
          {table.kind === "product"
            ? "The piece laid flat."
            : "Your body. Measure yourself and pick the size that fits these."}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-ink py-2 pr-3 font-display text-xs uppercase">
              {unit === "in" ? "Inches" : "cm"}
            </th>
            {table.sizes.map((size) => (
              <th
                key={size}
                scope="col"
                className={cn(
                  "border-b-2 border-ink px-2 py-2 text-center font-display text-sm",
                  size === highlight && "bg-accent text-accent-fg",
                )}
              >
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className="border-b border-line">
              <th scope="row" className="py-2.5 pr-3 text-sm font-semibold">
                {row.label}
              </th>
              {table.sizes.map((size) => (
                <td
                  key={size}
                  className={cn(
                    "px-2 py-2.5 text-center tabular-nums",
                    size === highlight && "bg-accent/25",
                  )}
                >
                  {row.values[size] ? convert(row.values[size], unit) : "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One blank's measurements, or a plain link to Printful's own guide when they can't be read. */
export function SizeChart({ blank, highlight }: { blank: BlankSizes; highlight?: string }) {
  const [unit, setUnit] = useState<Unit>("in");
  const note = FIT_NOTES[blank.printfulId];
  return (
    <div className="grid gap-5">
      {note ? (
        <p className="border-l-4 border-pipe pl-3 font-semibold">{note}</p>
      ) : null}
      {blank.guide ? (
        <>
          <div className="flex items-center gap-2" role="group" aria-label="Units">
            {(["in", "cm"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={unit === option}
                onClick={() => setUnit(option)}
                className={cn(
                  "min-h-11 min-w-14 border-2 border-ink px-3 font-display text-xs uppercase",
                  unit === option ? "bg-ink text-bg" : "bg-transparent text-fg",
                )}
              >
                {option === "in" ? "Inches" : "cm"}
              </button>
            ))}
          </div>
          {blank.guide.tables.map((table) => (
            <Table key={table.kind} table={table} unit={unit} highlight={highlight} />
          ))}
          <p className="text-sm text-subtle">
            Measurements from Printful, who make this piece.{" "}
            <a href={printfulSizeGuideUrl(blank.printfulId)} target="_blank" rel="noreferrer">
              See how to measure
            </a>
            .
          </p>
        </>
      ) : (
        <p>
          Printful's measurements didn't load just now.{" "}
          <a href={printfulSizeGuideUrl(blank.printfulId)} target="_blank" rel="noreferrer">
            Open the {blank.model} size guide on Printful
          </a>
          . Sizes: {blank.sizes.join(", ")}.
        </p>
      )}
    </div>
  );
}
