import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { undoStillGood } from "@/lib/lab/closet";
import { useLab } from "@/lib/store";

export function UndoBar() {
  const undo = useLab((state) => state.undo);
  const restoreUndo = useLab((state) => state.restoreUndo);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!undo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [undo]);

  if (!undo || !undoStillGood(undo, now)) return null;
  const name = undo.kind === "look" ? undo.look.spoken : undo.piece.spoken;

  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-md border-2 border-line px-3 py-2">
      <p className="min-w-0 truncate text-sm">Dropped {name}.</p>
      <Button variant="ghost" className="shrink-0" onClick={restoreUndo}>
        {copy.undo}
      </Button>
    </div>
  );
}
