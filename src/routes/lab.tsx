import { createFileRoute } from "@tanstack/react-router";
import { LabApp } from "@/components/lab/lab-app";

export const Route = createFileRoute("/lab")({
  component: LabPage,
});

function LabPage() {
  return <LabApp />;
}
