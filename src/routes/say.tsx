import { createFileRoute } from "@tanstack/react-router";
import { SayPage } from "@/components/say/say-page";
import { StudioShell } from "@/components/studio/shell";

export const Route = createFileRoute("/say")({ component: SayRoute });

/** Describe a piece out loud or in the text box and get a real starting design. */
function SayRoute() {
  return (
    <StudioShell current="/say">
      <SayPage />
    </StudioShell>
  );
}
