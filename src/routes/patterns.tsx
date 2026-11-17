import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patterns")({ component: Placeholder });

/** Placeholder. Replaced when the feature lands. */
function Placeholder() {
  return null;
}
