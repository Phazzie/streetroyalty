import { describe, expect, it } from "vitest";
import { demoCatalog } from "../storefront/demo.ts";
import {
  buildWardrobeSheet,
  characterName,
  describePiece,
  isMissing,
  resolveRefs,
  sheetPieceFromDesign,
  sheetPieceFromProduct,
} from "./sheet.ts";

function product(slug: string) {
  const found = demoCatalog.products.find((item) => item.slug === slug);
  if (!found) throw new Error(`no ${slug}`);
  return found;
}

const RACK = {
  slug: "do-better-hoodie-ab12",
  title: "Do Better Hoodie",
  productName: "Heavy Hoodie",
  productType: "hoodie",
  colorName: "Black",
  colorHex: "#111111",
  placement: "front",
  mockupUrl: "/mock.png",
};

describe("a piece from the drop", () => {
  it("carries the base colour with its hex, and the trims on record for the sets", () => {
    const piece = sheetPieceFromProduct(product("lilac-set-hoodie"));
    expect(piece).toMatchObject({
      source: "shop",
      name: "The Lilac Hoodie",
      garment: "hoodie",
      baseColor: { name: "Lilac", hex: "#b9a3ee" },
      href: "/shop/lilac-set-hoodie",
    });
    expect(piece.panels).toMatch(/cream panels/i);
    expect(piece.piping).toMatch(/orange piping/i);
  });

  it("does not claim trims for a piece with none on record", () => {
    const piece = sheetPieceFromProduct(product("crown-tee"));
    expect(piece.panels).toBeNull();
    expect(piece.piping).toBeNull();
    expect(describePiece(piece)).toContain("exactly as in the reference picture");
  });

  it("drops the trims when a live product reuses the slug in another colour", () => {
    const other = {
      ...product("lilac-set-hoodie"),
      colors: [{ name: "Black", swatch: "#000000" }],
    };
    expect(sheetPieceFromProduct(other).panels).toBeNull();
  });

  it("leaves out a swatch that is not a hex colour", () => {
    const odd = { ...product("crown-tee"), colors: [{ name: "Cream", swatch: "cream" }] };
    expect(sheetPieceFromProduct(odd).baseColor).toEqual({ name: "Cream", hex: undefined });
    expect(describePiece(sheetPieceFromProduct(odd))).toContain("Base colour: Cream.");
  });
});

describe("a piece from the rack", () => {
  it("uses only the public fields and points at the mockup for the artwork", () => {
    const piece = sheetPieceFromDesign(RACK);
    expect(piece).toMatchObject({
      source: "rack",
      name: "Do Better Hoodie",
      baseColor: { name: "Black", hex: "#111111" },
      print: "front",
      imageUrl: "/mock.png",
      href: "/rack/do-better-hoodie-ab12",
    });
    const text = describePiece(piece);
    expect(text).toContain("Custom print on the front.");
    expect(text).toContain("Copy the print from the reference picture exactly");
    expect(text).not.toMatch(/panel|piping/i);
  });

  it("names the blank and its type without repeating itself", () => {
    expect(sheetPieceFromDesign(RACK).garment).toBe("Heavy Hoodie");
    expect(
      sheetPieceFromDesign({
        ...RACK,
        productName: "Heavyweight Street Tee",
        productType: "t-shirt",
      }).garment,
    ).toBe("Heavyweight Street Tee (t shirt)");
    expect(sheetPieceFromDesign({ ...RACK, title: " ", productName: "" }).name).toBe(
      "Untitled piece",
    );
  });

  it("reads a placement with underscores as words", () => {
    expect(sheetPieceFromDesign({ ...RACK, placement: "left_chest" }).print).toBe("left chest");
  });
});

describe("resolveRefs", () => {
  it("keeps a piece that is gone, marked missing", () => {
    const out = resolveRefs(
      [
        { kind: "shop", slug: "mint-set-jogger" },
        { kind: "shop", slug: "gone" },
        { kind: "rack", slug: RACK.slug },
        { kind: "rack", slug: "gone" },
      ],
      { products: demoCatalog.products, rack: [RACK] },
    );
    expect(out.map(isMissing)).toEqual([false, true, false, true]);
  });
});

describe("buildWardrobeSheet", () => {
  const pieces = [
    sheetPieceFromProduct(product("lilac-set-hoodie")),
    sheetPieceFromProduct(product("lilac-set-jogger")),
    sheetPieceFromDesign(RACK),
  ];
  const sheet = buildWardrobeSheet({ character: "  Rey  ", pieces });

  it("numbers every piece under the character's name", () => {
    expect(sheet.character).toBe("Rey");
    expect(sheet.block.split("\n")[0]).toBe("WARDROBE: REY");
    expect(sheet.block).toContain("Rey wears 3 pieces. The same 3 in every shot.");
    expect(sheet.block).toContain("1. The Lilac Hoodie, a hoodie. Base colour: Lilac (#b9a3ee).");
    expect(sheet.block).toContain("3. Do Better Hoodie");
  });

  it("writes a continuity paragraph that names the outfit and the rules", () => {
    expect(sheet.continuity).toContain(
      "Rey wears exactly this outfit in every shot: The Lilac Hoodie, The Lilac Jogger and Do Better Hoodie.",
    );
    expect(sheet.continuity).toContain("No colour drift: The Lilac Hoodie stays Lilac (#b9a3ee)");
    expect(sheet.continuity).toContain("No logo changes");
    expect(sheet.continuity).toContain("Same fit in every shot");
    expect(sheet.continuity).toContain("never mirrored or redrawn");
  });

  it("makes a per-shot checklist with a line for each piece", () => {
    expect(sheet.checklist[0]).toBe("The reference board is attached to this shot.");
    expect(sheet.checklist).toContain("The Lilac Jogger is on screen and still Lilac (#b9a3ee).");
    expect(sheet.checklist).toContain(
      "Do Better Hoodie: the print is on the front, readable, not mirrored, not redrawn.",
    );
    expect(sheet.text).toContain("CHECK EVERY SHOT\n[ ] The reference board");
  });

  it("gives the same sheet for the same pieces, every time", () => {
    expect(buildWardrobeSheet({ character: "Rey", pieces })).toEqual(sheet);
  });

  it("counts a piece once even if it is passed twice", () => {
    const twice = buildWardrobeSheet({ character: "Rey", pieces: [pieces[0]!, pieces[0]!] });
    expect(twice.block).toContain("Rey wears one piece. The same one in every shot.");
  });

  it("leaves out trim and print rules when no piece has them", () => {
    const plain = buildWardrobeSheet({
      character: "Rey",
      pieces: [sheetPieceFromProduct(product("crown-tee"))],
    });
    expect(plain.continuity).not.toMatch(/piping|mirrored/);
  });

  it("includes measured colours as a guide when the browser has sampled them", () => {
    const sampled = buildWardrobeSheet({
      character: "Rey",
      pieces: [{ ...pieces[0]!, sampled: ["#b9a3ee", "#f3ead9"] }],
    });
    expect(sampled.block).toContain(
      "Colours measured from its picture: #b9a3ee, #f3ead9. A guide.",
    );
  });

  it("is empty with no pieces, and falls back to a plain name", () => {
    expect(buildWardrobeSheet({ character: "", pieces: [] })).toEqual({
      character: "The character",
      block: "",
      continuity: "",
      checklist: [],
      text: "",
    });
    expect(characterName("   ")).toBe("The character");
  });
});
