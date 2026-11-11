import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Status } from "@/components/lab/chrome";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { paidPlan } from "@/lib/split-pieces";
import { stopGeneration, useLab } from "@/lib/store";
import type { View } from "@/lib/types";
import { listen } from "@/lib/voice";

function confirmFor(text: string, view: View): { prompt: string; yes: string } | null {
  const plan = paidPlan(text, view);
  if (plan.kind === "pieces") {
    const names = plan.pieces.map((piece) => piece.spoken).join(", ");
    return { prompt: `Build ${names}?`, yes: copy.buildIt };
  }
  if (plan.kind === "tweak") return { prompt: `Change the look to ${text}?`, yes: copy.changeIt };
  if (plan.kind === "wear") return { prompt: "Put the selected pieces on you?", yes: copy.putOn };
  if (plan.kind === "runway") return { prompt: "Send this look down the runway?", yes: copy.runway };
  if (plan.kind === "again") return { prompt: "Build that again?", yes: copy.buildIt };
  return null;
}

export function Composer({
  placeholder = copy.typePiece,
  suggestions = [],
}: {
  placeholder?: string;
  suggestions?: readonly string[];
}) {
  const busy = useLab((state) => state.busy);
  const status = useLab((state) => state.status);
  const view = useLab((state) => state.view);
  const setStatus = useLab((state) => state.setStatus);
  const handleTranscript = useLab((state) => state.handleTranscript);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pending) {
        setPending(null);
        return;
      }
      if (useLab.getState().busy) {
        stopGeneration();
        stopRef.current?.();
        stopRef.current = null;
        setListening(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  function stopListen() {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }

  function stage(text: string) {
    const cleaned = text.trim();
    if (!cleaned || useLab.getState().busy) return;
    setDraft("");
    const ask = confirmFor(cleaned, useLab.getState().view);
    if (!ask) {
      handleTranscript(cleaned);
      return;
    }
    setPending(cleaned);
  }

  function startListen() {
    const handle = listen({
      onPartial: (text) => setStatus(text),
      onFinal: (text) => stage(text),
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
    stage(draft);
  }

  const micLabel = busy ? copy.stop : listening ? copy.listening : copy.talk;
  const ask = pending ? confirmFor(pending, view) : null;

  if (ask && pending) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{ask.prompt}</p>
        <div className="flex gap-2">
          <Button
            autoFocus
            className="flex-1"
            onClick={() => {
              handleTranscript(pending);
              setPending(null);
            }}
          >
            {ask.yes}
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setDraft(pending);
              setPending(null);
            }}
          >
            {copy.back}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={busy}>
      <form onSubmit={onSubmit} className="flex w-full items-center gap-2">
        <Input
          id="say"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="ghost" className="min-w-16" disabled={busy || draft.trim().length === 0}>
          {copy.go}
        </Button>
        <button
          type="button"
          onClick={onMic}
          aria-label={micLabel}
          aria-pressed={listening}
          className={cn(
            "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-[opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
            busy || listening ? "bg-accent text-accent-fg" : "bg-cream text-fg",
            listening && "mic-live",
          )}
        >
          {busy ? <Square className="size-5" fill="currentColor" /> : <Mic className="size-6" />}
        </button>
      </form>
      {status ? <Status text={status} /> : null}
      {suggestions.length > 0 && !busy && draft.length === 0 ? (
        <div className="flex gap-2 overflow-x-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => stage(suggestion)}
              className="h-11 shrink-0 rounded-full border-2 border-line bg-cream px-3 text-sm font-bold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
