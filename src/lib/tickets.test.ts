import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runwayTicketOutput } from "./tickets.ts";

describe("runwayTicketOutput", () => {
  it("keeps a remote link and drops inline bytes", () => {
    assert.equal(runwayTicketOutput("https://cdn.example/clip.mp4", "req-1"), "https://cdn.example/clip.mp4");
    assert.equal(runwayTicketOutput("data:video/mp4;base64,AAAA", "req-1"), "req-1");
  });
});
