import { Mic, MicOff, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { CatalogProduct } from "@/lib/pod/types";
import { renderArt } from "@/lib/say/art";
import { colorName, contrastInk } from "@/lib/say/colors";
import { fitIntent, ghostLayers, pickProduct, type ListedBlank } from "@/lib/say/fit";
import {
  applyUtterance,
  describeGarment,
  describeLine,
  emptyIntent,
  reviveIntent,
  type SayIntent,
  type SaySize,
} from "@/lib/say/parse";
import { getCatalogProduct, listCatalog, makeMockup, savePiece } from "@/lib/studio/api";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { listen, micAvailable } from "@/lib/voice";

const EXAMPLES = [
  "Put DO BETTER on the back of a black hoodie in pink, big",
  "A white tee that says free world in blue across the chest",
  "Hat with my name Dre on it",
] as const;

const KEEP = "sr-say-intent";

const POSTER_SIZE: Record<SaySize, number> = { small: 0.5, medium: 0.72, big: 1, huge: 1.3 };

const CSS = `
.say-poster { container-type: inline-size; }
.say-line { display: block; overflow-wrap: anywhere; transform-origin: 50% 50%; animation: say-stamp 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes say-stamp { from { opacity: 0; scale: 1.5; filter: blur(2px); } 60% { opacity: 1; scale: 0.96; filter: none; } to { scale: 1; } }
.say-caret { display: inline-block; width: 0.09em; height: 0.74em; margin-left: 0.08em; background: currentColor; animation: say-blink 1.1s steps(2, jump-none) infinite; }
@keyframes say-blink { from { opacity: 1; } to { opacity: 0; } }
.say-pop { animation: say-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes say-pop { from { transform: translateY(8px) rotate(-3deg) scale(0.9); box-shadow: 0 0 0 var(--color-pipe); } 55% { transform: translateY(-2px) rotate(1deg) scale(1.03); } to { transform: none; box-shadow: 3px 3px 0 var(--color-pipe); } }
.say-fresh { box-shadow: 3px 3px 0 var(--color-pipe); }
.say-bars { display: flex; align-items: center; gap: 5px; height: 44px; }
.say-bars i { display: block; width: 7px; height: 100%; background: currentColor; transform-origin: 50% 50%; animation: say-bar 780ms ease-in-out infinite alternate; }
.say-bars i:nth-child(2) { animation-delay: -520ms; }
.say-bars i:nth-child(3) { animation-delay: -260ms; }
.say-bars i:nth-child(4) { animation-delay: -640ms; }
.say-bars i:nth-child(5) { animation-delay: -130ms; }
@keyframes say-bar { from { transform: scaleY(0.22); } to { transform: scaleY(1); } }
.say-mockup { transition: opacity 240ms ease; }
.say-mockup[data-stale="true"] { opacity: 0.55; }
@media (prefers-reduced-motion: reduce) {
  .say-line, .say-pop, .say-caret, .say-bars i { animation: none; }
  .say-bars i { transform: scaleY(0.6); }
  .say-mockup { transition: none; }
}
`;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Poster({ intent, ground }: { intent: SayIntent; ground: string }) {
  const ink = contrastInk(ground);
  const longest = Math.max(4, ...intent.lines.map((line) => Math.min(line.text.length, 18)));
  return (
    <div
      className="say-poster flex min-h-36 flex-col items-center justify-center overflow-hidden border-2 border-ink px-3 py-5 text-center sm:min-h-44"
      style={{ backgroundColor: ground, color: ink }}
      aria-hidden="true"
    >
      {intent.lines.length === 0 ? (
        <span className="display" style={{ fontSize: "min(5.5rem, 30cqw)" }}>
          Say it
          <span className="say-caret" />
        </span>
      ) : (
        intent.lines.map((line, index) => (
          <span
            key={`${index}-${line.text}-${line.size}-${line.color}-${line.tilt}`}
            className={`say-line ${intent.font === "Outfit" ? "font-sans font-bold" : "display"}`}
            style={{
              color: line.color,
              rotate: `${line.tilt}deg`,
              textTransform: "none",
              lineHeight: 0.92,
              fontSize: `min(${(6.5 * POSTER_SIZE[line.size]).toFixed(2)}rem, ${((185 / longest) * POSTER_SIZE[line.size]).toFixed(1)}cqw)`,
            }}
          >
            {line.text}
          </span>
        ))
      )}
    </div>
  );
}

export function SayPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [intent, setIntent] = useState<SayIntent>(emptyIntent);
  const intentRef = useRef(intent);
  const [past, setPast] = useState<SayIntent[]>([]);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState("");
  const [partial, setPartial] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const [unsure, setUnsure] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState<boolean | null>(null);
  const [micNote, setMicNote] = useState("");
  const [catalog, setCatalog] = useState<ListedBlank[] | null>(null);
  const [details, setDetails] = useState<Record<string, CatalogProduct>>({});
  const [mockup, setMockup] = useState<{ key: string; url: string } | null>(null);
  const [previewNote, setPreviewNote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawFlight = useRef(createSingleFlight());
  const takeFlight = useRef(createSingleFlight());
  const wanted = useRef<{ key: string; request: Parameters<typeof makeMockup>[0]["data"] } | null>(
    null,
  );
  const drawn = useRef("");

  const commit = useCallback((next: SayIntent) => {
    intentRef.current = next;
    setIntent(next);
    try {
      sessionStorage.setItem(KEEP, JSON.stringify(next));
    } catch {
      /* Private windows can refuse storage. The piece still lives on the page. */
    }
  }, []);

  useEffect(() => {
    setCanListen(micAvailable());
    try {
      const kept = reviveIntent(JSON.parse(sessionStorage.getItem(KEEP) ?? "null"));
      if (kept && kept.lines.length > 0) {
        intentRef.current = kept;
        setIntent(kept);
      }
    } catch {
      /* Nothing kept. */
    }
    void listCatalog({ data: { offset: 0, limit: 24 } })
      .then((page) => setCatalog(page.products))
      .catch(() => {
        setCatalog([]);
        setPreviewNote("The blanks did not load. Check the connection and load the page again.");
      });
    return () => stopRef.current?.();
  }, []);

  const listed = useMemo(
    () => (catalog ? (pickProduct(intent.blank, catalog) ?? catalog[0] ?? null) : null),
    [catalog, intent.blank],
  );
  const listedId = listed?.id ?? "";
  const product = listedId ? (details[listedId] ?? null) : null;

  useEffect(() => {
    if (!listedId || details[listedId]) return;
    let live = true;
    void getCatalogProduct({ data: { productId: listedId } })
      .then((detail) => {
        if (live) setDetails((current) => ({ ...current, [listedId]: detail }));
      })
      .catch(() => {
        if (live) setPreviewNote("That blank did not load. Try again in a moment.");
      });
    return () => {
      live = false;
    };
  }, [details, listedId]);

  const fit = useMemo(() => (product ? fitIntent(intent, product) : null), [intent, product]);
  const ground = fit?.colorHex ?? intent.garmentColor;
  const hasWords = intent.lines.length > 0;

  const mockupKey = useMemo(() => {
    if (!fit || !fit.variantId) return "";
    return JSON.stringify([fit.productId, fit.variantId, fit.placement, fit.layers]);
  }, [fit]);

  const draw = useCallback(() => {
    void drawFlight
      .current(async () => {
        const job = wanted.current;
        if (!job) return true;
        try {
          const result = await makeMockup({ data: job.request });
          setMockup({ key: job.key, url: result.mockupUrl });
          setPreviewNote("");
        } catch {
          setPreviewNote("The preview did not draw this time. Your piece is still here.");
        }
        drawn.current = job.key;
        return true;
      })
      .then((ran) => {
        // A change that arrived while this one was drawing gets its own turn.
        if (ran && wanted.current && wanted.current.key !== drawn.current) draw();
      });
  }, []);

  useEffect(() => {
    if (!fit || !mockupKey) return;
    wanted.current = {
      key: mockupKey,
      request: {
        productId: fit.productId,
        variantId: fit.variantId,
        placement: fit.placement,
        layers: fit.layers.length > 0 ? fit.layers : ghostLayers(fit.colorHex),
      },
    };
    const timer = window.setTimeout(draw, 280);
    return () => window.clearTimeout(timer);
  }, [draw, fit, mockupKey]);

  function undo() {
    const last = past[past.length - 1];
    if (!last) return;
    setPast((current) => current.slice(0, -1));
    commit(last);
    setFresh([]);
    setUnsure([]);
    setHeard("Undid the last change.");
  }

  function apply(text: string) {
    const said = text.trim();
    if (!said) return;
    setPartial("");
    setDraft("");
    setNote("");
    if (/^(?:undo|go back|take that back|undo that)[.!]?$/i.test(said)) {
      undo();
      return;
    }
    const current = intentRef.current;
    const result = applyUtterance(current, said);
    setHeard(said);
    setFresh(result.understood);
    setUnsure(result.unsure);
    if (JSON.stringify(result.intent) !== JSON.stringify(current)) {
      setPast((stack) => [...stack.slice(-29), current]);
      commit(result.intent);
    }
  }

  function stopListening() {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }

  function onMic() {
    if (listening) {
      stopListening();
      return;
    }
    setMicNote("");
    const handle = listen({
      onPartial: (text) => setPartial(text),
      onFinal: (text) => apply(text),
      onError: (kind) =>
        setMicNote(
          kind === "blocked"
            ? "The mic is blocked in this browser. Type it below. It does the same thing."
            : "Did not hear that. Tap and try again, or type it.",
        ),
      onEnd: () => {
        stopRef.current = null;
        setListening(false);
      },
    });
    if (!handle) {
      setMicNote("The mic did not start. Type it below. It does the same thing.");
      return;
    }
    stopRef.current = handle.stop;
    setListening(true);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  function startLine() {
    setDraft("Add a line that says ");
    inputRef.current?.focus();
  }

  function take() {
    if (!fit || !hasWords) return;
    void takeFlight.current(async () => {
      setBusy(true);
      setNote("");
      try {
        if (user) {
          const saved = await savePiece({
            data: {
              title: fit.title,
              productId: fit.productId,
              variantId: fit.variantId,
              placement: fit.placement,
              layers: fit.layers,
              mockupUrl: mockup && mockup.key === mockupKey ? mockup.url : null,
            },
          });
          sessionStorage.removeItem(KEEP);
          await navigate({ to: "/studio", search: { design: saved.id } });
        } else {
          const art = await renderArt(intentRef.current);
          sessionStorage.setItem("sr-print-art", art);
          await navigate({ to: "/studio" });
        }
      } catch (error) {
        setNote(messageOf(error, "That did not go through. Try again."));
      } finally {
        setBusy(false);
      }
    });
  }

  const followUps: { label: string; say?: string; run?: () => void }[] = [
    { label: "Bigger", say: "bigger" },
    { label: "Smaller", say: "smaller" },
    intent.placement === "back"
      ? { label: "On the front", say: "on the front" }
      : { label: "On the back", say: "on the back" },
    { label: "Make it pink", say: "make it hot pink" },
    { label: "Make it white", say: "make it white" },
    { label: "Tilt it", say: "tilt it" },
    intent.lines.every((line) => line.text === line.text.toLowerCase())
      ? { label: "All caps", say: "all caps" }
      : { label: "Lowercase", say: "lowercase" },
    { label: "Add a line", run: startLine },
  ];

  const stale = Boolean(mockup && mockup.key !== mockupKey);
  const signedOut = !isPending && !user;

  return (
    <div className="mx-auto max-w-5xl">
      <style>{CSS}</style>
      <p className="tag">Talk or type</p>
      <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Say it</h1>
      <p className="mt-2 mb-5 max-w-xl text-lg text-muted">
        Tell it what you want on a piece, in your own words. It builds a real start you can take to
        the studio.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <section aria-label="Say your piece" className="flex min-w-0 flex-col gap-4">
          <Poster intent={intent} ground={ground} />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onMic}
              disabled={canListen === false}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Tap and talk"}
              className={`relative inline-flex size-28 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-solid focus-visible:outline-fg active:scale-[0.97] disabled:border-line disabled:bg-line disabled:text-muted ${
                canListen === false ? "" : "sticker-shadow bg-accent text-accent-fg"
              } ${listening ? "mic-live" : ""}`}
            >
              {canListen === false ? (
                <MicOff className="size-12" />
              ) : listening ? (
                <span className="say-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <Mic className="size-14" strokeWidth={2.2} />
              )}
            </button>
            <div className="min-w-0">
              <p className="font-display text-2xl leading-tight">
                {canListen === false ? "Type it" : listening ? "Listening" : "Tap and talk"}
              </p>
              <p className="mt-1 text-muted" role="status">
                {canListen === false
                  ? "This browser cannot listen. Type it in the box. It does exactly the same thing."
                  : micNote ||
                    (listening
                      ? "Say the garment, the words and the colour."
                      : "Or type it in the box. Both do the same thing.")}
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="say-box" className="sr-only">
              Type what you want
            </label>
            <input
              id="say-box"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                hasWords ? "Change it. Try: bigger" : "A black hoodie that says do better"
              }
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="go"
              maxLength={300}
              className="h-16 w-full min-w-0 flex-1 rounded-md border-2 border-ink bg-cream px-4 font-sans text-lg text-fg outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg"
            />
            <Button type="submit" size="lg" className="h-16 sm:min-w-32" disabled={!draft.trim()}>
              Make it
            </Button>
          </form>

          <div aria-live="polite" className="flex min-h-12 flex-col gap-1">
            {listening && partial ? (
              <p className="text-lg">
                <span className="text-muted">Hearing: </span>
                {partial}
              </p>
            ) : heard ? (
              <p className="text-lg">
                <span className="text-muted">Heard: </span>
                {heard}
              </p>
            ) : null}
            {unsure.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-line bg-surface px-3 py-2">
                <p>
                  <span className="text-muted">Did not catch: </span>
                  {unsure.join(", ")}
                </p>
                {hasWords && heard && fresh.length === 0 ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => apply(`add a line that says "${heard.replace(/"/g, "")}"`)}
                  >
                    Print those words
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {hasWords ? (
            <div>
              <h2 className="eyebrow mb-2 text-muted">Change it</h2>
              <div className="flex flex-wrap gap-2">
                {followUps.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    className="chip"
                    onClick={() => (chip.run ? chip.run() : apply(chip.say ?? chip.label))}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="eyebrow mb-2 text-muted">Not sure what to say. Tap one</h2>
              <ul className="flex flex-col gap-2">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => apply(example)}
                      className="min-h-14 w-full border-2 border-ink bg-surface px-4 py-3 text-left text-lg leading-snug transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg active:translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      &ldquo;{example}&rdquo;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={undo} disabled={past.length === 0}>
              <Undo2 className="size-5" aria-hidden="true" />
              Undo
            </Button>
            <Button
              variant="ghost"
              onClick={() => apply("start over")}
              disabled={!hasWords && past.length === 0}
            >
              Start over
            </Button>
          </div>
        </section>

        <section aria-label="Your piece" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4">
          <div className="relative border-2 border-ink bg-surface">
            {mockup ? (
              <img
                src={mockup.url}
                alt={
                  fit
                    ? `Preview drawing of a ${fit.colorName.toLowerCase()} ${fit.productName}${hasWords ? ` that reads ${intent.lines.map((line) => line.text).join(", ")}` : ""}`
                    : "Preview drawing"
                }
                data-stale={stale}
                className="say-mockup block aspect-[11/12] w-full object-cover"
              />
            ) : (
              <div className="pending-pulse flex aspect-[11/12] w-full items-center justify-center text-muted">
                {catalog && catalog.length === 0 ? "No blanks to show." : "Drawing the preview"}
              </div>
            )}
            <span className="tape absolute top-3 left-3">Preview. A drawing, not a photo</span>
          </div>

          <h2 className="sr-only">What it understood</h2>
          <ul className="flex flex-wrap gap-2">
            {[
              { label: describeGarment(fit ? { ...intent, garmentColor: fit.colorHex } : intent) },
              { label: fit?.placementTitle ?? "Front" },
              ...intent.lines.map((line) => ({ label: describeLine(line), dot: line.color })),
              ...(intent.font === "Outfit" ? [{ label: "Plain letters" }] : []),
            ].map((chip: { label: string; dot?: string }, index) => {
              const isFresh = fresh.includes(chip.label);
              return (
                <li
                  key={`${index}-${chip.label}`}
                  className={`inline-flex min-h-10 items-center gap-2 border-2 border-ink bg-cream px-3 py-1 font-bold ${isFresh ? "say-pop say-fresh" : ""}`}
                >
                  {chip.dot ? (
                    <span
                      className="size-4 shrink-0 rounded-full border-2 border-ink"
                      style={{ backgroundColor: chip.dot }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="min-w-0 break-words">{chip.label}</span>
                </li>
              );
            })}
          </ul>

          {fit && fit.notes.length > 0 ? (
            <ul className="flex flex-col gap-1 border-2 border-line bg-surface px-3 py-2 text-muted">
              {fit.notes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {previewNote ? <p className="text-muted">{previewNote}</p> : null}

          <Button
            size="lg"
            className="h-16 w-full text-lg"
            onClick={take}
            disabled={!fit || !hasWords || busy}
          >
            {busy ? "Taking it over" : "Take it to the studio"}
          </Button>
          {!hasWords ? (
            <p className="text-muted">Say the words you want on it first.</p>
          ) : signedOut ? (
            <p className="text-muted">
              You are not signed in, so the words arrive in the studio as a picture on the house
              tee, in {colorName(intent.lines[0]?.color ?? "#ffffff")} and the rest as you said it.{" "}
              <Link to="/login" className="font-bold text-fg underline underline-offset-4">
                Sign in first
              </Link>{" "}
              and come back here to keep the blank, the colour and words you can still edit. This
              piece will wait.
            </p>
          ) : (
            <p className="text-muted">
              Saves it to your account as a draft, then opens it in the studio with every word still
              editable. Nothing is ordered.
            </p>
          )}
          {note ? (
            <p role="alert" className="border-2 border-ink bg-surface px-3 py-2">
              {note}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
