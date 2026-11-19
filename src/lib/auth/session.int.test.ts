import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthPopupRequest } from "./popup.server.ts";
import { auth, authConfigured, grokOAuthButtonsVisible, SESSION_TOKEN_COOKIE } from "./server.ts";
import { UnauthorizedError, getSessionUser, requireUserId } from "./verify.server.ts";
import { truncateAll } from "../../test/db.ts";
import { setRequest } from "../../test/request.ts";

/**
 * The real sign-in stack on the test database: an account is created through
 * Better Auth, and the server is then asked who is calling. Everything in the
 * studio trusts the answer.
 */

const ORIGIN = "http://localhost:8080";

async function signUp(email: string) {
  const response = await auth.api.signUpEmail({
    body: { email, password: "correct horse battery", name: "Ada" },
    headers: new Headers({ origin: ORIGIN }),
    asResponse: true,
  });
  const body = (await response.json()) as { token?: string; user?: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { status: response.status, token: body.token ?? "", userId: body.user?.id ?? "", cookie };
}

beforeEach(async () => {
  await truncateAll();
  setRequest({ url: `${ORIGIN}/` });
});

describe("who is calling", () => {
  it("is nobody without a session", async () => {
    expect(await getSessionUser()).toBeNull();
    await expect(requireUserId()).rejects.toThrow(UnauthorizedError);
  });

  it("is the account that signed up, by cookie", async () => {
    const ada = await signUp("ada@example.com");
    expect(ada.status).toBe(200);
    setRequest({ url: `${ORIGIN}/`, headers: { cookie: ada.cookie } });
    expect(await requireUserId()).toBe(ada.userId);
    expect(await getSessionUser()).toEqual({ id: ada.userId, email: "ada@example.com" });
  });

  it("is the account that signed up, by the token the preview forwards", async () => {
    const ada = await signUp("ada@example.com");
    expect(await requireUserId(ada.token)).toBe(ada.userId);
  });

  it("keeps two accounts apart", async () => {
    const ada = await signUp("ada@example.com");
    const bo = await signUp("bo@example.com");
    expect(ada.userId).not.toBe(bo.userId);
    expect(await requireUserId(ada.token)).toBe(ada.userId);
    expect(await requireUserId(bo.token)).toBe(bo.userId);
  });

  it.each([
    ["a made-up token", () => "not-a-real-token"],
    [
      "a real token with one character changed",
      (token: string) => `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`,
    ],
    ["a user id used as a token", (_token: string, userId: string) => userId],
  ])("is nobody with %s", async (_what, forge) => {
    const ada = await signUp("ada@example.com");
    await expect(requireUserId(forge(ada.token, ada.userId))).rejects.toThrow(UnauthorizedError);
  });

  it("is nobody with a cookie whose signature was cut off", async () => {
    const ada = await signUp("ada@example.com");
    const unsigned = ada.cookie.replace(/(session_token=[^.;]+)\.[^;]+/, "$1");
    expect(unsigned).not.toBe(ada.cookie);
    setRequest({ url: `${ORIGIN}/`, headers: { cookie: unsigned } });
    await expect(requireUserId()).rejects.toThrow(UnauthorizedError);
  });

  it("deletes the session on sign-out, and the old cookie is dead once its five-minute cache runs out", async () => {
    const ada = await signUp("ada@example.com");
    await auth.api.signOut({ headers: new Headers({ cookie: ada.cookie, origin: ORIGIN }) });

    const { getSql } = await import("../db.ts");
    const sql = await getSql();
    const sessions = await sql<{ n: number }>`select count(*) as n from "session"`;
    expect(sessions[0]?.n).toBe(0);

    // The platform's auth config caches a session in the cookie for 300 seconds,
    // so a copy of the cookie outlives sign-out by at most that long.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 301_000 });
    setRequest({ url: `${ORIGIN}/`, headers: { cookie: ada.cookie } });
    await expect(requireUserId()).rejects.toThrow(UnauthorizedError);
  });

  it("refuses a second account on the same email", async () => {
    await signUp("ada@example.com");
    const again = await signUp("ada@example.com");
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.token).toBe("");
  });

  it("signs in with email on a public host that has no Google or X keys", async () => {
    expect(authConfigured).toBe(true);
    const ada = await signUp("public@example.com");
    expect(ada.status).toBe(200);
    setRequest({ url: "https://streetroyalty.example/login" });
    expect(grokOAuthButtonsVisible()).toBe(false);
    expect(await requireUserId(ada.token)).toBe(ada.userId);
    const signedIn = await auth.api.signInEmail({
      body: { email: "public@example.com", password: "correct horse battery" },
      headers: new Headers({ origin: ORIGIN }),
      asResponse: true,
    });
    expect(signedIn.status).toBe(200);
  });

  it("refuses the wrong password and accepts the right one", async () => {
    await signUp("ada@example.com");
    const attempt = (password: string) =>
      auth.api.signInEmail({
        body: { email: "ada@example.com", password },
        headers: new Headers({ origin: ORIGIN }),
        asResponse: true,
      });
    expect((await attempt("wrong password entirely")).status).toBe(401);
    expect((await attempt("correct horse battery")).status).toBe(200);
  });

  it("stores the password hashed, never as typed", async () => {
    await signUp("ada@example.com");
    const { getSql } = await import("../db.ts");
    const sql = await getSql();
    const rows = await sql<{ password: string | null }>`select "password" from "account"`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.password).toBeTruthy();
    expect(rows[0]?.password).not.toContain("correct horse battery");
  });
});

describe("the sign-in popup", () => {
  const popup = (query: string, cookie?: string) =>
    handleAuthPopupRequest(
      new Request(`${ORIGIN}/auth/popup${query}`, { headers: cookie ? { cookie } : {} }),
    );

  it("answers 400 when it is not told which provider to use", async () => {
    expect((await popup("")).status).toBe(400);
    expect((await popup("?providerId=%20")).status).toBe(400);
  });

  it("hands the session token back to the opener when sign-in finished", async () => {
    const response = await popup("?done=1", `${SESSION_TOKEN_COOKIE}=tok123.sig`);
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain('"token":"tok123.sig"');
  });

  it("hands back no token when sign-in failed, even if a cookie is present", async () => {
    const html = await (
      await popup("?done=1&error=access_denied", `${SESSION_TOKEN_COOKIE}=tok123`)
    ).text();
    expect(html).toContain('"token":null');
    expect(html).not.toContain("tok123");
  });

  it("cannot be made to run markup carried in the error text", async () => {
    const html = await (
      await popup(`?done=1&error=${encodeURIComponent("</script><script>alert(1)</script>")}`)
    ).text();
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });
});
