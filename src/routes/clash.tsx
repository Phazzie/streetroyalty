import { createFileRoute, redirect } from "@tanstack/react-router";

// The clash machine coloured a sweatsuit nobody could order. Old links land in the studio.
export const Route = createFileRoute("/clash")({
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});
