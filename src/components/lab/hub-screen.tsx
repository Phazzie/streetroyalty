import { useEffect, useState } from "react";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { UndoBar } from "@/components/lab/undo-bar";
import { copy } from "@/lib/copy";
import { useLab } from "@/lib/store";

const EXAMPLES = ["black hoodie", "wool trousers", "leather loafers"] as const;

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function HubScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const looks = useLab((state) => state.looks);
  const pieces = useLab((state) => state.pieces);
  const openSaved = useLab((state) => state.openSaved);
  const dropLook = useLab((state) => state.dropLook);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [hideInstall, setHideInstall] = useState(false);
  const wearing = pieces.filter((piece) => piece.selected).length;
  const tickets = useLab((state) => state.tickets);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <Shell>
      <Header
        title={copy.title}
        action={
          <>
            <TextButton onClick={() => setView("lock")}>{copy.face}</TextButton>
            <TextButton onClick={() => setView("board")}>{copy.board}</TextButton>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        <UndoBar />
        {draft ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <button
              type="button"
              onClick={() => setView("look")}
              aria-label={draft.spoken}
              className="relative min-h-0 flex-1"
            >
              <img src={draft.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
            </button>
            <p className="line-clamp-2 shrink-0 py-2 text-center text-sm">{draft.spoken}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-3">
            <p className="text-lg italic">{copy.crown}</p>
            <p>{copy.hubJob}</p>
            {pieces.length > 0 ? (
              <p className="text-sm text-muted">
                {pieces.length} pieces on the board. {wearing} selected.
              </p>
            ) : null}
          </div>
        )}
        {looks.length > 0 ? (
          <div className="flex shrink-0 gap-3 overflow-x-auto pb-2">
            {looks.map((look) => (
              <div key={look.id} className="w-24 shrink-0">
                <button type="button" onClick={() => openSaved(look.id)} className="w-full text-left" aria-label={look.spoken}>
                  <img src={look.image} alt="" loading="lazy" decoding="async" className="aspect-3/4 w-full rounded-md object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => dropLook(look.id)}
                  aria-label={`${copy.drop} ${look.spoken}`}
                  className="mt-1 h-11 w-full rounded-md border-2 border-line text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
                >
                  {copy.drop}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <Composer suggestions={draft ? [] : EXAMPLES} />
        <details className="mt-2 border-t border-line pt-2">
          <summary className="font-display text-xs font-bold tracking-widest text-muted uppercase">{copy.keepIt}</summary>
          <p className="mt-2 text-sm">{copy.pinned}</p>
          <p className="mt-1 text-sm">{copy.installHow}</p>
          {tickets.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {tickets.slice(0, 8).map((ticket) => (
                <li key={ticket.id} className="text-sm">
                  <span className="font-bold">{ticket.type}</span>
                  <span className="text-muted"> · {ticket.status}</span>
                  <span className="block truncate">{ticket.spokenDescription}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{copy.tickets} show up after a build.</p>
          )}
          {install && !hideInstall ? (
            <div className="mt-2 flex gap-2">
              <TextButton
                onClick={() => {
                  void install.prompt();
                  setHideInstall(true);
                }}
              >
                {copy.add}
              </TextButton>
              <TextButton onClick={() => setHideInstall(true)}>{copy.notNow}</TextButton>
            </div>
          ) : null}
        </details>
      </div>
    </Shell>
  );
}
