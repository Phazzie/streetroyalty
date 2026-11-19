import { describe, expect, it } from "vitest";
import { clock, dayKey, dayLabel, groupByDay } from "./days.ts";

// Built from local parts, so these hold in any time zone the tests run in.
const NOW = new Date(2026, 10, 17, 18, 0);
const at = (day: number, hour: number, month = 10, year = 2026) =>
  new Date(year, month, day, hour, 0).toISOString();

describe("days", () => {
  it("names a day by the reader's own calendar", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 10, 17, 0, 0))).toBe("2026-11-17");
  });

  it("says Today and Yesterday, then writes the date out", () => {
    expect(dayLabel(new Date(2026, 10, 17, 0, 1), NOW)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 16, 23, 59), NOW)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 10, 14, 12, 0), NOW, "en-US")).toBe("Saturday, November 14");
    expect(dayLabel(new Date(2025, 11, 31, 12, 0), NOW, "en-US")).toBe(
      "Wednesday, December 31, 2025",
    );
  });

  it("finds yesterday across the start of a month and a year", () => {
    expect(dayLabel(new Date(2026, 9, 31, 9, 0), new Date(2026, 10, 1, 9, 0))).toBe("Yesterday");
    expect(dayLabel(new Date(2025, 11, 31, 9, 0), new Date(2026, 0, 1, 0, 30))).toBe("Yesterday");
  });

  it("groups a newest-first feed without reordering it", () => {
    const feed = [
      { id: "a", when: at(17, 17) },
      { id: "b", when: at(17, 1) },
      { id: "c", when: at(16, 22) },
      { id: "d", when: at(12, 9) },
      { id: "e", when: at(12, 8) },
    ];
    const groups = groupByDay(feed, NOW, "en-US");
    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Thursday, November 12",
    ]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["a", "b"],
      ["c"],
      ["d", "e"],
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2026-11-17", "2026-11-16", "2026-11-12"]);
  });

  it("skips a row with a time it cannot read, and handles an empty feed", () => {
    expect(groupByDay([], NOW)).toEqual([]);
    const groups = groupByDay([{ when: "not a time" }, { when: at(17, 9) }], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(1);
  });

  it("writes the time of day short", () => {
    expect(clock(at(17, 17), "en-US")).toBe("5:00 PM");
    expect(clock("nope")).toBe("");
  });
});
