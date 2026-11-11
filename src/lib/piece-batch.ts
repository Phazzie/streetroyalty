export function settleRetry(
  previousIds: readonly (string | null)[],
  outcomes: readonly (string | null)[],
): { nextIds: (string | null)[]; replaced: string[] } {
  const nextIds: (string | null)[] = [];
  const replaced: string[] = [];
  for (let i = 0; i < outcomes.length; i += 1) {
    const created = outcomes[i];
    const previous = previousIds[i] ?? null;
    if (created) {
      nextIds.push(created);
      if (previous) replaced.push(previous);
    } else {
      nextIds.push(previous);
    }
  }
  return { nextIds, replaced };
}
