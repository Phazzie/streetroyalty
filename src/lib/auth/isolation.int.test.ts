import { describe, expect, it } from "vitest";
import { CrossSiteRequestError, assertSameSiteRequest } from "./isolation.server.ts";
import { setRequest } from "../../test/request.ts";

/**
 * Apps on the same parent domain are "same-site" to each other, so a hostile
 * neighbour's page can send a request here that carries this app's cookie.
 * This check is what stops it. Each row is a request a browser could send.
 */

function request(headers: Record<string, string>, method = "POST"): void {
  const base = setRequest({ headers });
  // setRequest builds a GET. Rebuild it when the case needs another method.
  if (method !== "GET") {
    Object.defineProperty(base, "method", { value: method });
  }
}

describe("requests from outside the app", () => {
  it.each([
    ["the app's own page", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" }],
    ["an address-bar load", { "sec-fetch-site": "none", "sec-fetch-mode": "navigate" }],
    ["a server or a script with no browser", {}],
  ])("lets through %s", (_what, headers) => {
    request(headers);
    expect(() => assertSameSiteRequest()).not.toThrow();
  });

  it.each([
    ["a fetch from a sibling app", { "sec-fetch-site": "same-site", "sec-fetch-mode": "cors" }],
    ["a fetch from another site", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" }],
    [
      "a no-cors request from another site",
      { "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" },
    ],
    [
      "a form posted from a sibling app",
      { "sec-fetch-site": "same-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
    ],
    [
      "a form posted from another site",
      {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
    ],
  ])("blocks %s", (_what, headers) => {
    request(headers, "POST");
    expect(() => assertSameSiteRequest()).toThrow(CrossSiteRequestError);
  });

  it("lets a top-level GET navigation through, which is how a sign-in redirect arrives", () => {
    request(
      {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
      "GET",
    );
    expect(() => assertSameSiteRequest()).not.toThrow();
  });

  it.each(["object", "embed"])(
    "blocks a cross-site GET that loads the app inside an <%s>",
    (dest) => {
      request(
        { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": dest },
        "GET",
      );
      expect(() => assertSameSiteRequest()).toThrow(CrossSiteRequestError);
    },
  );

  it("blocks a cross-site scripted GET, which could read a response", () => {
    request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" }, "GET");
    expect(() => assertSameSiteRequest()).toThrow(CrossSiteRequestError);
  });

  it("answers with a 403", () => {
    request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" });
    try {
      assertSameSiteRequest();
      expect.unreachable();
    } catch (error) {
      expect((error as CrossSiteRequestError).status).toBe(403);
    }
  });
});
