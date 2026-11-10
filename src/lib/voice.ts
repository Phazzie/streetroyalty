type SpeechHit = { transcript: string };
type SpeechList = ArrayLike<SpeechHit> & { isFinal: boolean };

type RecEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechList>;
};

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => Rec;
    webkitSpeechRecognition?: new () => Rec;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function micAvailable(): boolean {
  return recognitionCtor() !== null;
}

export function hush(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((item) => /en/i.test(item.lang) && /male|david|daniel|aaron|guy/i.test(item.name)) ??
    voices.find((item) => /en-US/i.test(item.lang));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function listen(handlers: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (kind: "blocked" | "missed") => void;
  onEnd: () => void;
}): { stop: () => void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  rec.onresult = (event) => {
    let partial = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const row = event.results[i];
      const said = row[0]?.transcript ?? "";
      if (row.isFinal) finalText += said;
      else partial += said;
    }
    if (partial.trim()) handlers.onPartial(partial.trim());
    if (finalText.trim()) handlers.onFinal(finalText.trim());
  };
  rec.onerror = (event) => {
    handlers.onError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "blocked" : "missed");
  };
  rec.onend = () => handlers.onEnd();
  try {
    rec.start();
  } catch {
    handlers.onError("missed");
    return null;
  }
  return {
    stop: () => {
      try {
        rec.abort();
      } catch {
        /* already closed */
      }
    },
  };
}
