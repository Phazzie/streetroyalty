import { Button } from "@/components/ui/button";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { copy } from "@/lib/copy";
import { useLab } from "@/lib/store";

export function LookScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const busy = useLab((state) => state.busy);
  const saveDraft = useLab((state) => state.saveDraft);
  const requestRunway = useLab((state) => state.requestRunway);

  return (
    <Shell>
      <Header
        action={
          <div className="flex">
            <TextButton onClick={() => setView("hub")}>{copy.hub}</TextButton>
            <TextButton onClick={() => setView("board")}>{copy.board}</TextButton>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-4">
        {draft ? (
          <img
            src={draft.image}
            alt={draft.spoken}
            className="seam max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="aspect-3/4 w-full rounded-xl bg-surface" />
        )}
      </div>
      <div className="safe-bottom border-t border-line px-5 pt-4">
        <p className="mb-3 text-center text-sm">{copy.runwayHint}</p>
        <p className="mb-3 text-center text-sm text-muted">{copy.change}</p>
        <Composer flush />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="ghost" disabled={!draft || busy} onClick={saveDraft}>
            {copy.saveThis}
          </Button>
          <Button disabled={!draft || busy} onClick={requestRunway}>
            {copy.runway}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
