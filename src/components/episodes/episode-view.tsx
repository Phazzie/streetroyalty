import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { OnAirLamp, Slate, StatusLine, TestCard } from "@/components/episodes/channel";
import { OnScreenNow, PieceRow, type Look } from "@/components/episodes/on-screen";
import { Timeline } from "@/components/episodes/timeline";
import { cn } from "@/lib/cn";
import {
  clampTime,
  episodePieces,
  firstSeen,
  formatRunningTime,
  formatTimecode,
  sceneAt,
  STATUS_LABEL,
} from "@/lib/episodes/helpers";
import { isMissing, resolveRefs } from "@/lib/episodes/sheet";
import { refKey, type Episode } from "@/lib/episodes/types";
import type { StoreProduct } from "@/lib/storefront/types";
import { shopList } from "@/lib/studio/api";
import type { DesignSummary } from "@/lib/studio/models";

const SPEEDS = [1, 8] as const;

export function EpisodeView({
  episode,
  products,
  lampOn,
}: {
  episode: Episode;
  products: StoreProduct[];
  lampOn: boolean;
}) {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(8);
  const [rack, setRack] = useState<DesignSummary[]>([]);
  const video = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(episode.videoUrl);
  const allRefs = useMemo(() => episodePieces(episode), [episode]);
  const needsRack = allRefs.some((ref) => ref.kind === "rack");

  useEffect(() => {
    if (!needsRack) return;
    let live = true;
    void shopList()
      .then((list) => {
        if (live) setRack(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needsRack]);

  // The storyboard has no film to play, so "run" walks the playhead along the plan.
  useEffect(() => {
    if (hasVideo || !running) return;
    let frame = 0;
    let last = performance.now();
    const step = (stamp: number) => {
      const delta = (stamp - last) / 1000;
      last = stamp;
      setTime((current) => {
        const next = current + delta * speed;
        if (next >= episode.durationSec) {
          setRunning(false);
          return episode.durationSec;
        }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [hasVideo, running, speed, episode.durationSec]);

  const seek = (seconds: number) => {
    const next = clampTime(episode, seconds);
    setTime(next);
    if (video.current) video.current.currentTime = next;
  };

  const scene = sceneAt(episode, time);
  const sceneIndex = scene ? episode.scenes.indexOf(scene) : -1;
  const have = useMemo(() => ({ products, rack }), [products, rack]);

  const looks: Look[] = useMemo(
    () =>
      (scene?.wardrobe ?? []).map((look) => ({
        cast: look.cast,
        role: episode.cast.find((member) => member.name === look.cast)?.role ?? "",
        pieces: resolveRefs(look.pieces, have),
      })),
    [scene, episode.cast, have],
  );
  const cutKey = (scene?.wardrobe ?? [])
    .map((look) => `${look.cast}=${look.pieces.map(refKey).join("+")}`)
    .join("|");

  const worn = useMemo(() => resolveRefs(allRefs, have), [allRefs, have]);
  const planned = episode.status !== "out";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-20 sm:px-6 lg:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/episodes"
          className="inline-flex min-h-11 items-center gap-2 font-display text-xs tracking-wider uppercase"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          <span className="border-b-2 border-fg pb-0.5">All episodes</span>
        </Link>
        <OnAirLamp on={lampOn} />
      </div>

      <header className="mt-4">
        <p className="eyebrow text-subtle">
          {episode.template ? "Template" : "Episode"} {String(episode.number).padStart(2, "0")}
        </p>
        <h1 className="display mt-2 text-6xl sm:text-7xl lg:text-8xl">{episode.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{episode.logline}</p>
        <StatusLine status={episode.status} className="mt-4" />
      </header>

      {episode.template ? (
        <p role="note" className="mt-6 max-w-2xl border-2 border-ink bg-surface px-4 py-3 text-sm">
          This is a template, not an episode. Nothing here has been filmed, the two characters are
          stand-ins, and the scenes are blanks to fill in. The pieces are the real ones from the
          drop, so the wardrobe and the links already work.
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          {hasVideo ? (
            <video
              ref={video}
              src={episode.videoUrl}
              poster={episode.posterUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full border-2 border-ink bg-black"
              onTimeUpdate={(event) => setTime(clampTime(episode, event.currentTarget.currentTime))}
              onSeeked={(event) => setTime(clampTime(episode, event.currentTarget.currentTime))}
            >
              Your browser cannot play this video.
            </video>
          ) : (
            <TestCard className="aspect-[4/5] w-full border-2 border-ink sm:aspect-video">
              <div className="flex h-full flex-col justify-between p-3 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="ep-burn ep-tc text-xs sm:text-base">
                    TCR {formatTimecode(time, { fps: 24 })}
                  </span>
                  <span className="ep-burn eyebrow">{STATUS_LABEL[episode.status]}</span>
                </div>
                <div
                  key={scene?.id ?? "gap"}
                  className="ep-plate ep-cut mx-auto my-2 w-full max-w-xl px-4 py-3 sm:px-6 sm:py-5"
                >
                  <p className="eyebrow">
                    Storyboard
                    {scene
                      ? ` · ${scene.title} · ${formatTimecode(scene.startSec)} to ${formatTimecode(scene.endSec)}`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm leading-snug sm:text-lg">
                    {scene ? scene.beat : "No scene is planned for this stretch."}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="ep-burn ep-tc text-xs sm:text-base">
                    SC {sceneIndex >= 0 ? String(sceneIndex + 1).padStart(2, "0") : "--"} /{" "}
                    {String(episode.scenes.length).padStart(2, "0")}
                  </span>
                  <span className="ep-burn ep-tc text-xs sm:text-base">
                    EP {String(episode.number).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </TestCard>
          )}

          {!hasVideo ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!running && time >= episode.durationSec) setTime(0);
                  setRunning((value) => !value);
                }}
                className="inline-flex min-h-11 items-center gap-2 bg-accent px-4 font-display text-xs tracking-wider text-accent-fg uppercase"
              >
                {running ? (
                  <Pause className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                )}
                {running ? "Hold" : "Run the plan"}
              </button>
              <div className="flex" role="group" aria-label="Speed">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={speed === value}
                    onClick={() => setSpeed(value)}
                    className={cn(
                      "min-h-11 border-2 border-ink px-3 font-display text-xs tracking-wider uppercase",
                      value !== SPEEDS[0] && "-ml-0.5",
                      speed === value ? "bg-ink text-bg" : "bg-transparent text-fg hover:bg-fg/10",
                    )}
                  >
                    {value === 1 ? "Real time" : `${value} times`}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">Walks the timing. There is no film to play yet.</p>
            </div>
          ) : null}

          <Timeline episode={episode} time={time} onSeek={seek} className="mt-5" />
        </div>

        <OnScreenNow looks={looks} cutKey={cutKey} planned={planned} className="min-w-0" />
      </div>

      <Slate
        className="mt-12"
        cells={[
          { label: "Episode", value: String(episode.number).padStart(2, "0") },
          { label: "Scenes", value: String(episode.scenes.length).padStart(2, "0") },
          { label: "Runs", value: formatTimecode(episode.durationSec) },
          { label: "Cast", value: String(episode.cast.length).padStart(2, "0") },
        ]}
      />

      <section className="mt-12" aria-labelledby="ep-plan">
        <h2 id="ep-plan" className="display text-5xl">
          {planned ? "The plan" : "Scene by scene"}
        </h2>
        <p className="mt-2 text-muted">
          {formatRunningTime(episode.durationSec)}, {episode.scenes.length} scenes.
          {planned ? " A plan, not a cut. Times will move once it is shot." : ""}
        </p>
        <ol className="mt-6 border-t-2 border-ink">
          {episode.scenes.map((item, index) => (
            <li
              key={item.id}
              className="grid gap-x-6 gap-y-2 border-b-2 border-ink py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
            >
              <div>
                <button
                  type="button"
                  onClick={() => {
                    seek(item.startSec);
                    window.scrollTo({ top: 0 });
                  }}
                  className="ep-tc inline-flex min-h-11 items-center border-b-2 border-fg text-lg"
                  aria-label={`Jump to ${item.title}, ${formatTimecode(item.startSec)}`}
                >
                  {formatTimecode(item.startSec)}
                </button>
                <p className="ep-tc text-sm text-subtle">to {formatTimecode(item.endSec)}</p>
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm tracking-wider uppercase">
                  {String(index + 1).padStart(2, "0")} · {item.title}
                </h3>
                <p className="mt-1 max-w-2xl">{item.beat}</p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {item.wardrobe.map((look) => (
                    <li key={look.cast}>
                      <span className="text-fg">{look.cast}</span> wears{" "}
                      {resolveRefs(look.pieces, have)
                        .map((piece) => (isMissing(piece) ? "a piece that is gone" : piece.name))
                        .join(", ") || "nothing set"}
                      .
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="ep-worn">
        <h2 id="ep-worn" className="display text-5xl">
          {planned ? "Planned wardrobe" : "Everything worn"}
        </h2>
        <div className="mt-6 grid gap-x-4 gap-y-3 md:grid-cols-2">
          {worn.map((piece) => {
            const seen = firstSeen(episode, piece.ref);
            return (
              <div key={refKey(piece.ref)} className="min-w-0">
                <ul>
                  <PieceRow piece={piece} animate={false} />
                </ul>
                {seen !== null && !isMissing(piece) ? (
                  <p className="ep-tc mt-1 text-xs text-subtle">
                    {planned ? "Planned from" : "First seen at"} {formatTimecode(seen)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
