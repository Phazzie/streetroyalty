import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Status } from "@/components/lab/chrome";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { stopGeneration, useLab } from "@/lib/store";
import { listen } from "@/lib/voice";

export function Composer({
  placeholder = copy.typePiece,
  suggestions = [],
}: {
  placeholder?: string;
  suggestions?: readonly string[];
}) {
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && useLab.getState().busy) {
        stopGeneration();
        stopRef.current?.();
        stopRef.current = null;
        setListening(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    if (!text || busy) return;
    setDraft("");
    handleTranscript(text);
  }

  const micLabel = busy ? copy.stop : listening ? copy.listening : copy.talk;

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <form onSubmit={onSubmit} className="flex w-full gap-2">
        <Input
          id="say"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          disabled={busy}
        />
        <Button type="submit" variant="ghost" className="min-w-16 shrink-0" disabled={busy || draft.trim().length === 0}>
          {copy.go}
        </Button>
      </form>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMic}
          aria-label={micLabel}
          aria-pressed={listening}
          className={cn(
            "relative inline-flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
            busy || listening ? "bg-accent text-accent-fg" : "bg-cream text-fg",
            listening && "mic-live",
          )}
        >
          {busy ? <Square className="size-5" fill="currentColor" /> : <Mic className="size-6" />}
        </button>
        <p className="text-sm font-bold">{micLabel}</p>
      </div>
      <Status text={status} />
      {suggestions.length > 0 && !busy && draft.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleTranscript(suggestion)}
              className="h-11 rounded-full border-2 border-line bg-cream px-3 text-sm font-bold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
