import type { Sql } from "../db.ts";

/** A fixed window: the hour or the UTC day a moment falls in, as text. */
export function windowKey(now: Date, size: "hour" | "day"): string {
  return now.toISOString().slice(0, size === "hour" ? 13 : 10);
}

/**
 * Take one use of an allowance. True when there was one to take. The insert and the
 * increment are one statement, and the increment only happens under the limit, so
 * parallel requests queue on the row instead of all reading "not full yet".
 */
export async function takeQuota(
  sql: Sql,
  input: { userId: string; action: string; window: string; limit: number },
): Promise<boolean> {
  if (input.limit <= 0) return false;
  const rows = await sql<{ used: number }>`
    insert into action_quotas (user_id, action, window_key, used)
    values (${input.userId}, ${input.action}, ${input.window}, 1)
    on conflict (user_id, action, window_key)
    do update set used = action_quotas.used + 1
    where action_quotas.used < ${input.limit}
    returning used
  `;
  return rows.length > 0;
}
