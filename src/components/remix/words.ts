/** The words the family tree uses. Pure, so they can be tested without a browser. */

export function ordinal(value: number): string {
  const whole = Math.max(1, Math.round(value));
  const lastTwo = whole % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${whole}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[whole % 10] ?? "th";
  return `${whole}${suffix}`;
}

/** The name of a stop on the line, counting the original as the first generation. */
export function generationLabel(index: number): string {
  return index <= 0 ? "The original" : `${ordinal(index + 1)} generation`;
}

export function countPieces(count: number): string {
  return count === 1 ? "1 piece" : `${count} pieces`;
}

export function countRemixes(count: number): string {
  return count === 1 ? "1 remix" : `${count} remixes`;
}

/** One line that says where this piece sits and what came from it. */
export function familySummary(input: {
  /** How many stops the line has, this piece included. */
  generation: number;
  /** True when part of the line was deleted, so the count of generations is not known. */
  broken: boolean;
  descendants: number;
}): string {
  const place =
    input.generation <= 1
      ? "An original."
      : input.broken
        ? "Part of a longer line."
        : `${ordinal(input.generation)} generation.`;
  const after =
    input.descendants > 0
      ? `${countPieces(input.descendants)} on the rack came from this one.`
      : "Nobody has remixed it yet.";
  return `${place} ${after}`;
}

/** What sits under the remix line's name. */
export function remixLineNote(input: {
  shown: number;
  remixCount: number;
  descendants: number;
}): string {
  const direct = `${countRemixes(input.remixCount)} on the rack`;
  const deeper =
    input.descendants > input.remixCount ? `, ${input.descendants} down the whole line` : "";
  const cut = input.shown < input.remixCount ? `. Showing the first ${input.shown}` : "";
  return `${direct}${deeper}${cut}.`;
}
