import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/episodes/")({ component: Placeholder });

/** Placeholder. Replaced when the feature lands. */
function Placeholder() {
  return null;
}
