import { describe, expect, it } from "vitest";
import { TEMPLATE_EPISODE } from "./data.ts";
import {
  activeCharacter,
  addCharacter,
  characterLabel,
  defaultCast,
  episodeOutfits,
  MAX_CHARACTERS,
  MAX_PIECES,
  mergeEpisodeCast,
  parseSavedCast,
  removeCharacter,
  renameActive,
  selectCharacter,
  togglePiece,
} from "./saved-cast.ts";

describe("parseSavedCast", () => {
  it("starts with one unnamed character when nothing is saved or the save is broken", () => {
    expect(parseSavedCast(null)).toEqual(defaultCast());
    expect(parseSavedCast("{not json")).toEqual(defaultCast());
    expect(parseSavedCast('"hello"')).toEqual(defaultCast());
    expect(parseSavedCast('{"characters":[]}')).toEqual(defaultCast());
  });

  it("round trips a real save", () => {
    let cast = renameActive(defaultCast(), "Rey");
    cast = togglePiece(cast, { kind: "shop", slug: "hoodie-pullover" });
    cast = addCharacter(cast);
    cast = togglePiece(cast, { kind: "rack", slug: "abc" });
    expect(parseSavedCast(JSON.stringify(cast))).toEqual(cast);
  });

  it("throws away anything that is not a piece, and repeats", () => {
    const raw = JSON.stringify({
      activeId: "nope",
      characters: [
        {
          id: "c1",
          name: 7,
          pieces: [
            { kind: "shop", slug: "a" },
            { kind: "shop", slug: "a" },
            { kind: "store", slug: "b" },
            { kind: "rack", slug: "" },
            null,
            "x",
          ],
        },
        { id: "c1", name: "twin", pieces: [] },
        "junk",
      ],
    });
    expect(parseSavedCast(raw)).toEqual({
      activeId: "c1",
      characters: [{ id: "c1", name: "", pieces: [{ kind: "shop", slug: "a" }] }],
    });
  });

  it("caps the cast and the outfit", () => {
    const raw = JSON.stringify({
      activeId: "c0",
      characters: Array.from({ length: 20 }, (_, index) => ({
        id: `c${index}`,
        name: "n".repeat(200),
        pieces: Array.from({ length: 30 }, (_, n) => ({ kind: "shop", slug: `p${n}` })),
      })),
    });
    const cast = parseSavedCast(raw);
    expect(cast.characters).toHaveLength(MAX_CHARACTERS);
    expect(cast.characters[0]?.pieces).toHaveLength(MAX_PIECES);
    expect(cast.characters[0]?.name).toHaveLength(40);
  });
});

describe("editing the cast", () => {
  it("puts a piece on and takes it off again", () => {
    const ref = { kind: "shop", slug: "tote-corner" } as const;
    const on = togglePiece(defaultCast(), ref);
    expect(activeCharacter(on).pieces).toEqual([ref]);
    expect(activeCharacter(togglePiece(on, ref)).pieces).toEqual([]);
  });

  it("ignores a seventh piece", () => {
    let cast = defaultCast();
    for (let n = 0; n < MAX_PIECES + 2; n += 1)
      cast = togglePiece(cast, { kind: "shop", slug: `p${n}` });
    expect(activeCharacter(cast).pieces).toHaveLength(MAX_PIECES);
  });

  it("adds a character, makes it the active one, and stops at the cap", () => {
    let cast = addCharacter(defaultCast());
    expect(cast.characters).toHaveLength(2);
    expect(cast.activeId).toBe("c2");
    for (let n = 0; n < 10; n += 1) cast = addCharacter(cast);
    expect(cast.characters).toHaveLength(MAX_CHARACTERS);
    expect(new Set(cast.characters.map((c) => c.id)).size).toBe(MAX_CHARACTERS);
  });

  it("only changes the active character", () => {
    let cast = renameActive(defaultCast(), "Rey");
    cast = addCharacter(cast);
    cast = renameActive(cast, "Dre");
    expect(cast.characters.map((c) => c.name)).toEqual(["Rey", "Dre"]);
    expect(activeCharacter(selectCharacter(cast, "c1")).name).toBe("Rey");
    expect(selectCharacter(cast, "zzz")).toBe(cast);
  });

  it("removes a character and moves on to another, but never removes the last", () => {
    let cast = addCharacter(renameActive(defaultCast(), "Rey"));
    cast = removeCharacter(cast, "c2");
    expect(cast).toEqual({ activeId: "c1", characters: [{ id: "c1", name: "Rey", pieces: [] }] });
    expect(removeCharacter(cast, "c1").characters).toEqual([{ id: "c1", name: "", pieces: [] }]);
  });

  it("labels an unnamed character by its place in the cast", () => {
    expect(characterLabel({ id: "c1", name: " ", pieces: [] }, 1)).toBe("Character 2");
    expect(characterLabel({ id: "c1", name: "Rey", pieces: [] }, 1)).toBe("Rey");
  });
});

