import { describe, expect, it } from "vitest";
import {
  activeCharacter,
  addCharacter,
  characterLabel,
  defaultCast,
  MAX_CHARACTERS,
  MAX_PIECES,
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
    cast = togglePiece(cast, { kind: "shop", slug: "lilac-set-hoodie" });
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
    const ref = { kind: "shop", slug: "crown-cap" } as const;
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
