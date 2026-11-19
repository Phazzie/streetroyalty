import { describe, expect, it } from "vitest";
import { returnNote } from "./return-note.ts";

describe("what a buyer is told on the way back from Stripe", () => {
  it("says the order was submitted only when it was", () => {
    expect(returnNote({ ok: true, action: "confirmed" })).toMatch(/was submitted/);
    expect(returnNote({ ok: true, action: "ignored", reason: "already_fulfilled" })).toMatch(
      /was submitted/,
    );
  });

  it.each([
    ["unpaid", /not cleared/],
    ["in_progress", /going in now/],
    ["amount_mismatch", /on hold/],
    ["canceled", /on hold/],
    ["needs_review", /on hold/],
    ["not_found", /could not be matched/],
    ["missing_provider_order", /could not be matched/],
    ["something new", /could not be matched/],
  ])("does not claim success when the server answers %s", (reason, expected) => {
    const note = returnNote({ ok: false, reason });
    expect(note).toMatch(expected);
    expect(note).not.toMatch(/was submitted/);
  });
});
