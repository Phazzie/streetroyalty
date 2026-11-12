import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { critiqueOutfit } from "@/lib/ai/api";
import { localCritique } from "@/lib/ai/local";
import { useLab } from "@/lib/store";

const EXAMPLES = ["make it black", "shorter coat"] as const;

export function LookScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const busy = useLab((state) => state.busy);
  const saveDraft = useLab((state) => state.saveDraft);
  const requestRunway = useLab((state) => state.requestRunway);
  const navigate = useNavigate();
  const [crown, setCrown] = useState<{ verdict: string; note: string; next: string; source: string } | null>(null);
  const [asking, setAsking] = useState(false);

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
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {draft ? (
          <figure className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <img
                src={draft.image}
                alt={draft.spoken}
                className={cn("absolute inset-0 h-full w-full object-contain", busy && "pending-pulse")}
              />
            </div>
            <figcaption className="line-clamp-2 shrink-0 py-2 text-center text-sm">{draft.spoken}</figcaption>
          </figure>
        ) : busy ? (
          <p className="pending-pulse flex flex-1 items-center justify-center text-center text-lg">{copy.puttingOn}</p>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p>{copy.nothingOn}</p>
            <Button onClick={() => setView("board")}>{copy.openBoard}</Button>
          </div>
        )}
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <Composer placeholder={copy.changeHint} suggestions={draft ? EXAMPLES : []} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={!draft || busy} onClick={saveDraft}>
            {copy.saveThis}
          </Button>
          <Button disabled={!draft || busy} onClick={requestRunway}>
            {copy.runway}
          </Button>
          <Button
            variant="ghost"
            className="col-span-2"
            disabled={!draft || asking}
            onClick={() => {
              if (!draft) return;
              setAsking(true);
              void critiqueOutfit({ data: { spoken: draft.spoken } })
                .then(setCrown)
                .catch(() => setCrown({ ...localCritique(draft.spoken), source: "local" }))
                .finally(() => setAsking(false));
            }}
          >
            {copy.crownAsk}
          </Button>
          {crown ? (
            <div className="col-span-2 border-2 border-line p-3 text-sm">
              <p className="font-display uppercase">{crown.verdict}</p>
              <p className="mt-1">{crown.note}</p>
              <p className="mt-1 text-muted">Next: {crown.next}</p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            className="col-span-2"
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              sessionStorage.setItem("sr-print-art", draft.image);
              void navigate({ to: "/studio" });
            }}
          >
            Print this
          </Button>
        </div>
      </div>
    </Shell>
  );
}
