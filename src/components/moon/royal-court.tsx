import { useEffect, useState } from "react";
import { courtTerms, joinCourt, leaveCourt, ROYAL_COURT_TIERS, type CourtState } from "@/lib/moon/membership";
import { formatMoney } from "@/lib/pod/money";

const KEY = "sr-royal-court";

/**
 * Royal Court — membership with the terms printed on the offer, in the
 * same size as the pitch. TEST MODE ONLY: joining flips local state.
 * There is no billing path behind this panel, and it says so.
 */
export function RoyalCourt() {
  const [state, setState] = useState<CourtState>({ tierId: null, mode: "test", joined: false });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw) as CourtState);
    } catch {
      // Fresh state is fine.
    }
  }, []);
  const save = (next: CourtState) => {
    setState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // State still applies this visit.
    }
  };
  return (
    <section aria-label="Royal Court membership" className="mb-6 border-2 border-violet bg-surface p-4">
      <h2 className="font-display text-2xl uppercase">Royal Court — membership, terms first</h2>
      <p className="mt-1 text-sm text-muted">
        Most memberships whisper the charge. This one prints it on the poster. Test mode: joining
        below starts nothing and bills nothing.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {ROYAL_COURT_TIERS.map((tier) => (
          <article key={tier.id} className="border-2 border-ink bg-bg p-3">
            <h3 className="font-display text-lg uppercase">{tier.name}</h3>
            <p className="font-display text-3xl">{formatMoney(tier.monthlyCents)}/mo</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">
              {tier.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
            <div className="mt-3 border-t border-line pt-2">
              <p className="font-display text-xs tracking-wide uppercase">The terms, loud</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {courtTerms(tier).map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
            {state.joined && state.tierId === tier.id ? (
              <button type="button" className="chip mt-3" onClick={() => save(leaveCourt())}>
                Leave the Court — one click, this is the button
              </button>
            ) : (
              <button type="button" className="chip chip-on mt-3" onClick={() => save(joinCourt(state, tier.id))}>
                Join in test mode — no charge
              </button>
            )}
          </article>
        ))}
      </div>
      {state.joined ? <p className="mt-2 text-sm text-cyan">Court state (test): joined. No card exists here to charge.</p> : null}
    </section>
  );
}
