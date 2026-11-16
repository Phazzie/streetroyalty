import { useState } from "react";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { SiteShell } from "@/components/site/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/pod/money";
import { getStoreProduct } from "@/lib/storefront/api";
import { useBag } from "@/lib/storefront/bag";
import { defaultColor, pickVariant, sizeAvailable } from "@/lib/storefront/browse";
import type { StoreProduct, StoreSource } from "@/lib/storefront/types";
import { shopPiece } from "@/lib/studio/api";

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params }) => {
    const found = await getStoreProduct({ data: { slug: params.slug } });
    if (found) return found;
    // Published customs used to live at this address. An old link to one is sent on to the rack.
    const custom = await shopPiece({ data: { slug: params.slug } }).catch(() => null);
    if (custom) throw redirect({ to: "/rack/$slug", params: { slug: params.slug } });
    throw notFound();
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.product.name} · Street Royalty` : "Street Royalty" },
    ],
  }),
  notFoundComponent: MissingProduct,
  component: ProductPage,
});

function MissingProduct() {
  return (
    <SiteShell theme="paper">
      <div className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="display text-7xl">Not on the shelf.</h1>
        <p className="mt-4 text-muted">That piece is gone or the link is wrong.</p>
        <Link
          to="/shop"
          className="mt-8 inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-wider uppercase"
        >
          <span className="border-b-2 border-fg pb-0.5">Back to the drop</span>
          <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </Link>
      </div>
    </SiteShell>
  );
}

function ProductPage() {
  const data = Route.useLoaderData();
  // Keyed by product, so the size and photo picked on one piece do not carry over to the next.
  return <ProductView key={data.product.id} {...data} />;
}

function ProductView({
  product,
  pairs,
  source,
}: {
  product: StoreProduct;
  pairs: StoreProduct[];
  source: StoreSource;
}) {
  const add = useBag((state) => state.add);
  const [shot, setShot] = useState(0);
  const [color, setColor] = useState(() => defaultColor(product));
  const [size, setSize] = useState<string | undefined>(undefined);
  const [nudge, setNudge] = useState(false);

  const variant = pickVariant(product, { color, size });
  const needsSize = product.sizes.length > 0;
  const price = variant?.priceCents ?? product.priceCents;
  const compareAt = variant?.compareAtCents ?? product.compareAtCents;
  const image = product.images[Math.min(shot, product.images.length - 1)];
  const demo = source === "demo";

  function addToBag() {
    if (!variant) {
      setNudge(true);
      return;
    }
    add({
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variant.label,
      priceCents: variant.priceCents,
      imageUrl: variant.imageUrl ?? product.images[0]?.url ?? "",
      quantity: 1,
    });
  }

  return (
    <SiteShell theme="paper">
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-20 sm:px-6">
        <nav aria-label="Breadcrumb" className="eyebrow flex items-center gap-2 text-subtle">
          <Link to="/shop" className="py-2 hover:text-fg">
            The drop
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-fg">{product.name}</span>
        </nav>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div className="lg:flex lg:flex-row-reverse lg:gap-3">
            <div className="relative aspect-3/4 flex-1 overflow-hidden bg-surface">
              {image ? (
                <img
                  key={image.url}
                  src={image.url}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  fetchPriority="high"
                  decoding="async"
                  className="hero-fade h-full w-full object-cover object-top"
                />
              ) : null}
              {product.soldOut ? (
                <span className="eyebrow absolute top-3 left-3 bg-ink px-2 py-1 text-bg">
                  Sold out
                </span>
              ) : null}
            </div>
            {product.images.length > 1 ? (
              <ul
                className="no-scrollbar mt-3 flex gap-2 overflow-x-auto lg:mt-0 lg:w-20 lg:flex-col lg:overflow-visible"
                aria-label="Photos"
              >
                {product.images.map((item, index) => (
                  <li key={item.url} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setShot(index)}
                      aria-label={`Photo ${index + 1}: ${item.alt}`}
                      aria-current={index === shot ? "true" : undefined}
                      className={cn(
                        "block h-24 w-18 overflow-hidden border-2 lg:h-26 lg:w-20",
                        index === shot
                          ? "border-ink"
                          : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      <img
                        src={item.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover object-top"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {product.badge ? <p className="eyebrow text-subtle">{product.badge}</p> : null}
            <h1 className="display mt-2 text-6xl sm:text-7xl">{product.name}</h1>
            <p className="mt-4 font-display text-2xl">
              {compareAt ? (
                <span className="mr-2 text-subtle line-through">{formatMoney(compareAt)}</span>
              ) : null}
              {formatMoney(price)}
            </p>
            {product.blurb ? <p className="mt-3 text-lg text-muted">{product.blurb}</p> : null}

            {product.colors.length > 1 ? (
              <fieldset className="mt-7">
                <legend className="eyebrow text-subtle">
                  Colour <span className="ml-1 text-fg">{color}</span>
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      aria-pressed={item.name === color}
                      aria-label={item.name}
                      onClick={() => {
                        setColor(item.name);
                        if (size && !sizeAvailable(product, item.name, size)) setSize(undefined);
                      }}
                      className={cn(
                        "h-11 w-11 rounded-full border-2 p-0.5",
                        item.name === color ? "border-ink" : "border-transparent",
                      )}
                    >
                      <span
                        className="block h-full w-full rounded-full border border-line"
                        style={{ backgroundColor: item.swatch }}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {needsSize ? (
              <fieldset className="mt-7">
                <legend className="eyebrow text-subtle">
                  Size {size ? <span className="ml-1 text-fg">{size}</span> : null}
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map((item) => {
                    const available = sizeAvailable(product, color, item);
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={item === size}
                        disabled={!available}
                        onClick={() => {
                          setSize(item);
                          setNudge(false);
                        }}
                        className={cn(
                          "h-12 min-w-14 border-2 border-ink px-3 font-display text-sm uppercase transition-colors duration-150",
                          item === size
                            ? "bg-ink text-bg"
                            : "bg-transparent text-fg hover:bg-fg/10",
                          "disabled:border-line disabled:text-subtle disabled:line-through disabled:hover:bg-transparent",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                {nudge && !size ? (
                  <p role="alert" className="mt-3 text-sm font-semibold">
                    Pick a size first.
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            <div className="mt-8 flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full rounded-none font-display text-sm tracking-wider uppercase"
                disabled={product.soldOut || (variant ? !variant.available : false)}
                onClick={addToBag}
              >
                {product.soldOut ? "Sold out" : "Add to bag"}
              </Button>
              <Link
                to="/lab"
                search={{ wear: product.slug }}
                className="inline-flex h-14 w-full items-center justify-center gap-2 border-2 border-ink px-5 font-display text-sm tracking-wider text-fg uppercase transition-colors duration-150 hover:bg-fg/10"
              >
                <Sparkles className="h-4 w-4" />
                Try it on in the lab
              </Link>
            </div>
            {demo ? (
              <p className="mt-3 text-sm text-muted">
                Preview drop. This piece is not for sale yet.
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 text-muted">
              {product.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {product.details.length > 0 ? (
              <div className="mt-8 border-t border-line">
                {product.details.map((detail) => (
                  <details key={detail.title} className="group border-b border-line">
                    <summary className="flex min-h-14 list-none items-center justify-between font-display text-sm tracking-wider uppercase [&::-webkit-details-marker]:hidden">
                      {detail.title}
                      <span
                        aria-hidden="true"
                        className="text-xl leading-none transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <div className="flex flex-col gap-2 pb-5 text-muted">
                      {detail.body.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {pairs.length > 0 ? (
          <section className="mt-20">
            <Reveal>
              <p className="eyebrow text-subtle">Goes with it</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">Finish the look</h2>
            </Reveal>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {pairs.map((item, index) => (
                <Reveal as="li" key={item.id} delay={index * 70}>
                  <ProductCard product={item} />
                </Reveal>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}
