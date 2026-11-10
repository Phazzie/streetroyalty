import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { useLab, stopGeneration } from "@/lib/store";
import { listen } from "@/lib/voice";
import { cn } from "@/lib/cn";
import { Status } from "@/components/lab/chrome";

export function Composer({ prominent = false, flush = false }: { prominent?: boolean; flush?: boolean }) {
  const busy = useLab((state) => state.busy);
  const status = useLab((state) => state.status);
  const setStatus = useLab((state) => state.setStatus);
  const handleTranscript = useLab((state) => state.handleTranscript);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  function stopListen() {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }

  function startListen() {
    const handle = listen({
      onPartial: (text) => setStatus(text),
      onFinal: (text) => {
        setDraft("");
        handleTranscript(text);
      },
      onError: (kind) => setStatus(kind === "blocked" ? copy.micBlocked : copy.missedSpeech),
      onEnd: () => {
        stopRef.current = null;
        setListening(false);
      },
    });
    if (!handle) {
      setStatus(copy.micBlocked);
      return;
    }
    stopRef.current = handle.stop;
    setListening(true);
    setStatus(copy.listening);
  }

  function onMic() {
    if (busy) {
      stopGeneration();
      stopListen();
      return;
    }
    if (listening) {
      stopListen();
      setStatus("");
      return;
    }
    startListen();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    handleTranscript(text);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={onMic}
        aria-label={busy ? copy.stop : copy.talk}
        aria-pressed={listening}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg",
          prominent ? "size-32" : "size-16",
          busy || prominent ? "border-2 border-ink bg-accent text-accent-fg" : "border-2 border-ink bg-cream text-fg",
          listening && "mic-live",
        )}
      >
        {busy ? <Square className={prominent ? "size-8" : "size-5"} fill="currentColor" /> : <Mic className={prominent ? "size-10" : "size-6"} />}
      </button>
      {busy ? <p className="text-sm font-medium">{copy.stop}</p> : null}
      <Status text={status} />
      <form onSubmit={onSubmit} className={cn("flex w-full gap-2", !flush && "px-5")}>
        <Input
          id="say"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.typeIt}
          aria-label={copy.typeIt}
          autoComplete="off"
        />
        <Button type="submit" variant="ghost" className="shrink-0">
          {copy.go}
        </Button>
      </form>
    </div>
  );
}
