import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/rack/do-better-tee")).toBe("/rack/do-better-tee");
    expect(safeNext("/cart")).toBe("/cart");
  });
  it("falls back to the studio for anything else", () => {
    expect(safeNext(undefined)).toBe("/studio");
    expect(safeNext("https://evil.example")).toBe("/studio");
    expect(safeNext("//evil.example")).toBe("/studio");
    expect(safeNext("/\\evil.example")).toBe("/studio");
    expect(safeNext(42)).toBe("/studio");
  });
});
