import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { dbSource, getSql } from "../db.ts";
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
 * Counters live in Postgres. If the database cannot be reached, text and
 * checkout counts fall back to this process's memory rather than switching the
 * caps off. Pictures and video are refused instead: each server instance would
 * keep its own count, and the site-wide cap would stop holding.
 */

/**
 * On Vercel every instance has its own memory and its own embedded database,
 * so only a real Postgres counts for the whole site. Anywhere else the app is
 * one process, and its embedded database is as shared as it gets.
 */
function sharedStore(): boolean {
  return dbSource === "neon" || !process.env.VERCEL;
}

const NO_STORE: SpendVerdict = { ok: false, reason: "store" };

type Memory = { day: string; counts: Map<string, number>; sweptDay: string };

const globalRef = globalThis as typeof globalThis & { __srAiUsage__?: Memory };

function memory(day: string): Memory {
  const current = globalRef.__srAiUsage__;
  if (current && current.day === day) return current;
  const fresh: Memory = { day, counts: new Map(), sweptDay: current?.sweptDay ?? "" };
  globalRef.__srAiUsage__ = fresh;
  return fresh;
}

function visitorBucket(day: string): string {
  let address = "unknown";
  try {
    address = clientAddress(getRequest().headers);
  } catch {
    address = "unknown";
  }
  // The day is part of the hash, so the same visitor cannot be followed from one day to the next.
  const salt = process.env.BETTER_AUTH_SECRET?.trim() || "street-royalty";
  return `v:${createHash("sha256").update(`${salt}|${day}|${address}`).digest("hex").slice(0, 24)}`;
}

/**
 * Adds one to the visitor's count and, only if that leaves the visitor within
 * their cap, one to the whole site's. It is a single statement, so a failure
 * never leaves the visitor charged for a request that was then turned away,
 * and a visitor past their cap cannot run up the site's count.
 */
async function bump(
  day: string,
  bucket: string,
  kind: string,
  visitorCap: number,
): Promise<{ visitor: number; global: number | null }> {
  const sql = await getSql();
  const rows = await sql<{ visitor: number | null; global: number | null }>`
    with v as (
      insert into ai_usage (day, bucket, kind, count) values (${day}, ${bucket}, ${kind}, 1)
      on conflict (day, bucket, kind) do update set count = ai_usage.count + 1
      returning count
    ), g as (
      insert into ai_usage (day, bucket, kind, count)
      select ${day}, 'global', ${kind}, 1 from v where v.count <= ${visitorCap}
      on conflict (day, bucket, kind) do update set count = ai_usage.count + 1
      returning count
    )
    select (select count from v) as visitor, (select count from g) as global
  `;
  const row = rows[0];
  return {
    visitor: Number(row?.visitor ?? 1),
    global: row?.global == null ? null : Number(row.global),
  };
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
export async function spend(kind: AiKind): Promise<SpendVerdict> {
  return count(kind, readLimits(process.env)[kind], kind !== "text");
}

/**
 * The same daily counting for anything else worth bounding, such as starting a checkout.
 * A strict count is refused when it cannot be kept somewhere every server instance shares.
 */
export async function count(
  kind: string,
  cap: { visitor: number; global: number },
  strict = false,
): Promise<SpendVerdict> {
  if (strict && !sharedStore()) {
    console.error(`ai usage: ${kind} is off until DATABASE_URL points at a real Postgres.`);
    return NO_STORE;
  }
  const day = usageDay(new Date());
  const bucket = visitorBucket(day);
  try {
    const counts = await bump(day, bucket, kind, cap.visitor);
    void sweep(day);
    return judgeSpend(counts, cap);
  } catch (error) {
    console.error("ai usage", error);
    if (strict) return NO_STORE;
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
 * With no key nothing is counted, because nothing will be spent. A count that
 * could not be kept answers "unavailable", since no limit was actually reached.
 */
export async function admit(kind: AiKind): Promise<Admission> {
  if (!process.env.XAI_API_KEY?.trim()) return "unavailable";
  const verdict = await spend(kind);
  if (verdict.ok) return "ok";
  return verdict.reason === "store" ? "unavailable" : "limit";
}
