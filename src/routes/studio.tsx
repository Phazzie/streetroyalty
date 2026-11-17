import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/components/studio/editor";
import { SetBoard } from "@/components/studio/set-board";
import { Note, StudioShell } from "@/components/studio/shell";
import { readSet, saveSetColors } from "@/lib/studio/api";

export const Route = createFileRoute("/studio")({
  validateSearch: (search: Record<string, unknown>): { design?: string; set?: string } => {
    const design = typeof search.design === "string" ? search.design : "";
    const set = typeof search.set === "string" ? search.set : "";
    return { ...(design ? { design } : {}), ...(set ? { set } : {}) };
  },
  component: StudioPage,
});

function StudioPage() {
  const { design, set } = Route.useSearch();
  return (
    <StudioShell current="/studio">
      <div className="mb-5">
        <p className="tag">Design studio</p>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">Build the piece. Then print it.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Pick a blank, or build an all-over tracksuit panel by panel. Curve the type, check the print, and save a colorway before it hits the rack.
        </p>
      </div>
      {set ? <SavedSet setId={set} /> : <Editor designId={design ?? ""} />}
    </StudioShell>
  );
}

function SavedSet({ setId }: { setId: string }) {
  const [record, setRecord] = useState<Awaited<ReturnType<typeof readSet>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void readSet({ data: { setId } })
      .then(setRecord)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "That set is missing."));
  }, [setId]);

  if (error) return <Note>{error}</Note>;
  if (!record) return <p className="text-muted">Loading the set.</p>;
  return (
    <SetBoard
      title={record.title}
      colorways={record.colorways}
      activeColorwayId={record.activeColorwayId}
      pieces={record.pieces.map((piece) => ({ name: piece.title, garment: piece.garment }))}
      onPick={(id) => {
        void saveSetColors({ data: { setId: record.id, colorways: record.colorways, activeColorwayId: id } })
          .then(setRecord)
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not save the colorway."));
      }}
    />
  );
}
