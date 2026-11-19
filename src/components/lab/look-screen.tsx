import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Header, Shell, TextButton } from "@/components/lab/chrome";
import { Composer } from "@/components/lab/mic";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { SignInCall } from "@/components/ai/sign-in-call";
import { useAiPrompt } from "@/components/ai/use-paid-ai";
import { critiqueOutfit, nameLook } from "@/lib/ai/api";
import { localCritique, localLookName } from "@/lib/ai/local";
import { fallbackName, renderDropCard, shareDropCard } from "@/lib/lab/drop-card";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { useLab } from "@/lib/store";

const EXAMPLES = ["make it black", "shorter coat"] as const;

export function LookScreen() {
  const setView = useLab((state) => state.setView);
  const draft = useLab((state) => state.draft);
  const busy = useLab((state) => state.busy);
  const saveDraft = useLab((state) => state.saveDraft);
  const requestRunway = useLab((state) => state.requestRunway);
  const navigate = useNavigate();
  const [crown, setCrown] = useState<{ verdict: string; note: string; next: string; source: string } | null>(null);
  const [lookName, setLookName] = useState("");
  const [asking, setAsking] = useState(false);
  const [carding, setCarding] = useState(false);
  const flight = useRef(createSingleFlight());
  const cardFlight = useRef(createSingleFlight());
  const setStatus = useLab((state) => state.setStatus);
  const ai = useAiPrompt();

  return (
    <Shell>
      <Header
        title={copy.look}
        action={
          <>
            <TextButton onClick={() => setView("hub")}>{copy.hub}</TextButton>
            <TextButton onClick={() => setView("board")}>{copy.board}</TextButton>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {draft ? (
          <figure className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <img
                src={draft.image}
                alt={draft.spoken}
                className={cn("absolute inset-0 h-full w-full object-contain", busy && "pending-pulse")}
              />
            </div>
            <figcaption className="line-clamp-2 shrink-0 py-2 text-center text-sm">
              {lookName ? <span className="block font-display uppercase">{lookName}</span> : null}
              {draft.spoken}
            </figcaption>
          </figure>
        ) : busy ? (
          <p className="pending-pulse flex flex-1 items-center justify-center text-center text-lg">{copy.puttingOn}</p>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p>{copy.nothingOn}</p>
            <Button onClick={() => setView("board")}>{copy.openBoard}</Button>
          </div>
        )}
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <Composer placeholder={copy.changeHint} suggestions={draft ? EXAMPLES : []} />
        {ai.showSignIn ? <SignInCall /> : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={!draft || busy} onClick={saveDraft}>
            {copy.saveThis}
          </Button>
          <Button disabled={!draft || busy || ai.blocked} onClick={requestRunway}>
            {copy.runway}
          </Button>
          <Button
            variant="ghost"
            disabled={!draft || asking || ai.blocked}
            onClick={() => {
              if (!draft || ai.blocked) return;
              void flight.current(async () => {
                setAsking(true);
                try {
                  const result = await nameLook({ data: { spoken: draft.spoken } });
                  setLookName(result.name);
                } catch (reason) {
                  if (!ai.refused(reason)) setLookName(localLookName(draft.spoken));
                } finally {
                  setAsking(false);
                }
              });
            }}
          >
            Name it
          </Button>
          <Button
            variant="ghost"
            disabled={!draft || asking || ai.blocked}
            onClick={() => {
              if (!draft || ai.blocked) return;
              void flight.current(async () => {
                setAsking(true);
                try {
                  setCrown(await critiqueOutfit({ data: { spoken: draft.spoken } }));
                } catch (reason) {
                  if (!ai.refused(reason)) setCrown({ ...localCritique(draft.spoken), source: "local" });
                } finally {
                  setAsking(false);
                }
              });
            }}
          >
            {copy.crownAsk}
          </Button>
          {crown ? (
            <div className="col-span-2 border-2 border-line p-3 text-sm">
              <p className="font-display uppercase">{crown.verdict}</p>
              <p className="mt-1">{crown.note}</p>
              <p className="mt-1 text-muted">Next: {crown.next}</p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            disabled={!draft || carding}
            onClick={() => {
              if (!draft) return;
              void cardFlight.current(async () => {
                setCarding(true);
                try {
                  const name = lookName || fallbackName(draft.spoken);
                  const blob = await renderDropCard({
                    image: draft.image,
                    name,
                    pieces: draft.spoken,
                    verdict: crown?.verdict,
                  });
                  const how = await shareDropCard(blob, name);
                  setStatus(how === "shared" ? "Card's out." : "Card saved to your downloads.");
                } catch (reason: unknown) {
                  setStatus(reason instanceof Error ? reason.message : "The card could not be made.");
                } finally {
                  setCarding(false);
                }
              });
            }}
          >
            {carding ? "Making it" : "Drop card"}
          </Button>
          <Button
            variant="ghost"
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              try {
                sessionStorage.setItem("sr-print-art", draft.image);
              } catch {
                setStatus("This phone can't hold that picture. Save the look and try a smaller one.");
                return;
              }
              void navigate({ to: "/studio" });
            }}
          >
            Print this
          </Button>
        </div>
      </div>
    </Shell>
  );
}
