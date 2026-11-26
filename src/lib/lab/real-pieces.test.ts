import { describe, expect, it } from "vitest";
import { interpret } from "../split-pieces.ts";
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

describe("what the lab hears, start to finish", () => {
  const heard = (text: string) => {
    const intent = interpret(text);
    expect(intent.type, text).toBe("pieces");
    if (intent.type !== "pieces") return [];
    return intent.pieces.map((piece) => matchRealPiece(piece.spoken)?.blankId ?? null);
  };

  it("hears every blank the lab offers, one at a time", () => {
    expect(heard("black hoodie")).toEqual(["hoodie-pullover"]);
    expect(heard("black sweatpants")).toEqual(["jogger-court"]);
    expect(heard("bone crewneck")).toEqual(["crew-sweat"]);
    expect(heard("white tee")).toEqual(["tee-heavy"]);
    expect(heard("black long-sleeve tee")).toEqual(["longsleeve-block"]);
    expect(heard("black long sleeve")).toEqual(["longsleeve-block"]);
    expect(heard("oyster tote bag")).toEqual(["tote-corner"]);
  });

  it("splits a whole outfit into its real pieces", () => {
    expect(heard("black hoodie and black sweatpants")).toEqual([
      "hoodie-pullover",
      "jogger-court",
    ]);
    expect(heard("lavender hoodie, carbon grey sweatpants and a black tote")).toEqual([
      "hoodie-pullover",
      "jogger-court",
      "tote-corner",
    ]);
  });

  it("draws the long-sleeve with long sleeves", () => {
    expect(matchRealPiece("black long-sleeve tee")?.drawShape).toBe("longsleeve");
    expect(matchRealPiece("black hoodie")?.drawShape).toBe("hoodie");
  });
});
