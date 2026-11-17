import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";

/**
 * What happened to a maker's work, and the pieces they crowned.
 * The shapes live here, not in the server module, so client code can import them.
 */

export type ActivityKind = "crown" | "follow" | "remix" | "battle" | "scan";

/** One run of a sentence. A run with `to` is a link: a maker's page or a rack piece. */
export type ActivityPart =
  | { text: string }
  | { text: string; to: "maker"; handle: string }
  | { text: string; to: "piece"; slug: string };

export type ActivityItem = {
  /** Stable enough to use as a list key. Never a user id. */
  id: string;
  kind: ActivityKind;
  /** ISO time. For a day's roll-up it is the last moment known for that day. */
  when: string;
  /** The sentence, in order. Joined, it reads as plain text. */
  parts: ActivityPart[];
  /** True for battles and scans, which are a day's total and not one moment. */
  rollup: boolean;
  /** Battles only: the day's score for the piece. */
  won?: number;
  lost?: number;
  /** Scans only: how many that day. */
  scans?: number;
};

export type ShelfPiece = {
  slug: string;
  title: string;
  mockupUrl: string | null;
  /** The handle is null for a maker who has not set up a page yet. */
  maker: { name: string; handle: string | null };
  crownedAt: string;
};

/** The last 40 things that happened to the signed-in maker's published pieces. */
export const myActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listActivity } = await import("./activity.server.ts");
    return listActivity(context.userId);
  });

/** The published pieces the signed-in person has crowned, newest first. */
export const myShelf = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listShelf } = await import("./activity.server.ts");
    return listShelf(context.userId);
  });
