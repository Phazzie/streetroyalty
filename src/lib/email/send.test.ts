import { describe, expect, it, vi } from "vitest";
import { mailConfig, sendEmail } from "./send.server.ts";

const EMAIL = { to: "a@example.com", subject: "Hi", text: "Hi", html: "<p>Hi</p>" };
const ENV = { RESEND_API_KEY: "re_test", EMAIL_FROM: "Street Royalty <orders@example.com>" };

describe("sendEmail", () => {
  it("sends nothing until a key and a from address are set", async () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "re_test" })).toBeNull();
    const fetchImpl = vi.fn();
    expect(await sendEmail(EMAIL, { env: {}, fetchImpl })).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts to Resend with the reply-to address", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "e1" }));
    const result = await sendEmail({ ...EMAIL, replyTo: "help@example.com" }, { env: ENV, fetchImpl });
    expect(result).toEqual({ sent: true, id: "e1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: ENV.EMAIL_FROM,
      to: ["a@example.com"],
      reply_to: "help@example.com",
    });
  });

  it("reports a refusal or a dropped connection instead of throwing", async () => {
    const refused = vi.fn(async () => Response.json({ message: "domain not verified" }, { status: 403 }));
    expect(await sendEmail(EMAIL, { env: ENV, fetchImpl: refused })).toEqual({
      sent: false,
      reason: "domain not verified",
    });
    const blank = vi.fn(async () => new Response("oops", { status: 500 }));
    expect(await sendEmail(EMAIL, { env: ENV, fetchImpl: blank })).toEqual({ sent: false, reason: "http_500" });
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await sendEmail(EMAIL, { env: ENV, fetchImpl: offline })).toEqual({ sent: false, reason: "offline" });
  });
});
