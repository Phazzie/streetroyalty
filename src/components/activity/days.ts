/**
 * Sorting a feed into days the way a person says them: Today, Yesterday, then the date.
 * Days are the reader's own calendar days, not UTC.
 */

export type DayGroup<T> = {
  /** Local year-month-day, for a list key. */
  key: string;
  label: string;
  items: T[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The reader's calendar day for a moment, as 2026-11-17. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today, Yesterday, or the date written out. The year only shows when it is not this one. */
export function dayLabel(date: Date, now: Date, locale?: string): string {
  const key = dayKey(date);
  if (key === dayKey(now)) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === dayKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** Keeps the order it is given, and starts a new group each time the day changes. */
export function groupByDay<T extends { when: string }>(
  items: T[],
  now: Date,
  locale?: string,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = new Date(item.when);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(date, now, locale), items: [item] });
  }
  return groups;
}

/** The time of day, the short way the reader's device writes it. */
export function clock(when: string, locale?: string): string {
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}
