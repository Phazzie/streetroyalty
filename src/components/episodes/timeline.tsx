import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { formatTimecode, sceneAt } from "@/lib/episodes/helpers";
import type { Episode } from "@/lib/episodes/types";

/** One cast member's wardrobe along the episode: a coloured block wherever they are on screen. */
export type WardrobeLane = {
  cast: string;
  segments: { id: string; startSec: number; endSec: number; colors: string[] }[];
};

/**
 * Equal bands, one per piece, top to bottom, with a dark hairline between them so
 * two pieces in the same colour still count as two. A change of outfit changes the bands.
 */
function bands(colors: string[]): string {
  if (colors.length === 0) return "transparent";
  const step = 100 / colors.length;
  const stops: string[] = [];
  colors.forEach((color, index) => {
    const start = `${index * step}%`;
    const end = `${(index + 1) * step}%`;
    if (index === colors.length - 1) {
      stops.push(`${color} ${start} ${end}`);
      return;
    }
    stops.push(`${color} ${start} calc(${end} - 2px)`, `#0b0614 calc(${end} - 2px) ${end}`);
  });
  return `linear-gradient(180deg, ${stops.join(", ")})`;
}

/**
 * The episode as a strip of scenes with a playhead. Drag anywhere on it, use the
 * arrow keys, or tap a scene below to jump. It drives a video when there is one
 * and the storyboard when there is not.
 */
export function Timeline({
  episode,
  time,
  onSeek,
  lanes,
  className,
}: {
  episode: Episode;
  time: number;
  onSeek: (seconds: number) => void;
  lanes?: WardrobeLane[];
  className?: string;
}) {
  const total = Math.max(1, episode.durationSec);
  const now = sceneAt(episode, time);
  const tick = total >= 120 ? (30 / total) * 100 : (10 / total) * 100;
  const chips = useRef<HTMLOListElement | null>(null);
  const nowId = now?.id;

  // On a phone the scene buttons scroll sideways. Keep the current one in view,
  // moving only that row and never the page.
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const offset = chip.getBoundingClientRect().left - row.getBoundingClientRect().left;
    row.scrollLeft += offset - 16;
  }, [nowId]);

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <p className="ep-tc text-2xl sm:text-3xl" aria-hidden="true">
          {formatTimecode(time, { fps: 24 })}
        </p>
        <p className="ep-tc text-sm text-subtle">
          <span className="sr-only">Running time </span>
          {formatTimecode(total)}
        </p>
      </div>

      <div className="ep-reel mt-2" style={{ "--ep-tick": `${tick}%` } as React.CSSProperties}>
        {episode.scenes.map((scene, index) => (
          <div
            key={scene.id}
            className="ep-reel-scene"
            data-now={now?.id === scene.id ? "true" : "false"}
            style={{
              left: `${(scene.startSec / total) * 100}%`,
              width: `${((scene.endSec - scene.startSec) / total) * 100}%`,
            }}
            aria-hidden="true"
          >
            <span className="font-display text-lg leading-none">{index + 1}</span>
          </div>
        ))}
        <div className="ep-reel-ticks" aria-hidden="true" />
        <div
          className="ep-reel-head"
          style={{ left: `${(Math.min(time, total) / total) * 100}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={Math.round(time)}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Move through the episode"
          aria-valuetext={`${formatTimecode(time)} of ${formatTimecode(total)}${now ? `, ${now.title}` : ""}`}
        />
      </div>

      {lanes && lanes.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5" aria-hidden="true">
          {lanes.map((lane) => (
            <div key={lane.cast}>
              <p className="eyebrow text-subtle" style={{ fontSize: "0.62rem" }}>
                {lane.cast}
              </p>
              <div className="relative mt-0.5 h-7 border-x-2 border-ink">
                {lane.segments.map((segment) => (
                  <span
                    key={segment.id}
                    className="absolute inset-y-0 border border-ink"
                    style={{
                      left: `${(segment.startSec / total) * 100}%`,
                      width: `${((segment.endSec - segment.startSec) / total) * 100}%`,
                      background: bands(segment.colors),
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            One band per piece. Where the bands change, the outfit changes.
          </p>
        </div>
      ) : null}

      <ol
        ref={chips}
        className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {episode.scenes.map((scene) => {
          const active = now?.id === scene.id;
          return (
            <li key={scene.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSeek(scene.startSec)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 border-2 border-ink px-3 text-left transition-colors duration-150",
                  active ? "bg-ink text-bg" : "bg-transparent text-fg hover:bg-fg/10",
                )}
              >
                <span className="font-display text-xs tracking-wider uppercase">{scene.title}</span>
                <span className="ep-tc text-xs opacity-80">{formatTimecode(scene.startSec)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
