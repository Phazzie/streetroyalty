import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/pod/money";
import type { StoreProduct } from "@/lib/storefront/types";

export function ProductCard({
  product,
  eager = false,
  className,
}: {
  product: StoreProduct;
  eager?: boolean;
  className?: string;
}) {
  const main = product.images[0];
  const alt = product.images[1];
  return (
    <Link
      to="/shop/$slug"
      params={{ slug: product.slug }}
      className={cn("product-card group block bg-surface text-fg", className)}
    >
      <div className="relative aspect-3/4 overflow-hidden bg-cream">
        {main ? (
          <img
            src={main.url}
            alt={main.alt}
            width={main.width}
            height={main.height}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="product-main h-full w-full object-cover"
          />
        ) : null}
        {alt ? (
          <img
            src={alt.url}
            alt=""
            width={alt.width}
            height={alt.height}
            loading="lazy"
            decoding="async"
            className="product-alt absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : null}
        {product.soldOut ? (
          <span className="eyebrow absolute top-3 left-3 bg-ink px-2 py-1 text-bg">Sold out</span>
        ) : product.badge ? (
          <span className="eyebrow absolute top-3 left-3 bg-surface px-2 py-1 text-fg">
            {product.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4 sm:py-4">
        <div className="min-w-0">
          <p className="display text-2xl">{product.name}</p>
          <p className="mt-1.5 hidden text-sm text-muted sm:block">{product.blurb}</p>
        </div>
        <p className="shrink-0 font-display text-sm sm:pt-0.5">
          {product.compareAtCents ? (
            <span className="mr-1.5 text-subtle line-through">
              {formatMoney(product.compareAtCents)}
            </span>
          ) : null}
          {formatMoney(product.priceCents)}
        </p>
      </div>
    </Link>
  );
}
