import { describe, expect, it } from "vitest";
import {
  NOTE_LIMIT,
  REPORT_REASONS,
  cleanNote,
  isReportReason,
  noteLength,
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
