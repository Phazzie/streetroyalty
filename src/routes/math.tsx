import { createFileRoute } from "@tanstack/react-router";
import { MathPage } from "@/components/made/math-page";
import { readPlanSearch, type PlanSearch } from "@/lib/made/math";

export const Route = createFileRoute("/math")({
  validateSearch: (search: Record<string, unknown>): PlanSearch => readPlanSearch(search),
  head: () => ({ meta: [{ title: "Do the math · Street Royalty" }] }),
  component: MathRoute,
});

function MathRoute() {
  // Read it again: keys the validator dropped still come through from the raw link.
  const search = readPlanSearch(Route.useSearch());
  const navigate = Route.useNavigate();
  return (
    <MathPage
      search={search}
      onChange={(next) => void navigate({ search: next, replace: true, resetScroll: false })}
    />
  );
}
