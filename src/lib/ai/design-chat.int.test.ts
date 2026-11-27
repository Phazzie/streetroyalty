import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeChat } from "./grok.server.ts";
import { remaining, spend } from "./guard.server.ts";
import { parseAnswer, systemPrompt } from "../studio/chat.ts";
import { truncateAll } from "../../test/db.ts";
import { xaiChat } from "../../test/fixtures/xai.ts";
import { seenTo, server } from "../../test/msw/server.ts";
import { asVisitor } from "../../test/request.ts";

beforeEach(async () => {
  await truncateAll();
  process.env.XAI_API_KEY = "xai-test-key";
  asVisitor("203.0.113.7");
});

describe("the design chat's call to xAI", () => {
  it("sends the instructions and the turn, asks for JSON, and the answer parses into edits", async () => {
    const answer = JSON.stringify({ reply: "Red now.", ops: [{ op: "edit", layer: "t1", color: "#e0182d" }] });
    server.use(http.post("https://api.x.ai/v1/chat/completions", () => HttpResponse.json(xaiChat(answer))));
    const raw = await completeChat([
      { role: "system", content: systemPrompt() },
      { role: "user", content: "make it red" },
    ]);
    expect(parseAnswer(raw ?? "")).toEqual({ reply: "Red now.", ops: [{ op: "edit", layer: "t1", color: "#e0182d" }] });
    const [call] = seenTo("api.x.ai");
    await vi.waitFor(() => expect(call?.body).not.toBe(""));
    const body = JSON.parse(call?.body ?? "{}");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(["system", "user"]);
  });

  it("answers nothing, without throwing, when xAI fails or there is no key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(http.post("https://api.x.ai/v1/chat/completions", () => HttpResponse.json({}, { status: 503 })));
    expect(await completeChat([{ role: "user", content: "hi" }])).toBeNull();
    delete process.env.XAI_API_KEY;
    expect(await completeChat([{ role: "user", content: "hi" }])).toBeNull();
  });
});

describe("what a visitor has left", () => {
  it("counts down as they spend, and reading it spends nothing", async () => {
    process.env.AI_VISITOR_IMAGE = "3";
    expect(await remaining("image")).toBe(3);
    expect(await remaining("image")).toBe(3);
    await spend("image");
    expect(await remaining("image")).toBe(2);
    await spend("image");
    await spend("image");
    await spend("image");
    expect(await remaining("image")).toBe(0);
  });
});
