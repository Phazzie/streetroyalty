/**
 * The words and shapes of a report. No server code and no React in here, so the
 * dialog, the queue and the server all read the same list.
 */

export type ReportKind = "piece" | "maker";

export const REPORT_REASONS = [
  { id: "stolen", label: "Stolen art or someone else's logo", short: "Stolen art" },
  { id: "hate", label: "Hate or threats", short: "Hate or threats" },
  { id: "nudity", label: "Nudity", short: "Nudity" },
  { id: "scam", label: "Scam or fake", short: "Scam or fake" },
  { id: "other", label: "Something else", short: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export const NOTE_LIMIT = 280;

/** What a person is told. The page matches on these, so they live in one place. */
export const REPORT_MESSAGES = {
  already: "You already reported this.",
  ownPiece: "You cannot report your own piece.",
  yourself: "You cannot report yourself.",
  noPiece: "That piece is not on the rack.",
  noMaker: "There is no maker by that name.",
  pickReason: "Pick a reason.",
  noteTooLong: `Keep the note to ${NOTE_LIMIT} characters.`,
  tooMany: "That is a lot of reports for one day. Come back tomorrow.",
  staffOnly: "This page is for the people who run the shop.",
  settled: "Somebody already settled that one.",
  gone: "That report is gone.",
} as const;

export type ReportTarget = { kind: "piece"; slug: string } | { kind: "maker"; handle: string };

export type FileReportResult = { status: "filed" | "already" };

/** What the shop can do with a pile of reports. On a maker, "remove" clears the bio. */
export type ReportAction = "remove" | "keep";

export type ReportSlip = {
  reason: ReportReason;
  note: string;
  /** The reporter's maker handle, when they have a maker page. */
  by: string | null;
  at: string;
};

export type ReportGroup = {
  /** A report in the pile. Hand it back to settle the whole pile. */
  ticket: string;
  kind: ReportKind;
  count: number;
  firstAt: string;
  lastAt: string;
  reasons: { reason: ReportReason; count: number }[];
  slips: ReportSlip[];
  /** Null when the piece was deleted or the maker has no page any more. */
  piece: {
    slug: string;
    title: string;
    mockupUrl: string | null;
    onRack: boolean;
    maker: { handle: string; name: string } | null;
  } | null;
  maker: { handle: string; name: string; bio: string } | null;
};

export type ReportQueue = { groups: ReportGroup[]; open: number };

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((reason) => reason.id === value);
}

export function reasonLabel(reason: string, form: "label" | "short" = "label"): string {
  return REPORT_REASONS.find((item) => item.id === reason)?.[form] ?? "Something else";
}

/** Length the way a person counts it: one emoji is one character. */
export function noteLength(note: string): number {
  return [...note].length;
}

/**
 * A note is stored as the plain text the person typed. Only the characters a
 * database or a screen cannot hold are dropped: control codes and the marks that
 * flip text direction. Line breaks and tabs become single spaces.
 */
export function cleanNote(input: unknown): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Tally reasons, most common first, ties in the order of the list above. */
export function tallyReasons(reasons: readonly string[]): { reason: ReportReason; count: number }[] {
  return REPORT_REASONS.map((item) => ({
    reason: item.id,
    count: reasons.filter((reason) => (isReportReason(reason) ? reason : "other") === item.id)
      .length,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** "3 days", "5 hours", "just now". For how long a pile has been waiting. */
export function waitingFor(sinceIso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(sinceIso).getTime()) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
