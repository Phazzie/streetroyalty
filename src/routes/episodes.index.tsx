import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  EpisodesStyle,
  OnAirLamp,
  Slate,
  StationClock,
  StatusLine,
  TestCard,
} from "@/components/episodes/channel";
import { WardrobeBuilder } from "@/components/episodes/wardrobe-builder";
import { SiteShell } from "@/components/site/shell";
import { EPISODES, onAir } from "@/lib/episodes/data";
import { episodePieces, formatRunningTime, formatTimecode } from "@/lib/episodes/helpers";
import type { Episode } from "@/lib/episodes/types";
import { getStorefront } from "@/lib/storefront/api";

export const Route = createFileRoute("/episodes/")({
  loader: () => getStorefront(),
  head: () => ({ meta: [{ title: "Episodes · Street Royalty" }] }),
  component: EpisodesPage,
});

function EpisodesPage() {
  const catalog = Route.useLoaderData();
  const lit = onAir();
  const out = EPISODES.filter((episode) => episode.status === "out").length;

  return (
    <SiteShell theme="night">
      <EpisodesStyle />
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow text-subtle">The show</p>
          <OnAirLamp on={lit} />
        </div>
        <h1 className="display mt-3 text-7xl sm:text-8xl lg:text-9xl">Episodes</h1>
        <div className="mt-5 max-w-2xl text-lg text-muted">
          <p>Short episodes, about five minutes each, made with AI video.</p>
          <p>Everyone on screen wears the exact pieces sold here, so you can shop what you see.</p>
        </div>
        <p className="mt-4 max-w-2xl border-l-4 border-pipe pl-3 text-fg">
          {lit
            ? "The lamp is lit. There is something to watch."
            : "Nothing has been shot yet, so the lamp stays off. What is here today: the plan for the first one, and the wardrobe sheet that keeps an outfit the same from shot to shot."}
        </p>

        <Slate
          className="mt-8"
          cells={[
            { label: "Out now", value: String(out).padStart(2, "0") },
            { label: "Planned", value: String(EPISODES.length - out).padStart(2, "0") },
            { label: "Your clock", value: <StationClock /> },
          ]}
        />

        <h2 className="display mt-14 text-5xl">{out > 0 ? "The list" : "What is planned"}</h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {EPISODES.map((episode) => (
            <li key={episode.slug}>
              <EpisodeCard episode={episode} />
            </li>
          ))}
          <li className="hidden border-2 border-dashed border-line p-6 md:flex md:flex-col md:justify-end">
            <p className="ep-tc text-sm text-subtle">EP 01</p>
            <p className="display mt-2 text-4xl text-subtle">Nothing here yet.</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              The next slot is empty until an episode is written.
            </p>
          </li>
        </ul>
      </div>

      <section className="paper" aria-labelledby="ep-builder">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="eyebrow text-subtle">Works today</p>
          <h2 id="ep-builder" className="display mt-3 text-6xl sm:text-7xl">
            The wardrobe sheet
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            AI video tools forget what people are wearing between shots. Name a character, pick
            their pieces, and take away one reference picture and one block of words to use on every
            shot.
          </p>
          <div className="mt-10">
            <WardrobeBuilder products={catalog.products} demo={catalog.source === "demo"} />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const pieces = episodePieces(episode).length;
  return (
    <Link
      to="/episodes/$slug"
      params={{ slug: episode.slug }}
      className="group block border-2 border-ink bg-surface text-fg"
    >
      {episode.posterUrl ? (
        <img
          src={episode.posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <TestCard className="aspect-video w-full">
          <div className="flex h-full flex-col justify-between p-3">
            <span className="ep-burn ep-tc self-start text-sm">
              EP {String(episode.number).padStart(2, "0")}
            </span>
            <span className="ep-plate eyebrow self-center px-3 py-2 text-center">
              No picture yet
            </span>
            <span className="ep-burn ep-tc self-end text-sm">
              {formatTimecode(episode.durationSec, { fps: 24 })}
            </span>
          </div>
        </TestCard>
      )}
      <div className="border-t-2 border-ink p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusLine status={episode.status} />
          {episode.template ? <span className="eyebrow text-subtle">Template</span> : null}
        </div>
        <h3 className="display mt-3 text-4xl sm:text-5xl">{episode.title}</h3>
        <p className="mt-3 text-muted">{episode.logline}</p>
        <p className="ep-tc mt-3 text-xs text-subtle">
          {formatRunningTime(episode.durationSec)} planned · {episode.scenes.length} scenes ·{" "}
          {pieces} pieces
        </p>
        <span className="mt-4 inline-flex min-h-11 items-center gap-2 bg-accent px-4 font-display text-xs tracking-wider text-accent-fg uppercase">
          {episode.videoUrl ? "Watch it" : "Open the storyboard"}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
