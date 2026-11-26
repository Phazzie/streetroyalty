import { createFileRoute } from "@tanstack/react-router";
import { FineSection, HelpPage } from "@/components/help/help-page";
import { SizeChart } from "@/components/help/size-chart";
import { getSizeGuides } from "@/lib/help/sizes";

export const Route = createFileRoute("/sizes")({
  head: () => ({ meta: [{ title: "Size guide · Street Royalty" }] }),
  loader: () => getSizeGuides(),
  component: SizesPage,
});

function SizesPage() {
  const blanks = Route.useLoaderData();
  return (
    <HelpPage
      current="/sizes"
      eyebrow="Size guide"
      title="Fit it before you print it."
      lede="Every piece is made to order, so the size you pick is the size you get. Lay a piece you love flat and measure it against these."
    >
      <nav aria-label="Pieces" className="mb-2 flex flex-wrap gap-2">
        {blanks.map((blank) => (
          <a
            key={blank.id}
            href={`#${blank.id}`}
            className="inline-flex min-h-11 items-center border-2 border-line px-3 font-display text-xs uppercase no-underline hover:border-ink"
          >
            {blank.name}
          </a>
        ))}
      </nav>
      {blanks.map((blank, index) => (
        <div key={blank.id} id={blank.id} className="scroll-mt-24">
          <FineSection n={index + 1} title={`${blank.name} · ${blank.model}`}>
            <SizeChart blank={blank} />
          </FineSection>
        </div>
      ))}
    </HelpPage>
  );
}
