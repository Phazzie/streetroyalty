import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { usePaidAiAccess } from "@/components/ai/use-paid-ai";
import { ART_STYLES } from "@/lib/ai/art-styles";
import { aiAllowance, designChat } from "@/lib/ai/design-chat";
import { isUnauthorized } from "@/lib/ai/access";
import {
  cheyDemo,
  localAnswer,
  type ChatContext,
  type ChatLine,
  type ChatOp,
  type LocalDesign,
} from "@/lib/studio/chat";

type ArtAsk = Extract<ChatOp, { op: "make_art" }>;

export type RunResult = { changed: number; skipped: string[] };

type Bubble = {
  id: number;
  role: "user" | "assistant";
  text: string;
  demo?: boolean;
  /** Set on an assistant line that is waiting on a yes for paid art. */
  art?: ArtAsk;
  artState?: "asking" | "drawing" | "done" | "skipped";
};

const SUGGESTIONS = [
  "Make the text red",
  "Bigger, and move it up",
  "Put the Chicago skyline on the back",
  "Old English font",
  "Give it a white outline",
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Talk to the studio. Words become real edits on the layers of the real blank.
 * Plain edits read locally for free; signed in, the AI reads anything. New AI art
 * always asks first, because it costs the shop money.
 */
export function DesignChat({
  ready,
  context,
  local,
  run,
  drawArt,
  cheyBlankId,
}: {
  ready: boolean;
  context: () => ChatContext | null;
  local: () => LocalDesign | null;
  run: (ops: ChatOp[]) => Promise<RunResult>;
  drawArt: (ask: ArtAsk) => Promise<string | null>;
  cheyBlankId: string | null;
}) {
  const access = usePaidAiAccess();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [allowance, setAllowance] = useState<{ live: boolean; text: number; image: number } | null>(null);
  const nextId = useRef(1);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (access.pending || access.signedOut) return;
    void aiAllowance()
      .then(setAllowance)
      .catch(() => setAllowance(null));
  }, [access.pending, access.signedOut]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [bubbles]);

  const ai = !access.blocked && allowance?.live === true;

  function push(bubble: Omit<Bubble, "id">): number {
    const id = nextId.current++;
    setBubbles((current) => [...current, { ...bubble, id }].slice(-40));
    return id;
  }

  function patchBubble(id: number, patch: Partial<Bubble>) {
    setBubbles((current) => current.map((bubble) => (bubble.id === id ? { ...bubble, ...patch } : bubble)));
  }

  function history(): ChatLine[] {
    return bubbles
      .filter((bubble) => !bubble.demo)
      .slice(-6)
      .map((bubble) => ({ role: bubble.role, text: bubble.text }));
  }

  async function answer(message: string): Promise<{ reply: string; ops: ChatOp[] }> {
    const design = local();
    const fallback = design ? localAnswer(message, design) : null;
    const plain =
      "I can change colours, size, position, words, fonts and spots, and add the Chicago skyline or star, without the AI.";
    if (!ai) {
      if (fallback) return fallback;
      if (access.signedOut) return { reply: `${plain} Sign in and I can take on anything you can describe.`, ops: [] };
      return { reply: `${plain} The full AI chat isn't switched on yet.`, ops: [] };
    }
    const ctx = context();
    if (!ctx) return { reply: "Pick a blank first.", ops: [] };
    try {
      const result = await designChat({ data: { message, context: ctx, history: history() } });
      if (result.ok) {
        setAllowance((current) => (current ? { ...current, text: result.textLeft } : current));
        return { reply: result.reply, ops: result.ops };
      }
      if (result.kind === "limit") {
        setAllowance((current) => (current ? { ...current, text: 0 } : current));
        return fallback ?? { reply: `That's today's AI chats used up. ${plain}`, ops: [] };
      }
      return fallback ?? { reply: "That one got away from me. Say it another way?", ops: [] };
    } catch (error) {
      if (isUnauthorized(error)) return fallback ?? { reply: "Sign in again and I can take that on.", ops: [] };
      return fallback ?? { reply: "That one got away from me. Say it another way?", ops: [] };
    }
  }

  async function act(reply: string, ops: ChatOp[], demo = false) {
    const art = ops.find((op): op is ArtAsk => op.op === "make_art");
    const result = await run(ops.filter((op) => op.op !== "make_art"));
    const extra = result.skipped.length > 0 ? ` ${[...new Set(result.skipped)].join(" ")}` : "";
    push({
      role: "assistant",
      text: `${reply}${extra}`,
      demo,
      ...(art ? { art, artState: "asking" as const } : {}),
    });
  }

  async function send(raw: string) {
    const message = raw.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!message || busy || playing || !ready) return;
    setDraft("");
    push({ role: "user", text: message });
    setBusy(true);
    try {
      const { reply, ops } = await answer(message);
      await act(reply, ops);
    } catch (error) {
      push({ role: "assistant", text: error instanceof Error ? error.message : "That did not land." });
    } finally {
      setBusy(false);
    }
  }

  async function playDemo() {
    if (!cheyBlankId || playing || busy || !ready) return;
    setPlaying(true);
    try {
      for (const turn of cheyDemo(cheyBlankId)) {
        const id = push({ role: "user", text: "", demo: true });
        for (let at = 1; at <= turn.user.length; at += 3) {
          patchBubble(id, { text: turn.user.slice(0, at) });
          await wait(14);
        }
        patchBubble(id, { text: turn.user });
        setBusy(true);
        await wait(650);
        setBusy(false);
        await act(turn.reply, turn.ops, true);
        await wait(1500);
      }
    } finally {
      setBusy(false);
      setPlaying(false);
    }
  }

  async function confirmArt(bubble: Bubble) {
    if (!bubble.art) return;
    patchBubble(bubble.id, { artState: "drawing" });
    const failure = await drawArt(bubble.art);
    if (failure) {
      patchBubble(bubble.id, { artState: "asking" });
      push({ role: "assistant", text: failure });
      return;
    }
    patchBubble(bubble.id, { artState: "done" });
    setAllowance((current) => (current ? { ...current, image: Math.max(0, current.image - 1) } : current));
  }

  const styleLabel = (id: string) => ART_STYLES.find((style) => style.id === id)?.label ?? id;

  return (
    <section className="studio-card chat-card border-2 border-ink bg-surface" aria-label="Design chat">
      <div className="flex items-center justify-between gap-3 border-b-2 border-line px-4 py-3">
        <h2 className="font-display text-sm tracking-wide uppercase">Talk it into shape</h2>
        <span className="text-right text-[0.7rem] leading-tight text-muted" aria-live="polite">
          {ai ? `${allowance?.text ?? 0} AI chats left today` : access.signedOut ? "Simple edits, no sign-in" : "Simple edits"}
        </span>
      </div>

      {bubbles.length === 0 ? (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted">
            Say what you want and it happens on the piece. "Make the words red." "Bigger, move it up." "Skyline on the back."
          </p>
          {cheyBlankId ? (
            <button
              type="button"
              onClick={() => void playDemo()}
              disabled={!ready || playing}
              className="chey-demo group relative overflow-hidden border-2 border-ink p-3 text-left disabled:opacity-60"
            >
              <span className="relative z-10 block font-display text-[0.65rem] tracking-[0.2em] text-[#f2ece4]/70 uppercase">
                Watch it work
              </span>
              <span className="chey-word relative z-10 block text-[1.7rem] leading-none text-[#e0182d]">CHEY SOCIETY</span>
              <span className="relative z-10 mt-1 block text-xs text-[#f2ece4]">
                A black hoodie built in four messages: red type, the skyline on the back, a star on the sleeve.
              </span>
              <svg
                viewBox="0 0 1800 500"
                aria-hidden="true"
                className="absolute right-0 bottom-0 h-10 w-auto opacity-25 transition-opacity group-hover:opacity-40"
              >
                <path
                  fill="#e0182d"
                  d="M0 500V440h70v60zM524 500V150h36V96h40V58h44v62h36V200h4V500zM1068 500V170h14V120h14V84h12V20h4v64h12v36h14v50h14V500zM1196 500V64h74V500zM1282 500V150l34-46 34 46V500zM1388 500l14-438h66l14 438z"
                />
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        <ol
          ref={listRef}
          className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3"
          aria-label="Conversation"
          aria-live="polite"
        >
          {bubbles.map((bubble) => (
            <li
              key={bubble.id}
              className={`max-w-[88%] px-3 py-2 text-sm ${bubble.role === "user" ? "self-end bg-accent text-accent-fg" : "self-start border-2 border-line bg-night text-fg"}`}
            >
              {bubble.demo && bubble.role === "user" ? (
                <span className="mb-0.5 block font-display text-[0.55rem] tracking-[0.2em] uppercase opacity-70">Example</span>
              ) : null}
              {bubble.text}
              {bubble.art && bubble.artState !== "skipped" ? (
                <div className="mt-2 border-t-2 border-line pt-2">
                  {bubble.artState === "done" ? (
                    <p className="text-xs text-muted">Drawn and on the piece.</p>
                  ) : (
                    <>
                      <p className="text-xs">
                        New AI art: "{bubble.art.idea}" in {styleLabel(bubble.art.style)}. It uses 1 of your{" "}
                        {allowance?.image ?? 0} AI pictures left today.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="chip chip-on"
                          disabled={bubble.artState === "drawing" || (allowance?.image ?? 0) <= 0}
                          onClick={() => void confirmArt(bubble)}
                        >
                          {bubble.artState === "drawing" ? "Drawing" : "Draw it"}
                        </button>
                        <button
                          type="button"
                          className="chip"
                          disabled={bubble.artState === "drawing"}
                          onClick={() => patchBubble(bubble.id, { artState: "skipped" })}
                        >
                          Not now
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
          {busy ? (
            <li className="self-start border-2 border-line bg-night px-3 py-2" aria-label="Working">
              <span className="chat-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </li>
          ) : null}
        </ol>
      )}

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2" role="group" aria-label="Try saying">
        {SUGGESTIONS.map((line) => (
          <button
            key={line}
            type="button"
            className="chip shrink-0 text-xs"
            disabled={busy || playing || !ready}
            onClick={() => void send(line)}
          >
            {line}
          </button>
        ))}
        {bubbles.length > 0 && cheyBlankId ? (
          <button
            type="button"
            className="chip shrink-0 text-xs"
            disabled={busy || playing || !ready}
            onClick={() => void playDemo()}
          >
            Chey Society example
          </button>
        ) : null}
      </div>

      <form
        className="flex gap-2 border-t-2 border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Tell the studio what to change
        </label>
        <input
          id="chat-input"
          value={draft}
          maxLength={500}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={playing ? "Watching the example" : "Make the text red"}
          disabled={playing}
          className="h-12 min-w-0 flex-1 border-2 border-ink bg-cream px-3 text-fg placeholder:text-muted"
        />
        <Button type="submit" disabled={busy || playing || !ready || !draft.trim()}>
          Send
        </Button>
      </form>
      {access.signedOut ? (
        <p className="px-4 pb-3 text-xs text-muted">
          <Link to="/login" className="underline">
            Sign in
          </Link>{" "}
          to let the AI take anything you can describe.
        </p>
      ) : null}
    </section>
  );
}
