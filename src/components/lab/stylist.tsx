import { useRef, useState } from "react";
import { SignInCall } from "@/components/ai/sign-in-call";
import { useAiPrompt } from "@/components/ai/use-paid-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { planOutfit } from "@/lib/ai/api";
import { localPlan, type OutfitPlan } from "@/lib/ai/stylist";
import { useLab } from "@/lib/store";
import { createSingleFlight } from "@/lib/ui/single-flight";

/**
 * Plans an outfit for an occasion. Planning is one text call; nothing is built
 * until the plan is confirmed, because each piece is a paid picture.
 */
export function Stylist() {
  const busy = useLab((state) => state.busy);
  const buildPlan = useLab((state) => state.buildPlan);
  const [open, setOpen] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [plan, setPlan] = useState<(OutfitPlan & { source: string }) | null>(null);
  const [thinking, setThinking] = useState(false);
  const flight = useRef(createSingleFlight());
  const latest = useRef("");
  const ai = useAiPrompt();

  function ask() {
    if (ai.blocked) return;
    const words = occasion.trim();
    if (!words) return;
    latest.current = words;
    void flight.current(async () => {
      setThinking(true);
      try {
        const answer = await planOutfit({ data: { occasion: words } });
        // The occasion may have been retyped while the stylist was thinking.
        if (latest.current === words) setPlan(answer);
      } catch (reason) {
        if (ai.refused(reason)) return;
        if (latest.current === words) setPlan({ ...localPlan(words), source: "local" });
      } finally {
        setThinking(false);
      }
    });
  }

  if (ai.signedOut) return null;
  if (ai.showSignIn) return <SignInCall />;

  if (!open) {
    return (
      <Button variant="ghost" className="mt-2 w-full" onClick={() => setOpen(true)}>
        Dress me for an occasion
      </Button>
    );
  }

  return (
    <div className="mt-2 border-2 border-line p-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <Input
          value={occasion}
          maxLength={160}
          onChange={(event) => {
            setOccasion(event.target.value);
            latest.current = "";
            setPlan(null);
          }}
          placeholder="A wedding in June, a first date"
          aria-label="The occasion"
        />
        <Button
          type="submit"
          variant="ghost"
          className="min-w-20"
          disabled={thinking || ai.blocked || occasion.trim().length === 0}
        >
          {thinking ? "..." : "Plan"}
        </Button>
      </form>
      {plan ? (
        <div className="mt-3">
          {plan.note ? <p className="text-sm italic">{plan.note}</p> : null}
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {plan.pieces.map((piece) => (
              <li key={piece.spoken} className="flex gap-2">
                <span className="w-24 shrink-0 font-display text-xs tracking-wide text-muted uppercase">
                  {piece.category}
                </span>
                <span>{piece.spoken}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            {plan.source === "grok" ? "Picked by the crown." : "House picks, no key needed."}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                buildPlan(plan.pieces, occasion.trim());
                setOpen(false);
                setPlan(null);
              }}
            >
              Build all {plan.pieces.length}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setPlan(null);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 min-h-11 text-sm text-muted underline underline-offset-4"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      )}
    </div>
  );
}
