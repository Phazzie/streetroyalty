import { createFileRoute } from "@tanstack/react-router";
import { TagPage } from "@/components/tag/tag-page";
import { cleanHandle } from "@/lib/qr/handle";

export const Route = createFileRoute("/tag/$slug")({
  validateSearch: (search: Record<string, unknown>): { m?: string } => {
    const m = cleanHandle(search.m);
    return m ? { m } : {};
  },
  component: TagRoute,
});

function TagRoute() {
  const { slug } = Route.useParams();
  const { m } = Route.useSearch();
  return <TagPage slug={slug} makerHandle={m} />;
}
