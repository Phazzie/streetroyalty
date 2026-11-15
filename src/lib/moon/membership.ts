/**
 * Royal Court — membership as configuration. TEST MODE ONLY: this module
 * describes the offer and its rules; nothing here bills anyone, and the
 * terms are printed loud on the offer itself — price, credits, the exit.
 * The anti-trust-gap is the feature.
 */
import { formatMoney } from "../pod/money.ts";

export type CourtTier = {
  id: string;
  name: string;
  monthlyCents: number;
  creditsPerMonth: number;
  perks: string[];
};

export const ROYAL_COURT_TIERS: CourtTier[] = [
  {
    id: "court",
    name: "Royal Court",
    monthlyCents: 1900,
    creditsPerMonth: 2,
    perks: [
      "2 print credits a month — each covers a standard piece at the rack price",
      "First hands on every Drop, an hour before the runway opens",
      "Fork any published piece with no studio fee in test mode",
    ],
  },
  {
    id: "court-plus",
    name: "Royal Court — Front Row",
    monthlyCents: 3900,
    creditsPerMonth: 5,
    perks: [
      "5 print credits a month",
      "First hands on every Drop, a day early",
      "One co-design session a month: your fork, reviewed on the board",
    ],
  },
];

/** The terms, loud. Every line here renders on the offer itself. */
export function courtTerms(tier: CourtTier): string[] {
  return [
    `${formatMoney(tier.monthlyCents)} a month. That is the whole charge — there is no second one.`,
    "TEST MODE: no card is charged, no subscription starts. This page is the configuration, not a checkout.",
    "Skip any month in one click. Cancel in one click. The button is on this page, not in a maze.",
    `${tier.creditsPerMonth} credits land on the 1st. Unused credits expire at month end — said here, not in a footnote.`,
    "Canceling keeps everything you already printed. Nothing you own gets held hostage.",
  ];
}

export type CourtState = {
  tierId: string | null;
  mode: "test";
  joined: boolean;
};

/** Test-mode join: flips local state only. No billing path exists here. */
export function joinCourt(state: CourtState, tierId: string): CourtState {
  if (!ROYAL_COURT_TIERS.some((tier) => tier.id === tierId)) return state;
  return { tierId, mode: "test", joined: true };
}

export function leaveCourt(): CourtState {
  return { tierId: null, mode: "test", joined: false };
}
