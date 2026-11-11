import { createFileRoute, Outlet } from "@tanstack/react-router";

function ShopLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/shop")({
  component: ShopLayout,
});
