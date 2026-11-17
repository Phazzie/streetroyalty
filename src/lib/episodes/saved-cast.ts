import { BOARD_SLOTS } from "./board.ts";
import { refKey, type WardrobeRef } from "./types.ts";

/**
 * The cast and pieces someone picked in the wardrobe sheet builder. Kept in this
 * browser only (localStorage), so there is no account, no server and nothing to
 * leak. Whatever comes back out of storage is checked before it is used.
 */

export const SAVED_CAST_KEY = "sr.episodes.wardrobe.v1";
export const MAX_CHARACTERS = 6;
export const MAX_PIECES = BOARD_SLOTS;
export const MAX_NAME = 40;

export type SavedCharacter = { id: string; name: string; pieces: WardrobeRef[] };
export type SavedCast = { activeId: string; characters: SavedCharacter[] };

export function defaultCast(): SavedCast {
  return { activeId: "c1", characters: [{ id: "c1", name: "", pieces: [] }] };
}

function parseRef(raw: unknown): WardrobeRef | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { kind?: unknown; slug?: unknown };
  if (row.kind !== "rack" && row.kind !== "shop") return null;
  if (typeof row.slug !== "string") return null;
  const slug = row.slug.trim().slice(0, 160);
  return slug ? { kind: row.kind, slug } : null;
}

export function parseSavedCast(raw: string | null | undefined): SavedCast {
  if (!raw) return defaultCast();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultCast();
  }
  if (!data || typeof data !== "object") return defaultCast();
  const input = data as { activeId?: unknown; characters?: unknown };
  const characters: SavedCharacter[] = [];
  const ids = new Set<string>();
  for (const item of Array.isArray(input.characters) ? input.characters : []) {
    if (characters.length >= MAX_CHARACTERS) break;
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; name?: unknown; pieces?: unknown };
    const id = typeof row.id === "string" ? row.id.slice(0, 24) : "";
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const pieces: WardrobeRef[] = [];
    const seen = new Set<string>();
    for (const rawRef of Array.isArray(row.pieces) ? row.pieces : []) {
      const ref = parseRef(rawRef);
      if (!ref || seen.has(refKey(ref)) || pieces.length >= MAX_PIECES) continue;
      seen.add(refKey(ref));
      pieces.push(ref);
    }
    characters.push({
      id,
      name: typeof row.name === "string" ? row.name.slice(0, MAX_NAME) : "",
      pieces,
    });
  }
  if (characters.length === 0) return defaultCast();
  const activeId =
    typeof input.activeId === "string" && ids.has(input.activeId)
      ? input.activeId
      : (characters[0] as SavedCharacter).id;
  return { activeId, characters };
}

export function activeCharacter(cast: SavedCast): SavedCharacter {
  return (
    cast.characters.find((character) => character.id === cast.activeId) ??
    (cast.characters[0] as SavedCharacter)
  );
}

function patchActive(
  cast: SavedCast,
  change: (character: SavedCharacter) => SavedCharacter,
): SavedCast {
  const active = activeCharacter(cast);
  return {
    ...cast,
    characters: cast.characters.map((character) =>
      character.id === active.id ? change(character) : character,
    ),
  };
}

export function renameActive(cast: SavedCast, name: string): SavedCast {
  return patchActive(cast, (character) => ({ ...character, name: name.slice(0, MAX_NAME) }));
}

/** Puts a piece on the active character, or takes it off. A full outfit ignores additions. */
export function togglePiece(cast: SavedCast, ref: WardrobeRef): SavedCast {
  return patchActive(cast, (character) => {
    const key = refKey(ref);
    if (character.pieces.some((piece) => refKey(piece) === key)) {
      return { ...character, pieces: character.pieces.filter((piece) => refKey(piece) !== key) };
    }
    if (character.pieces.length >= MAX_PIECES) return character;
    return { ...character, pieces: [...character.pieces, ref] };
  });
}

export function addCharacter(cast: SavedCast): SavedCast {
  if (cast.characters.length >= MAX_CHARACTERS) return cast;
  let n = cast.characters.length + 1;
  const ids = new Set(cast.characters.map((character) => character.id));
  while (ids.has(`c${n}`)) n += 1;
  const id = `c${n}`;
  return { activeId: id, characters: [...cast.characters, { id, name: "", pieces: [] }] };
}

/** Removes a character. The last one cannot be removed, only emptied. */
export function removeCharacter(cast: SavedCast, id: string): SavedCast {
  if (cast.characters.length <= 1) {
    return { ...cast, characters: cast.characters.map((c) => ({ ...c, name: "", pieces: [] })) };
  }
  const characters = cast.characters.filter((character) => character.id !== id);
  const activeId = cast.activeId === id ? (characters[0] as SavedCharacter).id : cast.activeId;
  return { activeId, characters };
}

export function selectCharacter(cast: SavedCast, id: string): SavedCast {
  return cast.characters.some((character) => character.id === id)
    ? { ...cast, activeId: id }
    : cast;
}

/** A stand-in name for the tab of a character nobody has named yet. */
export function characterLabel(character: SavedCharacter, index: number): string {
  return character.name.trim() || `Character ${index + 1}`;
}
