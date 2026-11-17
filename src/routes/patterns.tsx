import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PatternLab } from "@/components/patterns/pattern-lab";

/** The Pattern Lab. The whole pattern lives in ?p= so a link opens the same cloth. */
export const Route = createFileRoute("/patterns")({
  validateSearch: (search: Record<string, unknown>): { p?: string } => {
    const p = typeof search.p === "string" ? search.p.slice(0, 200) : "";
    return p ? { p } : {};
  },
  component: PatternsPage,
});

function PatternsPage() {
  const { p } = Route.useSearch();
  const navigate = Route.useNavigate();
  const onEncoded = useCallback(
    (text: string) => {
      void navigate({ search: { p: text }, replace: true, resetScroll: false });
    },
    [navigate],
  );
  return <PatternLab encoded={p} onEncoded={onEncoded} />;
}
