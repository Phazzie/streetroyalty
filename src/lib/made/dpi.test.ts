import { describe, expect, it } from "vitest";
import { dotsPerInch, HOUSE_TEE_WIDTH_IN, pixelsWanted, sharpness, STUDIO_DPI } from "./dpi.ts";

describe("how sharp a picture prints", () => {
  it("spreads the picture across the print", () => {
    expect(dotsPerInch(1800, 12)).toBe(150);
    expect(dotsPerInch(600, 12)).toBe(50);
    expect(dotsPerInch(1000, 12)).toBe(83);
  });

  it("guards against nothing and nonsense", () => {
    expect(dotsPerInch(0, 12)).toBe(0);
    expect(dotsPerInch(-600, 12)).toBe(0);
    expect(dotsPerInch(600, 0)).toBe(0);
    expect(dotsPerInch(Number.NaN, 12)).toBe(0);
    expect(pixelsWanted(0)).toBe(0);
    expect(sharpness(Number.NaN)).toBe("blurry");
  });

  it("wants 1,800 pixels across the house tee, as the field guide says", () => {
    expect(pixelsWanted(HOUSE_TEE_WIDTH_IN)).toBe(1800);
    expect(STUDIO_DPI).toBe(150);
  });

  it("calls it sharp, soft or blurry", () => {
    expect(sharpness(150)).toBe("sharp");
    expect(sharpness(300)).toBe("sharp");
    expect(sharpness(149)).toBe("soft");
    expect(sharpness(75)).toBe("soft");
    expect(sharpness(74)).toBe("blurry");
    expect(sharpness(0)).toBe("blurry");
  });
});
