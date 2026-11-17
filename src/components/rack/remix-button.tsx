import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { remixPiece } from "@/lib/social/remix-api";
import { createSingleFlight } from "@/lib/ui/single-flight";

const CSS = `
.sr-rx-fork { width: 2rem; height: 1.25rem; flex: none; overflow: visible; }
.sr-rx-fork path { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; }
.sr-rx-copy { stroke: var(--color-pipe) !important; stroke-dasharray: 22; stroke-dashoffset: 0; }
.sr-rx-copy-dot { fill: var(--color-pipe); transform-box: fill-box; transform-origin: center; }
.sr-rx-btn:hover .sr-rx-copy, .sr-rx-btn:focus-visible .sr-rx-copy {
  animation: sr-rx-draw 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.sr-rx-btn:hover .sr-rx-copy-dot, .sr-rx-btn:focus-visible .sr-rx-copy-dot {
  animation: sr-rx-pop 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.sr-rx-btn[data-busy="true"] .sr-rx-copy { animation: sr-rx-draw 900ms ease-in-out infinite; }
.sr-rx-btn[data-busy="true"] .sr-rx-copy-dot { animation: sr-rx-pop 900ms ease-in-out infinite; }
@keyframes sr-rx-draw { from { stroke-dashoffset: 22; } to { stroke-dashoffset: 0; } }
@keyframes sr-rx-pop { 0%, 55% { transform: scale(0); } 80% { transform: scale(1.5); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .sr-rx-btn .sr-rx-copy, .sr-rx-btn .sr-rx-copy-dot { animation: none !important; }
}
`;

function signedOut(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { name?: unknown; message?: unknown; status?: unknown };
  return (
    error.status === 401 || error.name === "UnauthorizedError" || error.message === "Unauthorized"
  );
}

/** One line splitting in two: the original keeps going and your copy peels off it. */
function Fork() {
  return (
    <svg viewBox="0 0 32 20" className="sr-rx-fork" aria-hidden="true">
      <path d="M2 6h28" />
      <path className="sr-rx-copy" d="M10 6c5 0 4 9 9 9h8" />
      <circle cx="4" cy="6" r="3" fill="currentColor" />
      <circle className="sr-rx-copy-dot" cx="27" cy="15" r="3" />
    </svg>
  );
}

/**
 * "Remix this". Makes the signed-in person their own draft copy of a published piece and
 * opens it in the studio. The link back to the original maker is written on the server.
 */
export function RemixButton({ designId, slug }: { designId: string; slug: string }) {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [state, setState] = useState<"idle" | "busy" | "opening">("idle");
  const [error, setError] = useState("");
  const flight = useRef(createSingleFlight());
  const noteId = `remix-note-${designId}`;
  const working = state !== "idle";

  function start() {
    if (!isPending && !user) {
      void navigate({ to: "/login" });
      return;
    }
    void flight.current(async () => {
      setState("busy");
      setError("");
      try {
        const made = await remixPiece({ data: { slug } });
        // Stay locked while the studio opens, so a second tap cannot make a second copy.
        setState("opening");
        await navigate({ to: "/studio", search: { design: made.designId } });
      } catch (reason: unknown) {
        setState("idle");
        if (signedOut(reason)) {
          void navigate({ to: "/login" });
          return;
        }
        setError(reason instanceof Error ? reason.message : "The remix did not start. Try again.");
      }
    });
  }

  return (
    <div data-remix-of={designId}>
      <style>{CSS}</style>
      <Button
        variant="ghost"
        size="lg"
        className="sr-rx-btn w-full"
        aria-describedby={noteId}
        aria-disabled={working}
        data-busy={working}
        onClick={() => {
          if (!working) start();
        }}
      >
        <Fork />
        <span aria-live="polite">
          {state === "busy"
            ? "Making your copy"
            : state === "opening"
              ? "Opening the studio"
              : "Remix this"}
        </span>
      </Button>
      <p id={noteId} className="mt-2 text-sm text-muted">
        You get your own copy to change. The original maker stays credited.
      </p>
      {error ? (
        <p role="alert" className="mt-2 border-2 border-pipe bg-surface px-3 py-2 text-sm text-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
