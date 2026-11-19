import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EpisodesStyle, OnAirLamp, TestCard } from "@/components/episodes/channel";
import { EpisodeView } from "@/components/episodes/episode-view";
import { SiteShell } from "@/components/site/shell";
import { findEpisode, onAir } from "@/lib/episodes/data";
import { getStorefront } from "@/lib/storefront/api";

export const Route = createFileRoute("/episodes/$slug")({
  loader: async ({ params }) => {
    const episode = findEpisode(params.slug);
    if (!episode) throw notFound();
    const catalog = await getStorefront();
    return { episode, products: catalog.products };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.episode.title} · Episodes · Street Royalty`
          : "Episodes · Street Royalty",
      },
    ],
  }),
  notFoundComponent: MissingEpisode,
  component: EpisodePage,
});

function EpisodePage() {
  const { episode, products } = Route.useLoaderData();
  return (
    <SiteShell theme="night">
      <EpisodesStyle />
      <EpisodeView episode={episode} products={products} lampOn={onAir()} />
    </SiteShell>
  );
}

function MissingEpisode() {
  return (
    <SiteShell theme="night">
      <EpisodesStyle />
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <TestCard className="aspect-video w-full border-2 border-ink">
          <div className="grid h-full place-items-center p-4">
            <p className="ep-plate ep-tc px-4 py-3 text-center text-sm sm:text-xl">No signal</p>
          </div>
        </TestCard>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-6xl sm:text-7xl">No episode here.</h1>
            <p className="mt-4 max-w-md text-muted">
              Nothing was ever at this address, or the link is wrong. No episode has been shot yet.
            </p>
          </div>
          <OnAirLamp on={onAir()} />
        </div>
        <Link
          to="/episodes"
          className="mt-8 inline-flex min-h-11 items-center gap-2 bg-accent px-4 font-display text-xs tracking-wider text-accent-fg uppercase"
        >
          See what is planned
          <ArrowRight className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
        </Link>
      </div>
    </SiteShell>
  );
}
