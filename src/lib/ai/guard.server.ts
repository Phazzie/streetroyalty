import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "../db.ts";
import {
  clientAddress,
  judgeSpend,
  readLimits,
  usageDay,
  type AiKind,
  type SpendVerdict,
} from "./limits.ts";

/**
 * Counts every paid generation against a per-visitor and a whole-site daily
 * cap before the request goes to xAI, so a public page cannot drain the key.
 * Counters live in Postgres. If the database cannot be reached the count falls
 * back to this process's memory rather than switching the caps off.
 */

type Memory = { day: string; counts: Map<string, number>; sweptDay: string };

const globalRef = globalThis as typeof globalThis & { __srAiUsage__?: Memory };

function memory(day: string): Memory {
  const current = globalRef.__srAiUsage__;
  if (current && current.day === day) return current;
  const fresh: Memory = { day, counts: new Map(), sweptDay: current?.sweptDay ?? "" };
  globalRef.__srAiUsage__ = fresh;
  return fresh;
}

/** A signed-in account. Blank is not an account, so the address cap still applies. */
function accountId(userId?: string): string | null {
  const id = userId?.trim();
  return id ? id : null;
}

function visitorBucket(day: string, userId?: string): string {
  // The day is part of the hash, so the same person cannot be followed from one day to the next.
  const salt = process.env.BETTER_AUTH_SECRET?.trim() || "street-royalty";
  const account = accountId(userId);
  if (account) {
    return `u:${createHash("sha256").update(`${salt}|${day}|user|${account}`).digest("hex").slice(0, 24)}`;
  }
  let address = "unknown";
  try {
    address = clientAddress(getRequest().headers);
  } catch {
    address = "unknown";
  }
  return `v:${createHash("sha256").update(`${salt}|${day}|${address}`).digest("hex").slice(0, 24)}`;
}

async function bump(day: string, bucket: string, kind: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`
    insert into ai_usage (day, bucket, kind, count) values (${day}, ${bucket}, ${kind}, 1)
    on conflict (day, bucket, kind) do update set count = ai_usage.count + 1
    returning count
  `;
  return Number(rows[0]?.count ?? 1);
}

function bumpMemory(day: string, bucket: string, kind: string): number {
  const store = memory(day);
  const key = `${bucket}|${kind}`;
  const next = (store.counts.get(key) ?? 0) + 1;
  store.counts.set(key, next);
  return next;
}

async function sweep(day: string) {
  const store = memory(day);
  if (store.sweptDay === day) return;
  store.sweptDay = day;
  const cutoff = usageDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  try {
    const sql = await getSql();
    await sql`delete from ai_usage where day < ${cutoff}`;
  } catch (error) {
    console.error("ai usage sweep", error);
  }
}

/** Records one generation. A refusal means the request must not be sent to xAI. */
export async function spend(kind: AiKind, userId?: string): Promise<SpendVerdict> {
  return count(kind, readLimits(process.env)[kind], userId);
}

/**
 * The same daily counting for anything else worth bounding, such as starting a checkout.
 * Pass the verified account when the caller is signed in so a new address does not
 * open a fresh allowance. With no account the address is the bucket, as before.
 */
export async function count(
  kind: string,
  cap: { visitor: number; global: number },
  userId?: string,
): Promise<SpendVerdict> {
  const day = usageDay(new Date());
  const bucket = visitorBucket(day, userId);
  try {
    const visitor = await bump(day, bucket, kind);
    const first = judgeSpend({ visitor, global: null }, cap);
    if (!first.ok) return first;
    const global = await bump(day, "global", kind);
    void sweep(day);
    return judgeSpend({ visitor, global }, cap);
  } catch (error) {
    console.error("ai usage", error);
    const visitor = bumpMemory(day, bucket, kind);
    const first = judgeSpend({ visitor, global: null }, cap);
    if (!first.ok) return first;
    return judgeSpend({ visitor, global: bumpMemory(day, "global", kind) }, cap);
  }
}

export type Admission = "ok" | "limit" | "unavailable";

/**
 * The gate in front of a paid call. Call it only after the request itself has
 * been checked, so a malformed request cannot use up the day's allowance.
 * With no key nothing is counted, because nothing will be spent.
 */
export async function admit(kind: AiKind, userId?: string): Promise<Admission> {
  if (!process.env.XAI_API_KEY?.trim()) return "unavailable";
  return (await spend(kind, userId)).ok ? "ok" : "limit";
}
