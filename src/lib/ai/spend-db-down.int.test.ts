import { beforeEach, describe, expect, it, vi } from "vitest";
import { spend } from "./guard.server.ts";
import { asVisitor } from "../../test/request.ts";

vi.mock("../db.ts", () => ({
  getSql: () => Promise.reject(new Error("connection refused")),
}));

/** If the database is unreachable the caps must keep counting somewhere, not switch off. */
describe("the AI caps with the database down", () => {
  beforeEach(() => {
    process.env.XAI_API_KEY = "xai-test-key";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    asVisitor("203.0.113.7");
  });

  it("still stops a visitor at their cap", async () => {
    process.env.AI_VISITOR_IMAGE = "2";
    expect((await spend("image")).ok).toBe(true);
    expect((await spend("image")).ok).toBe(true);
    expect(await spend("image")).toEqual({ ok: false, reason: "visitor" });
  });

  it("still stops the whole site at its cap", async () => {
    process.env.AI_DAILY_IMAGE = "2";
    for (const address of ["203.0.113.1", "203.0.113.2"]) {
      asVisitor(address);
      expect((await spend("image")).ok).toBe(true);
    }
    asVisitor("203.0.113.3");
    expect(await spend("image")).toEqual({ ok: false, reason: "global" });
  });
});
