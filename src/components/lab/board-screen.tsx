import { useState } from "react";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { UndoBar } from "@/components/lab/undo-bar";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";

const EXAMPLES = ["black hoodie", "wool trousers", "leather loafers"] as const;

export function BoardScreen() {
  const setView = useLab((state) => state.setView);
  const pieces = useLab((state) => state.pieces);
  const togglePiece = useLab((state) => state.togglePiece);
  const dropPiece = useLab((state) => state.dropPiece);
  const rebuildPiece = useLab((state) => state.rebuildPiece);
  const requestLook = useLab((state) => state.requestLook);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useLab((state) => state.busy);
  const selected = pieces.filter((piece) => piece.selected).length;
  const filled = CATEGORIES.filter((category) => pieces.some((piece) => piece.category === category));

  return (
    <Shell>
      <Header title={copy.board} action={<TextButton onClick={() => setView("hub")}>{copy.hub}</TextButton>} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <UndoBar />
        {pieces.length === 0 ? (
          <p className="pt-6 text-center">{copy.emptyBoard}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {filled.map((category) => {
              const items = pieces.filter((piece) => piece.category === category);
              return (
                <section key={category}>
                  <h2 className="font-display text-sm font-bold tracking-widest text-muted uppercase">{category}</h2>
                  <div className={cn("mt-2 grid gap-3", items.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                    {items.map((piece) => (
                      <div key={piece.id}>
                        <button
                          type="button"
                          onClick={() => togglePiece(piece.id)}
                          aria-pressed={piece.selected}
                          className={cn(
                            "w-full overflow-hidden rounded-lg border-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
                            piece.selected ? "border-pipe" : "border-line",
                          )}
                        >
                          <img src={piece.image} alt={piece.spoken} className="aspect-square w-full object-cover" />
                          <span className="line-clamp-2 block px-2 pt-2 text-sm">{piece.spoken}</span>
                          <span className={cn("block px-2 pb-2 text-xs font-bold", !piece.selected && "invisible")}>
                            {copy.wearing}
                          </span>
                        </button>
                        {pending === piece.id ? (
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              className="h-11 flex-1 rounded-md border-2 border-ink text-sm font-bold"
                              onClick={() => {
                                rebuildPiece(piece.id);
                                setPending(null);
                              }}
                            >
                              {copy.buildIt}
                            </button>
                            <button
                              type="button"
                              className="h-11 flex-1 rounded-md border-2 border-line text-sm font-bold"
                              onClick={() => setPending(null)}
                            >
                              {copy.back}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPending(piece.id)}
                              className="h-11 rounded-md border-2 border-line text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
                            >
                              {copy.rebuild}
                            </button>
                            <button
                              type="button"
                              onClick={() => dropPiece(piece.id)}
                              aria-label={`${copy.drop} ${piece.spoken}`}
                              className="h-11 rounded-md border-2 border-line text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
                            >
                              {copy.drop}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <Composer suggestions={pieces.length === 0 ? EXAMPLES : []} />
        <Button className="mt-2 w-full" disabled={busy || selected === 0} onClick={requestLook}>
          {selected > 0 ? `${copy.putOn} (${selected})` : copy.putOn}
        </Button>
      </div>
    </Shell>
  );
}
