import { createFileRoute, Outlet } from "@tanstack/react-router";

function EpisodesLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/episodes")({
  component: EpisodesLayout,
});
