import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DEFAULT_LIMITS, clientAddress, judgeSpend, readLimits, usageDay } from "./limits.ts";

describe("generation limits", () => {
  it("uses the defaults when nothing is set", () => {
    assert.deepEqual(readLimits({}), DEFAULT_LIMITS);
  });
  it("reads caps from the environment and ignores nonsense", () => {
    const limits = readLimits({
      AI_DAILY_VIDEO: "12",
      AI_VISITOR_IMAGE: " 7 ",
      AI_DAILY_TEXT: "lots",
      AI_VISITOR_VIDEO: "-3",
    });
    assert.equal(limits.video.global, 12);
    assert.equal(limits.image.visitor, 7);
    assert.equal(limits.text.global, DEFAULT_LIMITS.text.global);
    assert.equal(limits.video.visitor, DEFAULT_LIMITS.video.visitor);
  });
  it("lets zero switch a kind off", () => {
    const cap = readLimits({ AI_DAILY_VIDEO: "0" }).video;
    assert.deepEqual(judgeSpend({ visitor: 1, global: 1 }, cap), { ok: false, reason: "global" });
  });
  it("allows the request that reaches the cap and refuses the next one", () => {
    const cap = { visitor: 3, global: 10 };
    assert.deepEqual(judgeSpend({ visitor: 3, global: 10 }, cap), { ok: true });
    assert.deepEqual(judgeSpend({ visitor: 4, global: 5 }, cap), { ok: false, reason: "visitor" });
    assert.deepEqual(judgeSpend({ visitor: 1, global: 11 }, cap), { ok: false, reason: "global" });
  });
  it("judges the visitor alone before the site total is known", () => {
    assert.deepEqual(judgeSpend({ visitor: 1, global: null }, { visitor: 3, global: 0 }), {
      ok: true,
    });
  });
  it("names the day in UTC", () => {
    assert.equal(usageDay(new Date("2026-11-15T23:59:59Z")), "2026-11-15");
  });
  it("takes the first forwarded hop as the visitor and rejects junk", () => {
    const headers = (values: Record<string, string>) => ({
      get: (name: string) => values[name] ?? null,
    });
    assert.equal(
      clientAddress(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
      "203.0.113.9",
    );
    assert.equal(clientAddress(headers({ "x-real-ip": "2001:DB8::1" })), "2001:db8::1");
    assert.equal(
      clientAddress(headers({ "x-forwarded-for": "198.51.100.7", "x-real-ip": "203.0.113.9" })),
      "203.0.113.9",
    );
    assert.equal(clientAddress(headers({ "x-forwarded-for": "<script>" })), "unknown");
    assert.equal(clientAddress(headers({})), "unknown");
  });
});
