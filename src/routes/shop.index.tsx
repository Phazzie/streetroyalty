import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { SiteShell } from "@/components/site/shell";
import { cn } from "@/lib/cn";
import { getStorefront } from "@/lib/storefront/api";
import { filterProducts, sortProducts, type ShopSort } from "@/lib/storefront/browse";

export const Route = createFileRoute("/shop/")({
  loader: () => getStorefront(),
  head: () => ({ meta: [{ title: "The Drop · Street Royalty" }] }),
  component: ShopPage,
});

const SORTS: { id: ShopSort; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "low", label: "Price, low to high" },
  { id: "high", label: "Price, high to low" },
];

function ShopPage() {
  const catalog = Route.useLoaderData();
  const [collection, setCollection] = useState("all");
  const [sort, setSort] = useState<ShopSort>("featured");
  const [query, setQuery] = useState("");

  const shown = useMemo(
    () => sortProducts(filterProducts(catalog.products, { collection, query }), sort),
    [catalog.products, collection, query, sort],
  );
  const demo = catalog.source === "demo";
  const empty = catalog.products.length === 0;

  return (
    <SiteShell theme="paper">
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <p className="eyebrow text-subtle">{demo ? "Preview drop" : catalog.shopName}</p>
        <h1 className="display mt-3 text-7xl sm:text-8xl lg:text-9xl">The drop</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Two sets, and the pieces that go with them. Made to order after checkout.
        </p>

        {demo ? (
          <p
            role="note"
            className="mt-6 max-w-2xl border-2 border-ink bg-surface px-4 py-3 text-sm"
          >
            This is the preview drop. It shows how the shop will look, and nothing here can be
            bought yet. Real products and checkout appear when the Fourthwall shop is connected.
          </p>
        ) : null}
        {catalog.notice ? (
          <p
            role="status"
            className="mt-6 max-w-2xl border-2 border-ink bg-surface px-4 py-3 text-sm"
          >
            {catalog.notice}
          </p>
        ) : null}

        {empty ? (
          catalog.notice ? null : (
            <div className="mt-12 border-2 border-dashed border-ink px-6 py-16 text-center">
              <p className="display text-5xl">The first drop is being stocked.</p>
              <p className="mx-auto mt-4 max-w-md text-muted">
                Nothing is on the shelf yet. The lab and the studio are open while you wait.
              </p>
              <Link
                to="/lab"
                className="mt-6 inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-wider uppercase"
              >
                <span className="border-b-2 border-fg pb-0.5">Open the lab</span>
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </Link>
            </div>
          )
        ) : (
          <>
            <div className="mt-10 flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
                role="group"
                aria-label="Collections"
              >
                {[{ slug: "all", name: "Everything" }, ...catalog.collections].map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    aria-pressed={collection === item.slug}
                    onClick={() => setCollection(item.slug)}
                    className={cn(
                      "h-11 shrink-0 border-2 border-ink px-4 font-display text-xs tracking-wider uppercase transition-colors duration-150",
                      collection === item.slug
                        ? "bg-ink text-bg"
                        : "bg-transparent text-fg hover:bg-fg/10",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="relative flex-1 lg:w-64 lg:flex-none">
                  <span className="sr-only">Search the drop</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Hoodie, mint, crown"
                    className="h-11 w-full border-2 border-ink bg-surface pr-3 pl-9 font-sans text-base text-fg placeholder:text-subtle"
                  />
                </label>
                <label>
                  <span className="sr-only">Sort</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as ShopSort)}
                    className="h-11 border-2 border-ink bg-surface px-3 font-sans text-base text-fg"
                  >
                    {SORTS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {shown.length === 0 ? (
              <p className="mt-10 border-2 border-dashed border-ink px-6 py-10 text-center text-muted">
                Nothing matches that. Clear the search or pick another collection.
              </p>
            ) : (
              <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {shown.map((product, index) => (
                  <Reveal as="li" key={product.id} delay={Math.min(index, 7) * 50}>
                    <ProductCard product={product} eager={index < 4} />
                  </Reveal>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <section className="night">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
          <Promo
            eyebrow="Outfit Lab"
            title="Try it on your own face."
            body="Lock your face, pick a piece from the shop, and see it on you before you buy."
            to="/lab"
            cta="Open the lab"
          />
          <Promo
            eyebrow="The rack"
            title="Customs from the studio."
            body="One-off pieces designed in the studio and published by the people who made them."
            to="/rack"
            cta="See the rack"
          />
        </div>
      </section>
    </SiteShell>
  );
}

function Promo({
  eyebrow,
  title,
  body,
  to,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  to: "/lab" | "/rack";
  cta: string;
}) {
  return (
    <Reveal className="border-2 border-line p-6 sm:p-8">
      <p className="eyebrow text-accent">{eyebrow}</p>
      <h2 className="display mt-3 text-5xl">{title}</h2>
      <p className="mt-4 max-w-md text-muted">{body}</p>
      <Link
        to={to}
        className="group mt-6 inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-wider text-fg uppercase"
      >
        <span className="border-b-2 border-fg pb-0.5">{cta}</span>
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
          strokeWidth={3}
        />
      </Link>
    </Reveal>
  );
}
