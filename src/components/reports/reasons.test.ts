import { describe, expect, it } from "vitest";
import {
  NOTE_LIMIT,
  REPORT_REASONS,
  cleanNote,
  isReportReason,
  noteLength,
  pileChoices,
  pileName,
  plural,
  reasonLabel,
  tallyReasons,
  waitingFor,
} from "./reasons.ts";

describe("report reasons", () => {
  it("are the five on the brief, in order", () => {
    expect(REPORT_REASONS.map((reason) => reason.label)).toEqual([
      "Stolen art or someone else's logo",
      "Hate or threats",
      "Nudity",
      "Scam or fake",
      "Something else",
    ]);
    expect(NOTE_LIMIT).toBe(280);
  });

  it("only accepts an id from the list", () => {
    expect(isReportReason("stolen")).toBe(true);
    expect(isReportReason("Stolen")).toBe(false);
    expect(isReportReason("")).toBe(false);
    expect(isReportReason(undefined)).toBe(false);
    expect(isReportReason({ id: "stolen" })).toBe(false);
  });

  it("labels a reason, and calls anything unknown something else", () => {
    expect(reasonLabel("scam")).toBe("Scam or fake");
    expect(reasonLabel("stolen", "short")).toBe("Stolen art");
    expect(reasonLabel("made-up")).toBe("Something else");
  });
});

describe("cleaning a note", () => {
  it("leaves markup, quotes and emoji exactly as typed", () => {
    const text = `<b onclick="x()">it's</b> a "copy" & a 🧢`;
    expect(cleanNote(text)).toBe(text);
  });

  it("trims, and folds line breaks and runs of spaces into one space", () => {
    expect(cleanNote("  one\n\ntwo\t\tthree   four  ")).toBe("one two three four");
  });

  it("drops null bytes and the marks that flip text direction", () => {
    expect(cleanNote("a\u0000b")).toBe("a b");
    expect(cleanNote("safe‮txt.exe⁦")).toBe("safetxt.exe");
  });

  it("turns anything that is not text into text", () => {
    expect(cleanNote(undefined)).toBe("");
    expect(cleanNote(null)).toBe("");
    expect(cleanNote(42)).toBe("42");
  });

  it("counts an emoji as one character", () => {
    expect(noteLength("👑👑")).toBe(2);
    expect(noteLength("abc")).toBe(3);
  });
});

describe("tallying reasons", () => {
  it("puts the most common first and keeps list order on a tie", () => {
    expect(tallyReasons(["other", "hate", "stolen", "hate", "stolen"])).toEqual([
      { reason: "stolen", count: 2 },
      { reason: "hate", count: 2 },
      { reason: "other", count: 1 },
    ]);
  });

  it("files an unknown reason under something else", () => {
    expect(tallyReasons(["mystery", "other"])).toEqual([{ reason: "other", count: 2 }]);
    expect(tallyReasons([])).toEqual([]);
  });
});

describe("how long a pile has waited", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  it.each([
    ["2026-11-17T11:59:30Z", "just now"],
    ["2026-11-17T11:40:00Z", "20 minutes"],
    ["2026-11-17T11:00:00Z", "1 hour"],
    ["2026-11-17T07:00:00Z", "5 hours"],
    ["2026-11-16T11:00:00Z", "1 day"],
    ["2026-11-10T12:00:00Z", "7 days"],
    ["2026-11-18T12:00:00Z", "just now"],
    ["not a date", "just now"],
  ])("%s reads as %s", (since, expected) => {
    expect(waitingFor(since, now)).toBe(expected);
  });
});

describe("what a pile offers", () => {
  const piece = { slug: "loud-hoodie", title: "Loud Hoodie", mockupUrl: null, maker: null };
  const maker = { handle: "ada", name: "Ada" };

  it("a piece on the rack can be kept or taken down, and taking down asks first", () => {
    const choice = pileChoices({ kind: "piece", piece: { ...piece, onRack: true }, maker: null });
    expect(choice.keep).toBe("Keep it");
    expect(choice.remove).toBe("Take it off the rack");
    expect(choice.confirm).toMatch(/keeps it as a draft/);
    expect(choice.stamp).toBe("Off the rack");
  });

  it("a piece already off the rack, or deleted, can only be cleared", () => {
    for (const gone of [{ ...piece, onRack: false }, null]) {
      const choice = pileChoices({ kind: "piece", piece: gone, maker: null });
      expect(choice).toMatchObject({ keep: null, remove: "Clear these reports", confirm: null });
    }
  });

  it("a maker with a bio can be kept or have the bio cleared, and clearing asks first", () => {
    const choice = pileChoices({ kind: "maker", piece: null, maker: { ...maker, bio: "Hi." } });
    expect(choice.keep).toBe("Keep");
    expect(choice.remove).toBe("Clear the bio");
    expect(choice.confirm).toMatch(/account and the pieces stay/);
    expect(choice.stamp).toBe("Bio cleared");
  });

  it("a maker with an empty bio has nothing to clear but the reports", () => {
    const choice = pileChoices({ kind: "maker", piece: null, maker: { ...maker, bio: "" } });
    expect(choice).toMatchObject({ keep: "Keep", remove: "Clear these reports", confirm: null });
    expect(pileChoices({ kind: "maker", piece: null, maker: null }).keep).toBeNull();
  });

  it("never offers to delete anything", () => {
    const every = [
      pileChoices({ kind: "piece", piece: { ...piece, onRack: true }, maker: null }),
      pileChoices({ kind: "piece", piece: null, maker: null }),
      pileChoices({ kind: "maker", piece: null, maker: { ...maker, bio: "Hi." } }),
      pileChoices({ kind: "maker", piece: null, maker: null }),
    ];
    expect(JSON.stringify(every)).not.toMatch(/delete|ban|remove the account/i);
  });

  it("names a pile by its piece, its maker, or what is left of it", () => {
    expect(pileName({ kind: "piece", piece: { ...piece, onRack: true }, maker: null })).toBe(
      "Loud Hoodie",
    );
    expect(pileName({ kind: "maker", piece: null, maker: { ...maker, bio: "" } })).toBe("@ada");
    expect(pileName({ kind: "piece", piece: null, maker: null })).toBe("A deleted piece");
    expect(pileName({ kind: "maker", piece: null, maker: null })).toBe("A maker with no page");
  });

  it("counts in plain words", () => {
    expect(plural(1, "report", "reports")).toBe("1 report");
    expect(plural(0, "report", "reports")).toBe("0 reports");
    expect(plural(12, "pile", "piles")).toBe("12 piles");
  });
});
