import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { BagDrawer } from "@/components/site/bag-drawer";
import { cn } from "@/lib/cn";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bagCount, useBag } from "@/lib/storefront/bag";

const NAV = [
  { to: "/shop", label: "Shop" },
  { to: "/lab", label: "Outfit Lab" },
  { to: "/studio", label: "Studio" },
  { to: "/rack", label: "The Rack" },
] as const;

export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" className={className} aria-hidden="true" fill="currentColor">
      <path d="M2 18.5 5.4 5.2l5.2 6.3L16 1l5.4 10.5 5.2-6.3L30 18.5Z" />
      <rect x="2" y="19.6" width="28" height="2.4" rx="0.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn("flex items-center gap-2.5 text-fg", className)}
      aria-label="Street Royalty, home"
    >
      <Crown className="h-5 w-auto text-accent" />
      <span className="display text-2xl leading-none tracking-normal">Street Royalty</span>
    </Link>
  );
}

function BagButton() {
  const lines = useBag((state) => state.lines);
  const setOpen = useBag((state) => state.setOpen);
  const hydrate = useBag((state) => state.hydrate);
  const count = bagCount(lines);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative grid h-11 w-11 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-fg/10"
      aria-label={
        count > 0 ? `Open the bag, ${count} ${count === 1 ? "piece" : "pieces"}` : "Open the bag"
      }
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={2} />
      {count > 0 ? (
        <span className="absolute top-1 right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 font-display text-xs leading-none text-accent-fg">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function AccountLink() {
  const { user } = useCurrentUserState();
  return (
    <Link
      to={user ? "/gallery" : "/login"}
      className="grid h-11 w-11 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-fg/10"
      aria-label={user ? "Your saved pieces" : "Sign in"}
    >
      <UserRound className="h-5 w-5" strokeWidth={2} />
    </Link>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-fg/10 md:hidden"
          aria-label="Open the menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className="night scrim-in fixed inset-0 z-50 flex flex-col overflow-y-auto px-5 py-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <span className="flex items-center gap-2.5">
                <Crown className="h-5 w-auto text-accent" />
                <span className="display text-2xl">Street Royalty</span>
              </span>
            </Dialog.Title>
            <Dialog.Description className="sr-only">Site menu</Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full text-fg hover:bg-fg/10"
                aria-label="Close the menu"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <nav className="mt-10 flex flex-col gap-1" aria-label="Site">
            {NAV.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="display hero-fade border-b border-line py-4 text-5xl text-fg"
                style={{ "--line-delay": `${60 + index * 50}ms` } as React.CSSProperties}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-10 text-muted">
            <Link to="/gallery" onClick={() => setOpen(false)}>
              Saved pieces
            </Link>
            <Link to="/orders" onClick={() => setOpen(false)}>
              Orders
            </Link>
            <Link to="/login" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const solid = !overlay || scrolled;

  return (
    <header
      className={cn(
        "night inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300",
        overlay ? "fixed" : "sticky",
        solid
          ? "border-b border-line bg-night/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Site">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-2 font-display text-xs tracking-widest text-fg uppercase transition-colors duration-150 hover:bg-fg/10"
              activeProps={{ className: "bg-fg/10 text-accent" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          <AccountLink />
          <BagButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="night border-t border-line">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-muted">Crown never came off. Just dressing it.</p>
        </div>
        <FooterColumn
          title="Shop"
          links={[
            { to: "/shop", label: "The drop" },
            { to: "/rack", label: "The rack" },
            { to: "/orders", label: "Orders" },
          ]}
        />
        <FooterColumn
          title="Make"
          links={[
            { to: "/lab", label: "Outfit Lab" },
            { to: "/studio", label: "Design studio" },
            { to: "/gallery", label: "Saved pieces" },
          ]}
        />
        <FooterColumn title="Account" links={[{ to: "/login", label: "Sign in" }]} />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-subtle sm:px-6">
          Street Royalty. Looks are generated in the lab. Pieces are made to order.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: {
    to: "/shop" | "/rack" | "/orders" | "/lab" | "/studio" | "/gallery" | "/login";
    label: string;
  }[];
}) {
  return (
    <nav aria-label={title}>
      <p className="eyebrow text-subtle">{title}</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-fg underline-offset-4 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteShell({
  children,
  overlayHeader = false,
  theme = "night",
}: {
  children: ReactNode;
  overlayHeader?: boolean;
  theme?: "night" | "paper";
}) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col overflow-x-clip",
        theme === "paper" ? "paper" : "night",
      )}
    >
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to the page
      </a>
      <SiteHeader overlay={overlayHeader} />
      <main id="site-main" className="min-w-0 flex-1">
        {children}
      </main>
      <SiteFooter />
      <BagDrawer />
    </div>
  );
}