describe("taking a cast from an episode", () => {
  it("collects everything each person wears, once, in order", () => {
    expect(episodeOutfits(TEMPLATE_EPISODE)).toEqual([
      {
        name: "Character A",
        pieces: [
          { kind: "shop", slug: "hoodie-pullover" },
          { kind: "shop", slug: "jogger-court" },
          { kind: "shop", slug: "tote-corner" },
        ],
      },
      {
        name: "Character B",
        pieces: [
          { kind: "shop", slug: "crew-sweat" },
          { kind: "shop", slug: "jogger-court" },
        ],
      },
    ]);
  });

  it("fills an empty save with the episode's cast", () => {
    const cast = mergeEpisodeCast(defaultCast(), TEMPLATE_EPISODE);
    expect(cast.characters.map((c) => c.name)).toEqual(["Character A", "Character B"]);
    expect(cast.activeId).toBe("c1");
    expect(activeCharacter(cast).pieces).toHaveLength(3);
  });

  it("keeps characters that were already saved, and updates one with the same name", () => {
    let saved = renameActive(defaultCast(), "Rey");
    saved = togglePiece(saved, { kind: "rack", slug: "abc" });
    saved = renameActive(addCharacter(saved), "character b");
    const cast = mergeEpisodeCast(saved, TEMPLATE_EPISODE);
    expect(cast.characters.map((c) => c.name)).toEqual(["Rey", "Character B", "Character A"]);
    expect(cast.characters[0]?.pieces).toEqual([{ kind: "rack", slug: "abc" }]);
    expect(cast.characters[1]?.pieces).toHaveLength(2);
    expect(activeCharacter(cast).name).toBe("Character A");
    expect(parseSavedCast(JSON.stringify(cast))).toEqual(cast);
  });

  it("keeps what a character with the same name already had on, after the episode's pieces", () => {
    let saved = renameActive(defaultCast(), "Character A");
    saved = togglePiece(saved, { kind: "rack", slug: "mine" });
    saved = togglePiece(saved, { kind: "shop", slug: "hoodie-pullover" });
    const cast = mergeEpisodeCast(saved, TEMPLATE_EPISODE);
    expect(cast.characters[0]?.pieces).toEqual([
      { kind: "shop", slug: "hoodie-pullover" },
      { kind: "shop", slug: "jogger-court" },
      { kind: "shop", slug: "tote-corner" },
      { kind: "rack", slug: "mine" },
    ]);
    // Sending the same cast twice changes nothing.
    expect(mergeEpisodeCast(cast, TEMPLATE_EPISODE)).toEqual(cast);
  });

  it("never dresses a character past the outfit cap when merging", () => {
    let saved = renameActive(defaultCast(), "Character A");
    for (let n = 0; n < MAX_PIECES; n += 1) {
      saved = togglePiece(saved, { kind: "rack", slug: `r${n}` });
    }
    const cast = mergeEpisodeCast(saved, TEMPLATE_EPISODE);
    expect(cast.characters[0]?.pieces).toHaveLength(MAX_PIECES);
    expect(cast.characters[0]?.pieces[0]).toEqual({ kind: "shop", slug: "hoodie-pullover" });
  });

  it("does not grow past the cap, and leaves the save alone when nobody fits", () => {
    let saved = renameActive(defaultCast(), "One");
    for (let n = 0; n < MAX_CHARACTERS; n += 1) saved = renameActive(addCharacter(saved), `N${n}`);
    const cast = mergeEpisodeCast(saved, TEMPLATE_EPISODE);
    expect(cast.characters).toHaveLength(MAX_CHARACTERS);
    expect(cast.characters.map((c) => c.name)).toEqual(saved.characters.map((c) => c.name));
    expect(cast.activeId).toBe(saved.activeId);
  });

  it("does not change the save it was given", () => {
    const saved = defaultCast();
    mergeEpisodeCast(saved, TEMPLATE_EPISODE);
    expect(saved).toEqual(defaultCast());
  });
});
