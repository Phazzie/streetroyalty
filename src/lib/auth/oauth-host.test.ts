import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { grokOAuthAllowed, isPreviewHostname } from "./oauth-host.ts";

describe("preview OAuth hosts", () => {
  it("treats only the sandbox preview as a preview host", () => {
    assert.equal(isPreviewHostname("app.grok-sandbox.com"), true);
    assert.equal(isPreviewHostname("GROK-SANDBOX.com"), true);
    assert.equal(isPreviewHostname("streetroyalty.com"), false);
    assert.equal(isPreviewHostname("localhost"), false);
    assert.equal(isPreviewHostname("not-grok-sandbox.com.evil.test"), false);
  });

  it("hides the baked client on every host that is not a preview", () => {
    assert.equal(grokOAuthAllowed("app.grok-sandbox.com", false), true);
    assert.equal(grokOAuthAllowed("localhost", false), false);
    assert.equal(grokOAuthAllowed("streetroyalty.com", false), false);
    assert.equal(grokOAuthAllowed("streetroyalty.com", true), true);
    assert.equal(grokOAuthAllowed("localhost", true), true);
  });
});
