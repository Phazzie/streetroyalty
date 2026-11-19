import { createFileRoute } from "@tanstack/react-router";
import { MadePage } from "@/components/made/made-page";

export const Route = createFileRoute("/made")({
  head: () => ({ meta: [{ title: "How it's made · Street Royalty" }] }),
  component: MadePage,
});
