import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/store";

const EXAMPLES = ["make it black", "add a hat", "shorter coat"] as const;

export function LookScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const busy = useLab((state) => state.busy);
  const saveDraft = useLab((state) => state.saveDraft);
  const requestRunway = useLab((state) => state.requestRunway);

  return (
    <Shell>
      <Header
        title={copy.look}
        action={
          <>
            <TextButton onClick={() => setView("hub")}>{copy.hub}</TextButton>
            <TextButton onClick={() => setView("board")}>{copy.board}</TextButton>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 *:shrink-0">
        {draft ? (
          <figure className="flex flex-col items-center gap-2">
            <img
              src={draft.image}
              alt={draft.spoken}
              className={cn("seam mx-auto max-h-72 max-w-full object-contain", busy && "pending-pulse")}
            />
            <figcaption className="text-center text-sm text-muted">{draft.spoken}</figcaption>
          </figure>
        ) : busy ? (
          <p className="pending-pulse text-center text-lg">{copy.puttingOn}</p>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p>{copy.nothingOn}</p>
            <Button onClick={() => setView("board")}>{copy.openBoard}</Button>
          </div>
        )}
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <p className="mb-3 text-sm text-muted">{copy.runwayHint}</p>
        <Composer placeholder={copy.changeHint} suggestions={draft ? EXAMPLES : []} />
        <div className="mt-3 grid grid-cols-2 gap-3">
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
