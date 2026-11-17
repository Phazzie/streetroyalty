import { createFileRoute } from "@tanstack/react-router";
import { RiskApp } from "@/components/risk/risk-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <RiskApp />;
}
