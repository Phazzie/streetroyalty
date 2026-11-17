import { describe, expect, it } from "vitest";
import {
  BIO_MAX,
  checkBio,
  checkDisplayName,
  checkHandle,
  handleCandidate,
  handleFromName,
  isHouseName,
  isReservedHandle,
  normalizeHandle,
} from "./handles.ts";

describe("a handle someone typed", () => {
  it("takes letters, numbers and underscores, lower cased, with any @ dropped", () => {
    expect(checkHandle("  @Ada_Royal9 ")).toEqual({ ok: true, value: "ada_royal9" });
    expect(normalizeHandle("@@BO")).toBe("bo");
  });

  it("refuses one that is too short or too long", () => {
    expect(checkHandle("ab").ok).toBe(false);
    expect(checkHandle("a".repeat(20)).ok).toBe(true);
    expect(checkHandle("a".repeat(21)).ok).toBe(false);
  });

  it("refuses spaces, dashes, dots and anything that could be markup", () => {
    for (const bad of ["ada royal", "ada-royal", "ada.royal", "<b>ada</b>", "ada/../me", "adá"])
      expect(checkHandle(bad).ok, bad).toBe(false);
  });

  it("keeps back the house words, whatever the case", () => {
    for (const word of ["admin", "me", "api", "studio", "shop", "rack", "lab", "street"])
      expect(checkHandle(word).ok, word).toBe(false);
    for (const word of ["Royalty", "STREETROYALTY", "support", "help", "login", "cart"])
      expect(checkHandle(word).ok, word).toBe(false);
    expect(checkHandle("orders").ok).toBe(false);
    expect(checkHandle("battles").ok).toBe(false);
    expect(isReservedHandle("@Admin")).toBe(true);
    expect(isReservedHandle("admiral")).toBe(false);
  });
});

describe("a handle made from an account name", () => {
  it("turns a name into the allowed shape", () => {
    expect(handleFromName("Ada Royal")).toBe("ada_royal");
    expect(handleFromName("  Zoë  D'Árcy!! ")).toBe("zoe_d_arcy");
    expect(handleFromName("Ada (preview)")).toBe("ada_preview");
  });

  it("pads a short name and gives a nameless account a plain start", () => {
    expect(handleFromName("Bo")).toBe("bo_maker");
    expect(handleFromName("")).toBe("maker");
    expect(handleFromName("!!!")).toBe("maker");
  });

  it("never runs past twenty characters or ends on an underscore", () => {
    const handle = handleFromName("The Longest Name On The Whole Rack By Far");
    expect(handle.length).toBeLessThanOrEqual(20);
    expect(handle).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(handle.endsWith("_")).toBe(false);
  });

  it("adds digits on a collision and stays inside the limit", () => {
    expect(handleCandidate("ada", 0)).toBe("ada");
    expect(handleCandidate("ada", 1)).toBe("ada2");
    expect(handleCandidate("ada", 9)).toBe("ada10");
    const long = "a".repeat(20);
    expect(handleCandidate(long, 1)).toBe(`${"a".repeat(19)}2`);
    expect(handleCandidate(long, 99)).toHaveLength(20);
  });
});

describe("a display name and a bio", () => {
  it("sees through look-alike letters, and still welcomes names in other alphabets", () => {
    // A Cyrillic у, a Cyrillic А, fullwidth letters and a Greek Ο.
    expect(checkDisplayName("Street Royalt\u0443").ok).toBe(false);
    expect(checkDisplayName("\u0410dmin").ok).toBe(false);
    expect(
      checkDisplayName(
        "\uff33\uff34\uff32\uff25\uff25\uff34 \uff32\uff2f\uff39\uff21\uff2c\uff34\uff39",
      ).ok,
    ).toBe(false);
    expect(checkDisplayName("Street R\u039fyalty").ok).toBe(false);
    expect(checkDisplayName("\u0414\u043c\u0438\u0442\u0440\u0438\u0439")).toEqual({
      ok: true,
      value: "\u0414\u043c\u0438\u0442\u0440\u0438\u0439",
    });
    expect(checkDisplayName("\u0391\u03b8\u03b7\u03bd\u03ac").ok).toBe(true);
  });

  it("wants a name of 2 to 40 characters on one line", () => {
    expect(checkDisplayName(" Ada   Royal ")).toEqual({ ok: true, value: "Ada Royal" });
    expect(checkDisplayName("A").ok).toBe(false);
    expect(checkDisplayName("a".repeat(41)).ok).toBe(false);
    expect(checkDisplayName("Ada\nRoyal")).toEqual({ ok: true, value: "Ada Royal" });
  });

  it("drops characters nobody can see, so a name cannot be blank or flip the line", () => {
    expect(checkDisplayName("\u200b\u200b\u200b").ok).toBe(false);
    expect(checkDisplayName("\u3164\u3164\u3164").ok).toBe(false);
    expect(checkDisplayName("\u200d\u200c\u200d").ok).toBe(false);
    expect(checkDisplayName("...").ok).toBe(false);
    expect(checkDisplayName("Ada\u202e Royal\u200b")).toEqual({ ok: true, value: "Ada Royal" });
    expect(checkBio("clash\u202e on purpose\ufeff")).toEqual({
      ok: true,
      value: "clash on purpose",
    });
  });

  it("keeps back handles that pass for the house, numbered or spaced out", () => {
    for (const handle of [
      "admin2",
      "street_royalty",
      "streetroyalty_shop",
      "support_9",
      "official1",
    ])
      expect(checkHandle(handle).ok, handle).toBe(false);
    for (const handle of ["rack2", "royal_ada", "street_sweeper", "adminah"])
      expect(checkHandle(handle).ok, handle).toBe(true);
  });

  it("will not let a maker trade under the house's name", () => {
    for (const name of ["Street Royalty", "STREET  ROYALTY", "street.royalty official", "Admin 2"])
      expect(checkDisplayName(name).ok, name).toBe(false);
    expect(isHouseName("Str\u00e9et Royalty")).toBe(true);
    for (const name of ["Royal Ada", "Street Sweeper", "Adminah"])
      expect(checkDisplayName(name).ok, name).toBe(true);
  });

  it("keeps a bio to 160 characters of plain text, stored as typed", () => {
    expect(checkBio("")).toEqual({ ok: true, value: "" });
    expect(checkBio("a".repeat(BIO_MAX)).ok).toBe(true);
    expect(checkBio("a".repeat(BIO_MAX + 1)).ok).toBe(false);
    // Markup is not stripped, because it is never drawn as markup. It stays text.
    expect(checkBio("<script>x</script>\r\n  two")).toEqual({
      ok: true,
      value: "<script>x</script> two",
    });
  });
});
