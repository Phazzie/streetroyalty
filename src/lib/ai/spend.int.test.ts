import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { guardedText } from "./grok.server.ts";
import { admit, count, spend } from "./guard.server.ts";
import { truncateAll } from "../../test/db.ts";
import { xaiChat } from "../../test/fixtures/xai.ts";
import { seenTo, server } from "../../test/msw/server.ts";
import { asVisitor, clearRequest } from "../../test/request.ts";

/**
 * The daily caps are the only thing between a public page and the owner's xAI
 * bill. These run them against the real counter table.
 */

async function usage() {
  const sql = await getSql();
  return sql<{ day: string; bucket: string; kind: string; count: number }>`
    select day, bucket, kind, count from ai_usage order by bucket, kind
  `;
}

async function spendTimes(times: number, kind: "image" | "video" | "text" = "image") {
  const verdicts = [];
  for (let index = 0; index < times; index += 1) verdicts.push((await spend(kind)).ok);
  return verdicts;
}

beforeEach(async () => {
  await truncateAll();
  process.env.XAI_API_KEY = "xai-test-key";
  asVisitor("203.0.113.7");
});

describe("the gate in front of a paid call", () => {
  it("says unavailable and counts nothing when there is no key", async () => {
    delete process.env.XAI_API_KEY;
    expect(await admit("image")).toBe("unavailable");
    process.env.XAI_API_KEY = "   ";
    expect(await admit("image")).toBe("unavailable");
    expect(await usage()).toEqual([]);
  });

  it("lets a visitor through up to their daily cap, then stops them", async () => {
    process.env.AI_VISITOR_IMAGE = "3";
    expect(await spendTimes(5)).toEqual([true, true, true, false, false]);
    expect(await admit("image")).toBe("limit");
  });

  it("gives each visitor their own allowance", async () => {
    process.env.AI_VISITOR_IMAGE = "2";
    expect(await spendTimes(3)).toEqual([true, true, false]);
    asVisitor("198.51.100.9");
    expect(await spendTimes(3)).toEqual([true, true, false]);
  });

  it("stops everyone once the whole site hits its daily cap", async () => {
    process.env.AI_VISITOR_IMAGE = "3";
    process.env.AI_DAILY_IMAGE = "4";
    expect(await spendTimes(3)).toEqual([true, true, true]);
    asVisitor("198.51.100.9");
    expect(await spendTimes(3)).toEqual([true, false, false]);
    asVisitor("192.0.2.44");
    expect((await spend("image")).ok).toBe(false);
  });

  it("keeps pictures, video and text on separate counters", async () => {
    process.env.AI_VISITOR_IMAGE = "1";
    process.env.AI_VISITOR_VIDEO = "1";
    expect(await spendTimes(2, "image")).toEqual([true, false]);
    expect(await spendTimes(2, "video")).toEqual([true, false]);
    expect((await spend("text")).ok).toBe(true);
  });

  it("turns a kind off entirely when its site cap is zero", async () => {
    process.env.AI_DAILY_VIDEO = "0";
    expect((await spend("video")).ok).toBe(false);
  });

  it("falls back to the default of two videos when the cap is nonsense", async () => {
    process.env.AI_VISITOR_VIDEO = "lots";
    expect(await spendTimes(3, "video")).toEqual([true, true, false]);
  });

  it("stops exactly at each default allowance and lets the last one through", async () => {
    expect(await spendTimes(3, "video")).toEqual([true, true, false]);
    expect(await spendTimes(11, "image")).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    const texts = await spendTimes(41, "text");
    expect(texts.filter(Boolean)).toHaveLength(40);
    expect(texts[40]).toBe(false);
  });

  it("counts a signed-in account once, whichever address they use", async () => {
    process.env.AI_VISITOR_IMAGE = "1";
    asVisitor("203.0.113.7");
    expect((await spend("image", "ada")).ok).toBe(true);
    asVisitor("198.51.100.9");
    expect(await spend("image", "ada")).toEqual({ ok: false, reason: "visitor" });
    expect((await spend("image", "bo")).ok).toBe(true);
    asVisitor("203.0.113.7");
    expect((await spend("image", "   ")).ok).toBe(true);
    expect(await spend("image", "")).toEqual({ ok: false, reason: "visitor" });
  });

  it("still stops the whole site when separate accounts are each under their cap", async () => {
    process.env.AI_VISITOR_IMAGE = "5";
    process.env.AI_DAILY_IMAGE = "2";
    expect((await spend("image", "ada")).ok).toBe(true);
    expect((await spend("image", "bo")).ok).toBe(true);
    expect(await spend("image", "cy")).toEqual({ ok: false, reason: "global" });
  });

  it("admits exactly the cap when fifty requests arrive at once", async () => {
    process.env.AI_VISITOR_IMAGE = "30";
    const verdicts = await Promise.all(Array.from({ length: 50 }, () => spend("image")));
    expect(verdicts.filter((verdict) => verdict.ok)).toHaveLength(30);
  });

  it("holds the site cap when many visitors arrive at once", async () => {
    process.env.AI_DAILY_IMAGE = "10";
    const verdicts = await Promise.all(
      Array.from({ length: 40 }, (_, index) => {
        asVisitor(`203.0.113.${index + 1}`);
        return spend("image");
      }),
    );
    expect(verdicts.filter((verdict) => verdict.ok)).toHaveLength(10);
  });

  it("starts a fresh allowance at midnight UTC", async () => {
    process.env.AI_VISITOR_IMAGE = "1";
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-01T23:59:00Z") });
    expect(await spendTimes(2)).toEqual([true, false]);
    vi.setSystemTime(new Date("2026-03-02T00:00:01Z"));
    expect((await spend("image")).ok).toBe(true);
  });

  it("puts every caller without a readable address in one shared bucket, which errs toward spending less", async () => {
    process.env.AI_VISITOR_IMAGE = "2";
    asVisitor("not an address");
    expect(await spendTimes(2)).toEqual([true, true]);
    clearRequest();
    expect((await spend("image")).ok).toBe(false);
  });

  it("counts other things the same way, such as checkouts", async () => {
    const cap = { visitor: 2, global: 100 };
    expect((await count("checkout", cap)).ok).toBe(true);
    expect((await count("checkout", cap)).ok).toBe(true);
    expect(await count("checkout", cap)).toEqual({ ok: false, reason: "visitor" });
  });
});

