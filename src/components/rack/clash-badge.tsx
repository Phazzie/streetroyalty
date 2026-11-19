import { clashScore, normalizeHex } from "@/lib/clash";

/**
 * How hard a piece's colours fight, worn as a badge. It is a brag, never a grade: a quiet score is
 * as welcome as a riot. No lime here, because lime means "tap this" and a badge is not a button.
 *
 * `sm` fits on a rack card. `md` belongs on a piece page and adds the first reason.
 */
export function ClashBadge({ palette, size = "sm" }: { palette: string[]; size?: "sm" | "md" }) {
  const swatches = uniqueHexes(palette);
  if (swatches.length === 0) return null;
  const result = clashScore(swatches);
  const bars = Math.min(5, Math.floor(result.score / 20) + 1);
  const summary = `Clash score ${result.score} out of 100. ${result.label}.`;

  if (size === "md") {
    return (
      <div
        className="inline-flex max-w-full items-stretch border-2 border-ink bg-surface text-fg"
        role="img"
        aria-label={`${summary} ${sentence(result.reasons[0])}`}
      >
        <div className="flex flex-col justify-between gap-2 border-r-2 border-ink px-3 py-2">
          <span className="font-display text-[0.62rem] tracking-[0.16em] text-subtle uppercase">
            Clash
          </span>
          <span className="font-display text-3xl leading-none tabular-nums">{result.score}</span>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="display text-2xl">{result.label}</span>
            <Meter bars={bars} />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Swatches hexes={swatches} px={16} />
            {result.reasons[0] ? (
              <span className="truncate text-sm text-muted">{result.reasons[0]}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <span
      className="inline-flex h-7 max-w-full items-center gap-1.5 border-2 border-ink bg-surface pr-2 pl-1 text-fg"
      role="img"
      aria-label={summary}
      title={summary}
    >
      <Swatches hexes={swatches.slice(0, 5)} px={12} />
      <span className="truncate font-display text-[0.68rem] tracking-[0.06em] uppercase">
        {result.label}
      </span>
      <span className="font-display text-[0.68rem] text-subtle tabular-nums">{result.score}</span>
    </span>
  );
}

function sentence(reason: string | undefined): string {
  if (!reason) return "";
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
}

function uniqueHexes(palette: string[]): string[] {
  if (!Array.isArray(palette)) return [];
  const out: string[] = [];
  for (const entry of palette) {
    const hex = normalizeHex(entry);
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out.slice(0, 8);
}

function Swatches({ hexes, px }: { hexes: string[]; px: number }) {
  return (
    <span className="flex shrink-0" aria-hidden="true">
      {hexes.map((hex, index) => (
        <span
          key={hex}
          className="block border border-ink"
          style={{ width: px, height: px, background: hex, marginLeft: index === 0 ? 0 : -1 }}
        />
      ))}
    </span>
  );
}

/** Five bars, like the level lights on a tape deck. More bars is louder, not better. */
function Meter({ bars }: { bars: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={step <= bars ? "block w-[5px] bg-fg" : "block w-[5px] bg-line"}
          style={{ height: 6 + step * 3 }}
        />
      ))}
    </span>
  );
}
