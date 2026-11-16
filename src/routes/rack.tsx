import { createFileRoute, Outlet } from "@tanstack/react-router";

function RackLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/rack")({
  component: RackLayout,
});
