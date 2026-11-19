/** Episode types. Safe for client code. */

/** A piece worn on screen: a custom from the rack, or one of the label's own from the drop. */
export type WardrobeRef = { kind: "rack"; slug: string } | { kind: "shop"; slug: string };

export type EpisodeStatus = "planned" | "shooting" | "out";

export type CastMember = { name: string; role: string };

export type SceneWardrobe = { cast: string; pieces: WardrobeRef[] };

export type Scene = {
  id: string;
  title: string;
  startSec: number;
  endSec: number;
  /** What happens. In the template this is an instruction to the owner, not a story. */
  beat: string;
  wardrobe: SceneWardrobe[];
};

export type Episode = {
  slug: string;
  number: number;
  title: string;
  logline: string;
  status: EpisodeStatus;
  videoUrl?: string;
  posterUrl?: string;
  durationSec: number;
  cast: CastMember[];
  scenes: Scene[];
  /** True for the built-in template. The pages label it so nobody mistakes it for a real episode. */
  template?: boolean;
};

export function refKey(ref: WardrobeRef): string {
  return `${ref.kind}:${ref.slug}`;
}

export function sameRef(a: WardrobeRef, b: WardrobeRef): boolean {
  return a.kind === b.kind && a.slug === b.slug;
}