describe("what the counters store", () => {
  it("keeps a one-day hash of an account, never the account id", async () => {
    await spend("image", "ada-user-id");
    const rows = await usage();
    expect(rows.map((row) => row.bucket).sort()).toEqual([
      "global",
      expect.stringMatching(/^u:[0-9a-f]{24}$/),
    ]);
    expect(JSON.stringify(rows)).not.toContain("ada-user-id");
  });

  it("keeps a one-day hash, never the visitor's address", async () => {
    await spend("image");
    const rows = await usage();
    expect(rows.map((row) => row.bucket).sort()).toEqual([
      "global",
      expect.stringMatching(/^v:[0-9a-f]{24}$/),
    ]);
    expect(JSON.stringify(rows)).not.toContain("203.0.113.7");
  });

  it("gives the same visitor a different bucket the next day, so they cannot be followed", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-01T12:00:00Z") });
    await spend("image");
    vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
    await spend("image");
    const buckets = (await usage())
      .map((row) => row.bucket)
      .filter((bucket) => bucket !== "global");
    expect(new Set(buckets).size).toBe(2);
  });

  it("deletes counters older than a week", async () => {
    const sql = await getSql();
    await sql`insert into ai_usage (day, bucket, kind, count) values ('2020-01-01', 'global', 'image', 9)`;
    await spend("image");
    await vi.waitFor(async () => {
      expect((await usage()).some((row) => row.day === "2020-01-01")).toBe(false);
    });
  });
});

describe("a text call to xAI", () => {
  const chat = (reply = "Fit goes hard.") =>
    server.use(
      http.post("https://api.x.ai/v1/chat/completions", () => HttpResponse.json(xaiChat(reply))),
    );

  it("is sent once, with the key, when the visitor is under the cap", async () => {
    chat();
    expect(await guardedText("Rate this outfit")).toBe("Fit goes hard.");
    const [call] = seenTo("api.x.ai");
    expect(seenTo("api.x.ai")).toHaveLength(1);
    expect(call?.headers.get("authorization")).toBe("Bearer xai-test-key");
    await vi.waitFor(() => expect(call?.body).not.toBe(""));
    expect(JSON.parse(call?.body ?? "{}")).toEqual({
      model: "grok-4.5",
      max_tokens: 180,
      temperature: 0.4,
      messages: [{ role: "user", content: "Rate this outfit" }],
    });
  });

  it("charges a signed-in text call to that account, not the address", async () => {
    chat();
    process.env.AI_VISITOR_TEXT = "1";
    asVisitor("203.0.113.7");
    expect(await guardedText("one", 20, "ada")).toBeTruthy();
    asVisitor("198.51.100.9");
    expect(await guardedText("two", 20, "ada")).toBeNull();
    expect(await guardedText("three", 20, "bo")).toBeTruthy();
    expect(seenTo("api.x.ai")).toHaveLength(2);
  });

  it("is not sent at all once the visitor is over the cap", async () => {
    chat();
    process.env.AI_VISITOR_TEXT = "2";
    expect(await guardedText("one")).toBeTruthy();
    expect(await guardedText("two")).toBeTruthy();
    expect(await guardedText("three")).toBeNull();
    expect(await guardedText("four")).toBeNull();
    expect(seenTo("api.x.ai")).toHaveLength(2);
  });

  it("is not sent and not counted when there is no key", async () => {
    delete process.env.XAI_API_KEY;
    expect(await guardedText("hello")).toBeNull();
    expect(seenTo("api.x.ai")).toEqual([]);
    expect(await usage()).toEqual([]);
  });

  it("cuts an oversized prompt to 1200 characters before sending", async () => {
    chat();
    await guardedText("x".repeat(5000));
    const [call] = seenTo("api.x.ai");
    await vi.waitFor(() => expect(call?.body).not.toBe(""));
    expect(JSON.parse(call?.body ?? "{}").messages[0].content).toHaveLength(1200);
  });

  it.each([
    ["an error from xAI", () => HttpResponse.json({ error: "overloaded" }, { status: 503 })],
    ["a reply with no text in it", () => HttpResponse.json({ choices: [] })],
    ["a reply that is not JSON", () => new HttpResponse("<html>bad gateway</html>")],
    ["a dropped connection", () => HttpResponse.error()],
  ])("answers nothing, without throwing, on %s", async (_what, respond) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(http.post("https://api.x.ai/v1/chat/completions", respond));
    expect(await guardedText("hello")).toBeNull();
  });
});
