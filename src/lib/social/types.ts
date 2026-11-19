import type { DesignSummary } from "../studio/models.ts";

/**
 * Shared shapes for the social layer. Safe to import from client code.
 * This file is the contract between the pieces built in parallel: change it only
 * by adding, and say so in AGENT-TALK.md.
 */

/** A maker as shown next to their work. */
export type MakerRef = {
  handle: string;
  name: string;
};

export type MakerProfile = MakerRef & {
  bio: string;
  joinedAt: string;
  /** Published pieces. */
  pieces: number;
  followers: number;
  following: number;
  /** Crowns received across every published piece. */
  crowns: number;
  followedByMe: boolean;
  isMe: boolean;
};

export type RackSort = "fresh" | "crowned" | "following";

/** A published piece as the rack shows it. */
export type RackPiece = DesignSummary & {
  maker: MakerRef;
  crowns: number;
  crownedByMe: boolean;
  /** Garment colour first, then each distinct text colour, as #rrggbb. */
  palette: string[];
};
