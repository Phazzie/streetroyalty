import { useEffect, useState } from "react";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { copy } from "@/lib/copy";
import { useLab } from "@/lib/store";

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
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [hideInstall, setHideInstall] = useState(false);

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
        action={
          <div className="flex">
            <TextButton onClick={() => setView("lock")}>{copy.face}</TextButton>
            <TextButton onClick={() => setView("board")}>{copy.board}</TextButton>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto py-5">
        {pieces.length === 0 && !draft ? (
          <div className="flex flex-col gap-2 px-1">
            <p className="text-lg italic">{copy.crown}</p>
            <p>{copy.hubJob}</p>
          </div>
        ) : null}
        {draft ? (
          <button type="button" onClick={() => setView("look")} className="px-4 text-left">
            <img src={draft.image} alt={draft.spoken} className="seam aspect-3/4 w-full object-cover" />
          </button>
        ) : null}
        <Composer prominent />
        <section className="mx-4 border-2 border-dashed border-ink bg-mint px-3 py-3">
          <p className="font-display text-xs font-extrabold tracking-widest uppercase">Keep it</p>
          <p className="mt-1 text-sm">{copy.pinned}</p>
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
        </section>
        {looks.length > 0 ? (
          <section>
            <h2 className="px-4 font-display text-sm font-bold tracking-widest text-ink uppercase">{copy.savedHead}</h2>
            <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-2">
              {looks.map((look) => (
                <button key={look.id} type="button" onClick={() => openSaved(look.id)} className="w-24 shrink-0">
                  <img src={look.image} alt={look.spoken} className="seam aspect-3/4 w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
