import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS } from "../ai/limits.ts";
import { readTryOnStatus } from "./status.server.ts";

describe("readTryOnStatus", () => {
  it("is off with no key, so the mirror can say so without trying", () => {
    expect(readTryOnStatus({})).toEqual({ on: false, perDay: DEFAULT_LIMITS.image.visitor });
    expect(readTryOnStatus({ XAI_API_KEY: "   " }).on).toBe(false);
  });

  it("is on with a key, and reports the visitor's daily allowance", () => {
    expect(readTryOnStatus({ XAI_API_KEY: "k", AI_VISITOR_IMAGE: "12" })).toEqual({
      on: true,
      perDay: 12,
    });
  });

  it("is off when pictures are capped at none, whatever the key", () => {
    expect(readTryOnStatus({ XAI_API_KEY: "k", AI_VISITOR_IMAGE: "0" })).toEqual({
      on: false,
      perDay: 0,
    });
  });

  it("gives away nothing but the two facts", () => {
    expect(Object.keys(readTryOnStatus({ XAI_API_KEY: "secret" })).sort()).toEqual([
      "on",
      "perDay",
    ]);
    expect(JSON.stringify(readTryOnStatus({ XAI_API_KEY: "secret" }))).not.toContain("secret");
  });
});
