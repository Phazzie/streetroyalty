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

async function bump(day: string, bucket: string, kind: AiKind): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`
    insert into ai_usage (day, bucket, kind, count) values (${day}, ${bucket}, ${kind}, 1)
    on conflict (day, bucket, kind) do update set count = ai_usage.count + 1
    returning count
  `;
  return Number(rows[0]?.count ?? 1);
}

function bumpMemory(day: string, bucket: string, kind: AiKind): number {
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
  const cap = readLimits(process.env)[kind];
  const day = usageDay(new Date());
  const bucket = visitorBucket(day);
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
