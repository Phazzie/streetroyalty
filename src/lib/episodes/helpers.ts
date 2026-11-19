import { refKey, type Episode, type Scene, type SceneWardrobe, type WardrobeRef } from "./types.ts";

/** Keeps a playhead inside the episode. Bad numbers become zero. */
export function clampTime(episode: Episode, t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(Math.max(0, t), Math.max(0, episode.durationSec));
}

/**
 * The scene on screen at second t. A scene owns its start and not its end, so the
 * cut at 45 belongs to the scene that starts there. The last frame of the episode
 * belongs to the last scene. Gaps between scenes return null.
 */
export function sceneAt(episode: Episode, t: number): Scene | null {
  if (!Number.isFinite(t) || t < 0 || t > episode.durationSec) return null;
  for (const scene of episode.scenes) {
    if (t >= scene.startSec && t < scene.endSec) return scene;
  }
  const last = episode.scenes[episode.scenes.length - 1];
  if (last && t === last.endSec && t === episode.durationSec) return last;
  return null;
}

/** Who is wearing what at second t. Empty between scenes. */
export function wardrobeAt(episode: Episode, t: number): SceneWardrobe[] {
  return sceneAt(episode, t)?.wardrobe ?? [];
}

/** Every piece that appears in the episode, once each, in order of first appearance. */
export function episodePieces(episode: Episode): WardrobeRef[] {
  const seen = new Set<string>();
  const out: WardrobeRef[] = [];
  for (const scene of episode.scenes) {
    for (const look of scene.wardrobe) {
      for (const ref of look.pieces) {
        const key = refKey(ref);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ref);
      }
    }
  }
  return out;
}

/** The first and last second a piece is on screen, for "first seen at". */
export function firstSeen(episode: Episode, ref: WardrobeRef): number | null {
  const key = refKey(ref);
  for (const scene of [...episode.scenes].sort((a, b) => a.startSec - b.startSec)) {
    if (scene.wardrobe.some((look) => look.pieces.some((piece) => refKey(piece) === key))) {
      return scene.startSec;
    }
  }
  return null;
}

/**
 * Problems with an episode, in plain words. An empty list means it is sound.
 * Checks: scenes sit inside the running time, do not overlap, and only dress
 * people who are in the cast.
 */
export function validateEpisode(episode: Episode): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(episode.durationSec) || episode.durationSec <= 0) {
    problems.push("The episode needs a running time above zero.");
  }
  if (episode.status === "out" && !episode.videoUrl) {
    problems.push("An episode marked out needs a video.");
  }

  const names = new Set<string>();
  for (const member of episode.cast) {
    if (!member.name.trim()) problems.push("A cast member has no name.");
    if (names.has(member.name)) problems.push(`${member.name} is in the cast twice.`);
    names.add(member.name);
  }

  const ids = new Set<string>();
  for (const scene of episode.scenes) {
    const label = scene.title || scene.id;
    if (ids.has(scene.id)) problems.push(`Two scenes share the id ${scene.id}.`);
    ids.add(scene.id);
    if (!Number.isFinite(scene.startSec) || !Number.isFinite(scene.endSec)) {
      problems.push(`${label} has a time that is not a number.`);
      continue;
    }
    if (scene.endSec <= scene.startSec) problems.push(`${label} ends before it starts.`);
    if (scene.startSec < 0 || scene.endSec > episode.durationSec) {
      problems.push(`${label} runs outside the episode.`);
    }
    const dressed = new Set<string>();
    for (const look of scene.wardrobe) {
      if (!names.has(look.cast)) {
        problems.push(`${label} dresses ${look.cast}, who is not in the cast.`);
      }
      if (dressed.has(look.cast)) problems.push(`${label} dresses ${look.cast} twice.`);
      dressed.add(look.cast);
    }
  }

  const ordered = episode.scenes
    .filter((scene) => Number.isFinite(scene.startSec) && Number.isFinite(scene.endSec))
    .sort((a, b) => a.startSec - b.startSec);
  for (let index = 1; index < ordered.length; index += 1) {
    const before = ordered[index - 1];
    const after = ordered[index];
    if (before && after && after.startSec < before.endSec) {
      problems.push(`${before.title || before.id} and ${after.title || after.id} overlap.`);
    }
  }
  return problems;
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Seconds as a slate timecode. "05:00" by default, "01:02:03" past the hour, and
 * with frames ("00:00:45:12") when a frame rate is given.
 */
export function formatTimecode(seconds: number, options: { fps?: number } = {}): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const whole = Math.floor(safe);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const fps = options.fps && options.fps > 0 ? Math.round(options.fps) : 0;
  if (fps) {
    const frame = Math.min(fps - 1, Math.floor((safe - whole) * fps + 1e-6));
    return `${two(hours)}:${two(minutes)}:${two(secs)}:${two(frame)}`;
  }
  return hours > 0 ? `${two(hours)}:${two(minutes)}:${two(secs)}` : `${two(minutes)}:${two(secs)}`;
}

/** "5 min" or "4 min 30 sec", for cards. */
export function formatRunningTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  if (minutes === 0) return `${secs} sec`;
  return secs === 0 ? `${minutes} min` : `${minutes} min ${secs} sec`;
}

export const STATUS_LABEL: Record<Episode["status"], string> = {
  planned: "Planned. Not shot yet.",
  shooting: "In the works.",
  out: "Out now.",
};
