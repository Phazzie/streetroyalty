import { createFileRoute } from "@tanstack/react-router";
import { LabApp } from "@/components/lab/lab-app";

export const Route = createFileRoute("/lab")({
  validateSearch: (search: Record<string, unknown>): { wear?: string } => {
    const wear = typeof search.wear === "string" ? search.wear.slice(0, 160) : "";
    return wear ? { wear } : {};
  },
  component: LabPage,
});

function LabPage() {
  const { wear } = Route.useSearch();
  return <LabApp wear={wear} />;
}
