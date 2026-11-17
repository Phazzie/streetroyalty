import { Link } from "@tanstack/react-router";
import { Crown } from "@/components/site/shell";
import type { ThroneRow } from "@/lib/social/battles";

const THRONE_CSS = `
.btl-crown {
  position: absolute;
  top: -1.35rem;
  left: -0.9rem;
  width: 4.5rem;
  height: auto;
  color: var(--color-amber);
  transform: rotate(-16deg);
  filter: drop-shadow(2px 0 0 #14081c) drop-shadow(-2px 0 0 #14081c) drop-shadow(0 2px 0 #14081c)
    drop-shadow(0 -2px 0 #14081c) drop-shadow(4px 4px 0 var(--color-pipe));
  animation: btl-crown-sit 900ms var(--ease-out-expo) both;
}
.btl-meter {
  height: 0.6rem;
  border: 2px solid var(--color-ink);
  background: var(--color-surface);
}
.btl-meter > span {
  display: block;
  height: 100%;
  background: var(--color-ink);
}
@keyframes btl-crown-sit {
  from { transform: translateY(-2.5rem) rotate(18deg); opacity: 0; }
  to { transform: rotate(-16deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .btl-crown { animation: none; }
}
`;

function record(row: ThroneRow): string {
  return `${row.wins} won, ${row.losses} lost`;
}

function Maker({ row }: { row: ThroneRow }) {
  return row.maker.handle ? (
    <Link
      to="/m/$handle"
      params={{ handle: row.maker.handle }}
      className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4"
    >
      by {row.maker.name}
    </Link>
  ) : (
    <span className="inline-flex min-h-11 items-center text-sm text-muted">
      by {row.maker.name}
    </span>
  );
}

function Shot({ row, className }: { row: ThroneRow; className: string }) {
  return row.mockupUrl ? (
    <img
      src={row.mockupUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${className} border-2 border-ink bg-[#120a1c] object-cover`}
    />
  ) : (
    <div className={`${className} border-2 border-ink bg-[#120a1c]`} />
  );
}

function Meter({ row }: { row: ThroneRow }) {
  const score = Math.round(row.score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="btl-meter min-w-0 flex-1" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right font-display text-xs uppercase">Score {score}</span>
    </div>
  );
}

/** The board under the arena. Number one wears the crown. */
export function Throne({ rows, error }: { rows: ThroneRow[] | null; error: string }) {
  const king = rows?.[0];
  const rest = rows?.slice(1) ?? [];
  return (
    <section className="paper mt-12 border-2 border-ink p-4 sm:p-8" aria-labelledby="throne-title">
      <style>{THRONE_CSS}</style>
      <p className="eyebrow text-muted">Top ten on the rack</p>
      <h2 id="throne-title" className="display mt-2 text-5xl sm:text-7xl">
        The throne
      </h2>
      <p className="mt-3 max-w-xl text-muted">
        Ranked by a careful win rate, not a raw count. A piece that won its only battle sits below
        one that won forty out of fifty. The score is the lowest win rate the record still backs up,
        out of 100.
      </p>

      {error ? (
        <p role="alert" className="mt-6 border-2 border-ink bg-surface p-4">
          {error}
        </p>
      ) : null}
      {rows === null && !error ? (
        <p className="mt-6 text-muted" aria-busy="true">
          Counting votes.
        </p>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="mt-6 border-2 border-dashed border-ink bg-surface p-5 font-display uppercase">
          Nobody holds the throne yet. The first votes decide it.
        </p>
      ) : null}

      {king ? (
        <article className="mt-10 grid gap-5 border-2 border-ink bg-surface p-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-end sm:p-5">
          <div className="relative w-40 sm:w-full">
            <Crown className="btl-crown" />
            <Shot row={king} className="aspect-[11/12] w-full" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow text-muted">Number one wears the crown</p>
            <h3 className="display mt-2 text-4xl break-words sm:text-6xl">
              <Link
                to="/rack/$slug"
                params={{ slug: king.slug }}
                className="underline decoration-[3px] underline-offset-[6px]"
              >
                {king.title}
              </Link>
            </h3>
            <Maker row={king} />
            <p className="mb-2 font-display text-sm uppercase">{record(king)}</p>
            <Meter row={king} />
          </div>
        </article>
      ) : null}

      {rest.length > 0 ? (
        <ol className="mt-4 grid gap-0 border-2 border-ink bg-surface" start={2}>
          {rest.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[2.75rem_3.25rem_minmax(0,1fr)] items-center gap-3 border-b-2 border-line p-3 last:border-b-0 sm:grid-cols-[3.5rem_4rem_minmax(0,1fr)_minmax(0,14rem)] sm:gap-4"
            >
              <span
                className="display text-4xl text-muted sm:text-5xl"
                aria-label={`Number ${row.rank}`}
              >
                {row.rank}
              </span>
              <Shot row={row} className="aspect-[11/12] w-full" />
              <div className="min-w-0">
                <Link
                  to="/rack/$slug"
                  params={{ slug: row.slug }}
                  className="flex min-h-11 items-center font-display uppercase underline decoration-2 underline-offset-4"
                >
                  <span className="clamp-2">{row.title}</span>
                </Link>
                <Maker row={row} />
              </div>
              <div className="col-span-3 min-w-0 sm:col-span-1">
                <p className="mb-1 font-display text-xs uppercase text-muted">{record(row)}</p>
                <Meter row={row} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
