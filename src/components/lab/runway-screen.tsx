import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/store";
import type { Reaction } from "@/lib/types";

const CHOICES: { id: Reaction; label: string }[] = [
  { id: "cheer", label: copy.cheer },
  { id: "boo", label: copy.boo },
  { id: "both", label: copy.both },
];

export function RunwayScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const reaction = useLab((state) => state.reaction);
  const setReaction = useLab((state) => state.setReaction);
  const busy = useLab((state) => state.busy);
  const status = useLab((state) => state.status);
  const retryReaction = useLab((state) => state.retryReaction);
  const [broken, setBroken] = useState(false);
  const videoUrl = draft?.videoUrl;

  useEffect(() => {
    setBroken(false);
  }, [videoUrl]);

  const shot = draft?.videoReaction;
  const mismatch = Boolean(videoUrl && shot && shot !== reaction);
  const shotLabel = CHOICES.find((choice) => choice.id === shot)?.label;

  function move(direction: 1 | -1, group: HTMLElement) {
    const index = CHOICES.findIndex((choice) => choice.id === reaction);
    const next = CHOICES[(index + direction + CHOICES.length) % CHOICES.length];
    setReaction(next.id);
    group.querySelector<HTMLButtonElement>(`[data-reaction="${next.id}"]`)?.focus();
  }

  return (
    <Shell>
      <Header title={copy.runway} action={<TextButton onClick={() => setView("look")}>{copy.look}</TextButton>} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="seam flex min-h-48 w-full flex-1 items-center justify-center overflow-hidden bg-surface">
          {videoUrl && !broken ? (
            <video
              key={videoUrl}
              src={videoUrl}
              className="max-h-full w-full bg-bg object-contain"
              controls
              playsInline
              autoPlay
              onError={() => setBroken(true)}
            />
          ) : draft ? (
            <img src={draft.image} alt={draft.spoken} className="max-h-full w-full object-contain" />
          ) : (
            <p className="p-6 text-center text-muted">{copy.noWalk}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-4">
        <p aria-live="polite" className="text-center text-muted">
          {broken ? copy.clipGone : busy ? copy.walking : status}
        </p>
        {mismatch && shotLabel ? (
          <p className="text-center text-sm">
            {copy.reshootNote} Last walk: {shotLabel}.
          </p>
        ) : null}
        <div>
          <p className="mb-2 text-sm text-muted" id="judges-label">
            {copy.judges}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="judges-label"
            className="grid grid-cols-3 gap-2"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(1, event.currentTarget);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(-1, event.currentTarget);
              }
            }}
          >
            {CHOICES.map((choice) => {
              const selected = reaction === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  data-reaction={choice.id}
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setReaction(choice.id)}
                  className={cn(
                    "h-12 rounded-md border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
                    selected ? "border-ink bg-accent font-extrabold text-accent-fg" : "border-line bg-cream text-fg",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button variant={mismatch || broken ? "primary" : "ghost"} disabled={busy || !draft} onClick={retryReaction}>
          {copy.tryReaction}
        </Button>
        </div>
      </div>
    </Shell>
  );
}
