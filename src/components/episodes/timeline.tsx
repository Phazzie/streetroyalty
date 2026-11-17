import { cn } from "@/lib/cn";
import { formatTimecode, sceneAt } from "@/lib/episodes/helpers";
import type { Episode } from "@/lib/episodes/types";

/**
 * The episode as a strip of scenes with a playhead. Drag anywhere on it, use the
 * arrow keys, or tap a scene below to jump. It drives a video when there is one
 * and the storyboard when there is not.
 */
export function Timeline({
  episode,
  time,
  onSeek,
  className,
}: {
  episode: Episode;
  time: number;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const total = Math.max(1, episode.durationSec);
  const now = sceneAt(episode, time);
  const tick = total >= 120 ? (30 / total) * 100 : (10 / total) * 100;

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

      <ol className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
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
