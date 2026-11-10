import { useState } from "react";
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

  return (
    <Shell>
      <Header action={<TextButton onClick={() => setView("look")}>{copy.look}</TextButton>} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="seam overflow-hidden bg-surface">
          {draft?.videoUrl && !broken ? (
            <video
              key={draft.videoUrl}
              src={draft.videoUrl}
              className="aspect-9/16 max-h-[28rem] w-full bg-bg object-contain"
              controls
              playsInline
              autoPlay
              onError={() => setBroken(true)}
            />
          ) : draft ? (
            <img src={draft.image} alt={draft.spoken} className="aspect-9/16 max-h-[28rem] w-full object-cover" />
          ) : (
            <div className="aspect-9/16 w-full" />
          )}
        </div>
        <p aria-live="polite" className="text-center text-muted">
          {broken ? copy.clipGone : status}
        </p>
        <div>
          <p className="mb-2 text-sm text-muted">{copy.judges}</p>
          <div role="radiogroup" aria-label={copy.judges} className="grid grid-cols-3 gap-2">
            {CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={reaction === choice.id}
                onClick={() => setReaction(choice.id)}
                className={cn(
                  "h-12 rounded-md border text-sm font-medium",
                  reaction === choice.id ? "border-ink bg-accent font-extrabold text-accent-fg" : "border-line bg-cream text-fg",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="ghost" disabled={busy || !draft} onClick={retryReaction}>
          {copy.tryReaction}
        </Button>
      </div>
    </Shell>
  );
}
