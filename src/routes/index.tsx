import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/site/home";
import { getStorefront } from "@/lib/storefront/api";

export const Route = createFileRoute("/")({
  loader: () => getStorefront(),
  component: Home,
});

function Home() {
  const catalog = Route.useLoaderData();
  return <HomePage catalog={catalog} />;
}
