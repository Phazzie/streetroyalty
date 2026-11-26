import { describe, expect, it } from "vitest";
import { matchRealPiece } from "./real-pieces.ts";

describe("matching what someone says to a real blank", () => {
  it("finds the blank and a colour Printful stocks it in", () => {
    expect(matchRealPiece("black hoodie")).toMatchObject({
      blankId: "hoodie-pullover",
      colorName: "Black",
      category: "Tops",
      label: "Black Premium Pullover Hoodie",
    });
    expect(matchRealPiece("lavender hoodie")?.colorName).toBe("Lavender");
    expect(matchRealPiece("some sweatpants")?.blankId).toBe("jogger-court");
    expect(matchRealPiece("grey sweatshirt")?.blankId).toBe("crew-sweat");
    expect(matchRealPiece("a long sleeve tee")?.blankId).toBe("longsleeve-block");
    expect(matchRealPiece("white t-shirt")).toMatchObject({ blankId: "tee-heavy" });
    expect(matchRealPiece("a tote bag")).toMatchObject({
      blankId: "tote-corner",
      category: "Accessories",
    });
  });

  it("picks the nearest real colour when the exact one is not made", () => {
    const piece = matchRealPiece("hot pink hoodie");
    expect(piece?.blankId).toBe("hoodie-pullover");
    expect(["Lavender", "Dusty Rose"]).toContain(piece?.colorName);
  });

  it("takes the first real colour when none is said", () => {
    expect(matchRealPiece("hoodie")?.colorName).toBe("Black");
  });

  it("refuses what the shop does not make", () => {
    for (const spoken of [
      "leather loafers",
      "long wool coat",
      "a dress",
      "bucket hat",
      "sunglasses",
    ]) {
      expect(matchRealPiece(spoken), spoken).toBeNull();
    }
  });
});
