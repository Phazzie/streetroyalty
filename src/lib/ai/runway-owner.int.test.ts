import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { asVisitor } from "../../test/request.ts";
import { truncateAll } from "../../test/db.ts";
import { RunwayNotFound, assertRunwayOwner, claimRunway } from "./runway-owner.ts";

beforeEach(truncateAll);

describe("who may poll a runway video", () => {
  it("returns 404 unless the caller started it", async () => {
    await claimRunway("req_abcdefgh", "ada");
    await expect(assertRunwayOwner("req_abcdefgh", "ada")).resolves.toBeUndefined();
    await expect(assertRunwayOwner("req_abcdefgh", "bo")).rejects.toBeInstanceOf(RunwayNotFound);
    await expect(assertRunwayOwner("req_abcdefgh", "bo")).rejects.toMatchObject({ status: 404 });
    await expect(assertRunwayOwner("req_other1234", "ada")).rejects.toMatchObject({ status: 404 });
    await expect(assertRunwayOwner("", "ada")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to hash a visitor when the auth secret is missing", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    asVisitor("203.0.113.7");
    await expect(claimRunway("req_nosecret1", "dev-user")).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("keeps the shared dev user on the address that started the video", async () => {
    asVisitor("203.0.113.7");
    await claimRunway("req_visitor1", "dev-user");
    await expect(assertRunwayOwner("req_visitor1", "dev-user")).resolves.toBeUndefined();
    asVisitor("198.51.100.9");
    await expect(assertRunwayOwner("req_visitor1", "dev-user")).rejects.toMatchObject({ status: 404 });
  });

  it("checks the owner before it asks xAI, and records the owner when a video starts", () => {
    const text = readFileSync("src/lib/lab-api.ts", "utf8");
    const start = text.slice(text.indexOf("export const startRunway"), text.indexOf("export const pollRunway"));
    const poll = text.slice(text.indexOf("export const pollRunway"));
    expect(start.indexOf("claimRunway")).toBeGreaterThan(start.indexOf("runStart"));
    expect(poll.indexOf("assertRunwayOwner")).toBeGreaterThan(-1);
    expect(poll.indexOf("assertRunwayOwner")).toBeLessThan(poll.indexOf("runPoll"));
  });
});
