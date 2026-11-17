import { createFileRoute } from "@tanstack/react-router";
import { ReportsQueue } from "@/components/reports/queue";
import { StudioShell } from "@/components/studio/shell";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

/** The back room. The queue itself checks, on the server, that the viewer runs the shop. */
function ReportsPage() {
  return (
    <StudioShell current="/reports">
      <ReportsQueue />
    </StudioShell>
  );
}
