import { useEffect, useState } from "react";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
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
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-4 py-4 *:shrink-0">
        {pieces.length === 0 && !draft ? (
          <div className="flex flex-col gap-2">
            <p className="text-lg italic">{copy.crown}</p>
            <p>{copy.hubJob}</p>
          </div>
        ) : null}
        {pieces.length > 0 ? (
          <p className="text-sm text-muted">
            {pieces.length} pieces on the board. {wearing} selected.
          </p>
        ) : null}
        {draft ? (
          <button type="button" onClick={() => setView("look")} className="text-left">
            <img src={draft.image} alt="" className="seam aspect-3/4 w-full object-cover" />
            <span className="mt-2 line-clamp-2 block text-sm">{draft.spoken}</span>
          </button>
        ) : null}
        {looks.length > 0 ? (
          <section>
            <h2 className="font-display text-sm font-bold tracking-widest text-ink uppercase">{copy.savedHead}</h2>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
              {looks.map((look) => (
                <div key={look.id} className="w-28 shrink-0">
                  <button type="button" onClick={() => openSaved(look.id)} className="w-full text-left">
                    <img src={look.image} alt="" className="seam aspect-3/4 w-full object-cover" />
                    <span className="mt-1 line-clamp-2 block text-xs text-muted">{look.spoken}</span>
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
          </section>
        ) : null}
        <details className="border-2 border-ink bg-mint px-3 py-3">
          <summary className="font-display text-sm font-extrabold tracking-widest uppercase">{copy.keepIt}</summary>
          <p className="mt-2 text-sm">{copy.pinned}</p>
          <p className="mt-1 text-sm">{copy.installHow}</p>
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
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <Composer suggestions={EXAMPLES} />
      </div>
    </Shell>
  );
}
