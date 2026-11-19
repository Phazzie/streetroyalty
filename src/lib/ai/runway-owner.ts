import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "../db.ts";
import { clientAddress, usageDay } from "./limits.ts";

/** The shared id `requireUserId` returns when auth is off. It is not one person. */
const SHARED_DEV_USER = "dev-user";

export class RunwayNotFound extends Error {
  readonly status = 404;
  constructor() {
    super("Not found");
    this.name = "RunwayNotFound";
  }
}

function ownerKey(userId: string): string {
  const id = userId.trim();
  if (id && id !== SHARED_DEV_USER) return `user:${id}`;
  let address = "unknown";
  try {
    address = clientAddress(getRequest().headers);
  } catch {
    address = "unknown";
  }
  const day = usageDay(new Date());
  const salt = process.env.BETTER_AUTH_SECRET?.trim() || "street-royalty";
  return `v:${createHash("sha256").update(`${salt}|${day}|${address}`).digest("hex").slice(0, 24)}`;
}

/** Remember who started this video. A second claim for the same id does not move it. */
export async function claimRunway(requestId: string, userId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into runway_runs (request_id, owner_key)
    values (${requestId}, ${ownerKey(userId)})
    on conflict (request_id) do nothing
  `;
}

/** 404 unless this caller started the video. */
export async function assertRunwayOwner(requestId: string, userId: string): Promise<void> {
  if (!requestId) throw new RunwayNotFound();
  const sql = await getSql();
  const rows = await sql<{ owner_key: string }>`
    select owner_key from runway_runs where request_id = ${requestId}
  `;
  if (rows[0]?.owner_key !== ownerKey(userId)) throw new RunwayNotFound();
}
