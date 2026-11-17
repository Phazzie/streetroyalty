import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/$slug")({ component: Placeholder });

/** Placeholder. Replaced when the feature lands. */
function Placeholder() {
  return null;
}
