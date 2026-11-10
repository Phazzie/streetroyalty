import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

export function BoardScreen() {
  const setView = useLab((state) => state.setView);
  const pieces = useLab((state) => state.pieces);
  const togglePiece = useLab((state) => state.togglePiece);
  const dropPiece = useLab((state) => state.dropPiece);
  const requestLook = useLab((state) => state.requestLook);
  const busy = useLab((state) => state.busy);
  const selected = pieces.some((piece) => piece.selected);

  return (
    <Shell>
      <Header action={<TextButton onClick={() => setView("hub")}>{copy.hub}</TextButton>} />
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        {pieces.length === 0 ? <p className="px-1 pb-4">{copy.emptyBoard}</p> : <p className="px-1 pb-3 text-sm text-muted">{copy.pick}</p>}
        <div className="flex flex-col gap-5">
          {CATEGORIES.map((category) => {
            const items = pieces.filter((piece) => piece.category === category);
            return (
              <section key={category}>
                <h2 className="px-5 text-sm font-medium text-muted">{category}</h2>
                {items.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-subtle">{copy.empty}</p>
                ) : (
                  <div className="mt-2 flex gap-3 overflow-x-auto px-5 pb-1">
                    {items.map((piece) => (
                      <div key={piece.id} className="relative w-40 shrink-0">
                        <button
                          type="button"
                          onClick={() => togglePiece(piece.id)}
                          aria-pressed={piece.selected}
                          className={cn(
                            "w-full overflow-hidden rounded-lg border-2 text-left",
                            piece.selected ? "border-pipe" : "border-line",
                          )}
                        >
                          <img src={piece.image} alt={piece.spoken} className="aspect-square w-full object-cover" />
                          <span className="clamp-2 block px-2 py-2 text-xs text-muted">{piece.spoken}</span>
                          {piece.selected ? <span className="block px-2 pb-2 text-xs font-medium">{copy.on}</span> : null}
                        </button>
                        <button
                          type="button"
                          aria-label={copy.drop}
                          onClick={() => dropPiece(piece.id)}
                          className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-bg/80 text-fg"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <div className="safe-bottom border-t border-line px-5 pt-3">
        <div className="mb-3">
          <Composer flush />
        </div>
        <Button className="w-full" size="lg" disabled={busy || !selected} onClick={requestLook}>
          {copy.putOn}
        </Button>
      </div>
    </Shell>
  );
}
