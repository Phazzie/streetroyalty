import { describe, expect, it } from "vitest";
import { cleanHandle, plainLink } from "./handle.ts";

describe("cleanHandle", () => {
  it("keeps a plain handle", () => {
    expect(cleanHandle("ada")).toBe("ada");
    expect(cleanHandle("big_bo.99")).toBe("big_bo.99");
    expect(cleanHandle(42)).toBe("42");
  });

  it("drops the @ and the capitals", () => {
    expect(cleanHandle("@Ada")).toBe("ada");
    expect(cleanHandle("  @@cy ")).toBe("cy");
  });

  it("refuses anything that is not a handle", () => {
    for (const bad of [
      "",
      "@",
      "two words",
      "<b>ada</b>",
      "ada/../x",
      "-ada",
      "a".repeat(33),
      null,
      undefined,
      {},
      ["ada"],
      true,
    ]) {
      expect(cleanHandle(bad)).toBeUndefined();
    }
  });
});

describe("plainLink", () => {
  it("shows the address without the scheme or the tag marker", () => {
    expect(plainLink("https://sr.example/rack/crown-heavy-tee?via=tag")).toBe(
      "sr.example/rack/crown-heavy-tee",
    );
    expect(plainLink("http://127.0.0.1:8106/rack/a")).toBe("127.0.0.1:8106/rack/a");
  });
});
