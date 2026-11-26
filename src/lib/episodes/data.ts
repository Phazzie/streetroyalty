import type { Episode, WardrobeRef } from "./types.ts";

/**
 * The episode list. No episode has been shot, so this ships exactly one entry: a
 * template, marked as one. Its beats are instructions to whoever writes the real
 * thing. There is no story, no cast and no audience here to invent.
 *
 * To add a real episode: copy the template, give it a new slug and number, write
 * the beats, set the status, and add videoUrl once the cut exists. validateEpisode
 * (helpers.ts) checks the times and the wardrobe names, and a test runs it on
 * everything in this file.
 */

// Real blanks the studio prints on (label-pieces.ts). Swap in rack pieces once they exist.
const HOODIE_FIT: WardrobeRef[] = [
  { kind: "shop", slug: "hoodie-pullover" },
  { kind: "shop", slug: "jogger-court" },
];

const CREW_FIT: WardrobeRef[] = [
  { kind: "shop", slug: "crew-sweat" },
  { kind: "shop", slug: "jogger-court" },
];

const TOTE: WardrobeRef = { kind: "shop", slug: "tote-corner" };

export const TEMPLATE_EPISODE: Episode = {
  slug: "episode-0",
  number: 0,
  title: "Episode 0. Not shot yet.",
  logline:
    "A template, not an episode. Write one line here: who it follows and what they want tonight.",
  status: "planned",
  durationSec: 300,
  template: true,
  cast: [
    { name: "Character A", role: "Rename this. Wears a hoodie and sweatpants." },
    { name: "Character B", role: "Rename this. Wears a crewneck and sweatpants." },
  ],
  scenes: [
    {
      id: "s1",
      title: "Scene 1",
      startSec: 0,
      endSec: 45,
      beat: "Write the beat here: where we are, who is on screen first, and what they are doing before anything happens.",
      wardrobe: [{ cast: "Character A", pieces: HOODIE_FIT }],
    },
    {
      id: "s2",
      title: "Scene 2",
      startSec: 45,
      endSec: 110,
      beat: "Write the beat here: who walks in, and what they want.",
      wardrobe: [
        { cast: "Character A", pieces: HOODIE_FIT },
        { cast: "Character B", pieces: CREW_FIT },
      ],
    },
    {
      id: "s3",
      title: "Scene 3",
      startSec: 110,
      endSec: 185,
      beat: "Write the beat here: what gets in the way. Keep it to one problem.",
      wardrobe: [{ cast: "Character B", pieces: CREW_FIT }],
    },
    {
      id: "s4",
      title: "Scene 4",
      startSec: 185,
      endSec: 255,
      beat: "Write the beat here: the turn. If somebody adds or swaps a piece, change the wardrobe for this scene. The template adds the tote here to show how.",
      wardrobe: [
        { cast: "Character A", pieces: [...HOODIE_FIT, TOTE] },
        { cast: "Character B", pieces: CREW_FIT },
      ],
    },
    {
      id: "s5",
      title: "Scene 5",
      startSec: 255,
      endSec: 300,
      beat: "Write the beat here: how it ends, and the last picture people see.",
      wardrobe: [
        { cast: "Character A", pieces: [...HOODIE_FIT, TOTE] },
        { cast: "Character B", pieces: CREW_FIT },
      ],
    },
  ],
};

export const EPISODES: Episode[] = [TEMPLATE_EPISODE];

export function findEpisode(slug: string): Episode | null {
  return EPISODES.find((episode) => episode.slug === slug) ?? null;
}

/** The lamp only says ON AIR when something can actually be watched. */
export function onAir(episodes: Episode[] = EPISODES): boolean {
  return episodes.some((episode) => episode.status === "out" && Boolean(episode.videoUrl));
}
