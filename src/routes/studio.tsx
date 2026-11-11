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
      <div className="mb-5">
        <p className="tag">Design studio</p>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">Build the piece. Then print it.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Pick a blank, drop art and type inside the print area, and pull a mockup before it hits the rack.
        </p>
      </div>
      <Editor designId={design ?? ""} />
    </StudioShell>
  );
}
