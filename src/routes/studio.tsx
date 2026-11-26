import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/components/studio/editor";
import { StudioShell } from "@/components/studio/shell";

export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>): { design?: string } => {
    const design = typeof search.design === "string" ? search.design : "";
    return design ? { design } : {};
  },
  component: StudioPage,
});

function StudioPage() {
  const { design } = Route.useSearch();
  return (
    <StudioShell current="/studio">
      {/* On a phone the heading is one short line, so the piece is on screen straight away. */}
      <div className="mb-3 sm:mb-5">
        <div className="max-sm:hidden">
          <p className="tag">Design studio</p>
        </div>
        <h1 className="font-display text-2xl leading-none tracking-tight sm:mt-3 sm:text-5xl">Build the piece. Then print it.</h1>
        <p className="mt-3 max-w-xl text-muted max-sm:hidden">
          Pick a real blank and put art on every spot it prints. Curve the type, check the print, and save it before it hits the rack.
        </p>
      </div>
      <Editor designId={design ?? ""} />
    </StudioShell>
  );
}
