import { describe, expect, it } from "vitest";
import { layoutArt, trimBand } from "./art.ts";
import {
  MAX_LINES,
  applyUtterance,
  describeIntent,
  emptyIntent,
  reviveIntent,
  type SayIntent,
} from "./parse.ts";

function say(...sentences: string[]): {
  intent: SayIntent;
  understood: string[];
  unsure: string[];
} {
  let state = { intent: emptyIntent(), understood: [] as string[], unsure: [] as string[] };
  for (const sentence of sentences) state = applyUtterance(state.intent, sentence);
  return state;
}

describe("a first description", () => {
  it("reads the brief's hoodie sentence in one go", () => {
    const { intent, understood, unsure } = say(
      "put DO BETTER on the back of a black hoodie in pink, big",
    );
    expect(intent).toEqual({
      blank: "hoodie",
      garmentColor: "#141414",
      placement: "back",
      lines: [{ text: "DO BETTER", color: "#ff5fa2", size: "big", tilt: 0 }],
      font: "Archivo Black",
    });
    expect(understood).toEqual(["Black hoodie", "Back", "DO BETTER in pink, big"]);
    expect(unsure).toEqual([]);
  });

  it("reads a tee that says something across the chest", () => {
    const { intent, unsure } = say("a white tee that says free world in blue across the chest");
    expect(intent.blank).toBe("tee");
    expect(intent.garmentColor).toBe("#ffffff");
    expect(intent.placement).toBe("front");
    expect(intent.lines).toEqual([
      { text: "FREE WORLD", color: "#2563eb", size: "medium", tilt: 0 },
    ]);
    expect(unsure).toEqual([]);
  });

  it("reads a name on a hat", () => {
    const { intent, unsure } = say("hat with my name Dre on it");
    expect(intent.blank).toBe("hat");
    expect(intent.lines.map((line) => line.text)).toEqual(["DRE"]);
    expect(unsure).toEqual([]);
  });

  it("takes quoted words exactly, stop words and all", () => {
    const { intent } = say('a hoodie that says "born in red clay, on the back" in gold');
    expect(intent.lines[0]?.text).toBe("BORN IN RED CLAY, ON THE BACK");
    expect(intent.lines[0]?.color).toBe("#d4af37");
    expect(intent.garmentColor).toBe("#141414");
    expect(intent.placement).toBe("front");
  });

  it.each([
    ["a crewneck saying no encore", "crewneck", "NO ENCORE"],
    ["sweatshirt that reads stay up", "crewneck", "STAY UP"],
    ["t-shirt with the words love is free", "tee", "LOVE IS FREE"],
    ["make it say count me out on a cap", "hat", "COUNT ME OUT"],
    ["write second chances on a hoody", "hoodie", "SECOND CHANCES"],
  ])("%s", (sentence, blank, text) => {
    const { intent } = say(sentence);
    expect(intent.blank).toBe(blank);
    expect(intent.lines[0]?.text).toBe(text);
  });

  it("reads words carried by with", () => {
    const hoodie = say("pink hoodie with free world on the front in big white letters");
    expect(hoodie.intent.blank).toBe("hoodie");
    expect(hoodie.intent.garmentColor).toBe("#ff5fa2");
    expect(hoodie.intent.lines).toEqual([
      { text: "FREE WORLD", color: "#ffffff", size: "big", tilt: 0 },
    ]);
    expect(hoodie.unsure).toEqual([]);
    expect(say("a white hoodie with DO BETTER on the back").intent.lines[0]?.text).toBe(
      "DO BETTER",
    );
  });

  it("does not print an instruction that has no words in it", () => {
    const { intent, unsure } = say("put my name on it");
    expect(intent.lines).toEqual([]);
    expect(unsure).toEqual(["put my name on it"]);
  });

  it("keeps a phrase that ends in a size word", () => {
    expect(say("a tee that says think big").intent.lines[0]).toMatchObject({
      text: "THINK BIG",
      size: "medium",
    });
  });

  it("treats bare words on an empty piece as the print", () => {
    const { intent, understood } = say("do better");
    expect(intent.lines.map((line) => line.text)).toEqual(["DO BETTER"]);
    expect(understood).toHaveLength(1);
    expect(understood[0]).toContain("DO BETTER");
  });

  it("gives the print an ink that shows on the garment", () => {
    expect(say("a white tee that says hello").intent.lines[0]?.color).toBe("#141414");
    expect(say("a black tee that says hello").intent.lines[0]?.color).toBe("#f6f1ff");
  });
});

describe("colour words", () => {
  it.each([
    ["hot pink", "#ff2d95"],
    ["royal blue", "#2f5bff"],
    ["money green", "#1f6f3d"],
    ["blood red", "#8a0303"],
    ["lime", "#d6ff3c"],
    ["lilac", "#7c5cff"],
    ["mint", "#a5dccb"],
    ["bone", "#efe6d6"],
    ["grey", "#8a8a8a"],
    ["gray", "#8a8a8a"],
  ])("make it %s", (word, hex) => {
    const { intent } = say("a tee that says hi", `make it ${word}`);
    expect(intent.lines[0]?.color).toBe(hex);
  });

  it("puts a colour beside a garment word on the garment", () => {
    const { intent } = say("a tee that says hi in pink", "make the tee royal blue");
    expect(intent.garmentColor).toBe("#2f5bff");
    expect(intent.lines[0]?.color).toBe("#ff5fa2");
  });

  it("colours the garment when there are no words yet", () => {
    expect(say("make it lime").intent.garmentColor).toBe("#d6ff3c");
    expect(say("hot pink hoodie").intent.garmentColor).toBe("#ff2d95");
  });

  it("keeps a starter ink visible when the garment changes under it", () => {
    const { intent } = say("a black tee that says hi", "white tee");
    expect(intent.garmentColor).toBe("#ffffff");
    expect(intent.lines[0]?.color).toBe("#141414");
  });

  it("leaves a chosen clash alone", () => {
    const { intent } = say("a tee that says hi in white", "white tee");
    expect(intent.lines[0]?.color).toBe("#ffffff");
  });
});

describe("follow-ups change the current piece", () => {
  const base = "put DO BETTER on the back of a black hoodie in pink, big";

  it("bigger and smaller step the size, and stop at the ends", () => {
    expect(say(base, "bigger").intent.lines[0]?.size).toBe("huge");
    expect(say(base, "bigger", "bigger").intent.lines[0]?.size).toBe("huge");
    expect(say(base, "a little smaller").intent.lines[0]?.size).toBe("medium");
    expect(say(base, "way smaller").intent.lines[0]?.size).toBe("small");
    expect(say(base, "make it huge").intent.lines[0]?.size).toBe("huge");
  });

  it("make the words bigger is about the words", () => {
    const { intent } = say(base, "make the words bigger");
    expect(intent.lines).toEqual([{ text: "DO BETTER", color: "#ff5fa2", size: "huge", tilt: 0 }]);
    expect(say(base, "make the letters white").intent.lines[0]?.color).toBe("#ffffff");
  });

  it("changes what it says", () => {
    expect(say(base, "change it to say stay up").intent.lines.map((line) => line.text)).toEqual([
      "STAY UP",
    ]);
  });

  it("moves the words to another garment", () => {
    const { intent } = say("a hoodie that says hi", "put it on a white tee");
    expect(intent.blank).toBe("tee");
    expect(intent.lines.map((line) => line.text)).toEqual(["HI"]);
  });

  it("takes several changes in one breath", () => {
    const { intent, unsure } = say(base, "make it lime and put it on the front and tilt it");
    expect(intent.placement).toBe("front");
    expect(intent.lines[0]).toMatchObject({ color: "#d6ff3c", tilt: -8 });
    expect(unsure).toEqual([]);
  });

  it("moves the print", () => {
    expect(say(base, "on the front").intent.placement).toBe("front");
    expect(say(base, "put it on the sleeve").intent.placement).toBe("sleeve");
    expect(say("a tee that says hi", "on the back").intent.placement).toBe("back");
  });

  it("adds a second line that keeps the first line's style", () => {
    const { intent, understood } = say(base, "second line no encore");
    expect(intent.lines).toEqual([
      { text: "DO BETTER", color: "#ff5fa2", size: "big", tilt: 0 },
      { text: "NO ENCORE", color: "#ff5fa2", size: "big", tilt: 0 },
    ]);
    expect(understood).toEqual(["NO ENCORE in pink, big"]);
  });

  it("styles only the new line when the style comes with it", () => {
    const { intent } = say(base, "add a line that says no encore in lime");
    expect(intent.lines.map((line) => line.color)).toEqual(["#ff5fa2", "#d6ff3c"]);
  });

  it("changes a named line, and does not print the instruction", () => {
    const { intent } = say(base, "second line no encore", "second line lime");
    expect(intent.lines.map((line) => line.text)).toEqual(["DO BETTER", "NO ENCORE"]);
    expect(intent.lines.map((line) => line.color)).toEqual(["#ff5fa2", "#d6ff3c"]);
  });

  it("rewrites a line that is already there", () => {
    const { intent } = say(base, "second line no encore", "second line one more time");
    expect(intent.lines.map((line) => line.text)).toEqual(["DO BETTER", "ONE MORE TIME"]);
  });

  it("tilts, tilts further, flips and straightens", () => {
    expect(say(base, "tilt it").intent.lines[0]?.tilt).toBe(-8);
    expect(say(base, "tilt it", "tilt it").intent.lines[0]?.tilt).toBe(-16);
    expect(say(base, "tilt it", "the other way").intent.lines[0]?.tilt).toBe(8);
    expect(say(base, "tilt it", "straighten it").intent.lines[0]?.tilt).toBe(0);
  });

  it("lowercase sticks for the lines that follow", () => {
    const { intent } = say(base, "lowercase", "second line no encore");
    expect(intent.lines.map((line) => line.text)).toEqual(["do better", "no encore"]);
    expect(say(base, "lowercase", "all caps").intent.lines[0]?.text).toBe("DO BETTER");
  });

  it("all caps is not a hat", () => {
    expect(say(base, "all caps").intent.blank).toBe("hoodie");
  });

  it("swaps the garment and keeps the words", () => {
    const { intent, understood } = say(base, "actually a bone crewneck");
    expect(intent.blank).toBe("crewneck");
    expect(intent.garmentColor).toBe("#efe6d6");
    expect(intent.lines[0]?.text).toBe("DO BETTER");
    expect(understood[0]).toBe("Bone crewneck");
  });

  it("takes a line off", () => {
    const { intent } = say(base, "second line no encore", "remove the last line");
    expect(intent.lines.map((line) => line.text)).toEqual(["DO BETTER"]);
  });

  it("changes the letters", () => {
    expect(say(base, "plain letters").intent.font).toBe("Outfit");
    expect(say(base, "plain letters", "bold").intent.font).toBe("Archivo Black");
  });

  it("starts over, and reads anything said after it", () => {
    expect(say(base, "start over").intent).toEqual(emptyIntent());
    const again = say(base, "start over, a white tee that says free world");
    expect(again.intent.blank).toBe("tee");
    expect(again.intent.lines.map((line) => line.text)).toEqual(["FREE WORLD"]);
    expect(again.understood[0]).toBe("Started over");
  });

  it("stops at eight lines and says so", () => {
    const lines = Array.from({ length: 10 }, (_item, index) => `add a line that says row ${index}`);
    const { intent, unsure } = say("a tee that says top", ...lines);
    expect(intent.lines).toHaveLength(MAX_LINES);
    expect(unsure.join(" ")).toContain("eight lines is the limit");
  });
});

describe("what it does not understand", () => {
  it("hands back the words it missed and still applies the rest", () => {
    const { intent, unsure } = say("a tee that says hi", "make it pink and holographic");
    expect(intent.lines[0]?.color).toBe("#ff5fa2");
    expect(unsure).toEqual(["holographic"]);
  });

  it("does not turn a stray sentence into print once there are words", () => {
    const first = say("a tee that says hi");
    const next = applyUtterance(first.intent, "what time does the shop close");
    expect(next.intent).toEqual(first.intent);
    expect(next.unsure.length).toBeGreaterThan(0);
  });

  it("asks for words before styling them", () => {
    expect(say("bigger").unsure).toEqual(["size (say the words first)"]);
  });

  it.each([
    [""],
    ["   "],
    ['"'],
    ["'''"],
    ["||||"],
    ["second line"],
    ["put on the"],
    ["that says"],
    ["\u0000\u0007 \n\t"],
    ["x".repeat(5000)],
    ["(((((*+?[[\\"],
  ])("never throws on %j", (text) => {
    const result = applyUtterance(emptyIntent(), text);
    expect(result.intent.lines.length).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.unsure)).toBe(true);
  });

  it("survives input that is not a string", () => {
    const result = applyUtterance(emptyIntent(), undefined as unknown as string);
    expect(result.intent).toEqual(emptyIntent());
  });

  it("does not change the intent it was given", () => {
    const first = say("a tee that says hi");
    const frozen = JSON.stringify(first.intent);
    applyUtterance(first.intent, "bigger, in lime, on the back, tilt it, lowercase");
    expect(JSON.stringify(first.intent)).toBe(frozen);
  });
});

describe("describeIntent", () => {
  it("reads the piece back as plain chips", () => {
    const { intent } = say("put DO BETTER on the back of a black hoodie in pink, big", "tilt it");
    expect(describeIntent(intent)).toEqual([
      "Black hoodie",
      "Back",
      "DO BETTER in pink, big, tilted",
    ]);
  });
});

describe("putting an intent away and reading it back", () => {
  it("round trips through JSON", () => {
    const { intent } = say("put DO BETTER on the back of a black hoodie in pink, big", "tilt it");
    expect(reviveIntent(JSON.parse(JSON.stringify(intent)))).toEqual(intent);
  });

  it.each([
    [null],
    ["tee"],
    [{}],
    [{ ...emptyIntent(), blank: "cape" }],
    [{ ...emptyIntent(), garmentColor: "red" }],
    [{ ...emptyIntent(), lines: [{ text: "", color: "#ffffff", size: "big", tilt: 0 }] }],
    [{ ...emptyIntent(), lines: [{ text: "HI", color: "url(x)", size: "big", tilt: 0 }] }],
    [{ ...emptyIntent(), lines: [{ text: "HI", color: "#ffffff", size: "vast", tilt: 0 }] }],
  ])("refuses %j", (input) => {
    expect(reviveIntent(input)).toBeNull();
  });
});

describe("the picture for the road without an account", () => {
  const measure = (text: string, px: number) => text.length * px * 0.7;

  it("keeps every line inside the picture, top to bottom", () => {
    const { intent } = say(
      "a tee that says the longest line anybody would ever want, huge",
      "add a line that says two",
      "add a line that says three",
      "tilt it",
    );
    const rows = layoutArt(intent.lines, 1200, 900, measure);
    expect(rows.map((row) => row.text)).toEqual(intent.lines.map((line) => line.text));
    let last = 0;
    for (const row of rows) {
      expect(measure(row.text, row.fontPx)).toBeLessThanOrEqual(1200 * 0.94 + 0.5);
      expect(row.y - row.fontPx / 2).toBeGreaterThanOrEqual(0);
      expect(row.y + row.fontPx / 2).toBeLessThanOrEqual(900);
      expect(row.y).toBeGreaterThan(last);
      last = row.y;
    }
  });

  it("crops to the words and never past the picture", () => {
    const one = layoutArt(
      [{ text: "HI", color: "#ffffff", size: "medium", tilt: 0 }],
      1200,
      900,
      measure,
    );
    const band = trimBand(one, 1200, 900, measure);
    expect(band.height).toBeLessThan(300);
    expect(band.top).toBeGreaterThan(300);
    const row = one[0];
    expect(row && row.y - band.top).toBeGreaterThan((row?.fontPx ?? 0) / 2);
    const tilted = layoutArt(
      [{ text: "A LONG TILTED LINE", color: "#ffffff", size: "big", tilt: -40 }],
      1200,
      900,
      measure,
    );
    const swing = trimBand(tilted, 1200, 900, measure);
    expect(swing.height).toBeGreaterThan(band.height);
    expect(swing.top).toBeGreaterThanOrEqual(0);
    expect(swing.top + swing.height).toBeLessThanOrEqual(900);
    expect(band.width).toBeLessThan(600);
    expect(band.left * 2 + band.width).toBe(1200);
    expect(swing.width).toBeGreaterThan(band.width);
    expect(swing.left).toBeGreaterThanOrEqual(0);
    expect(trimBand([], 1200, 900, measure)).toEqual({ left: 0, top: 0, width: 1200, height: 900 });
  });

  it("draws big bigger than small", () => {
    const small = layoutArt(
      [{ text: "HI", color: "#ffffff", size: "small", tilt: 0 }],
      1200,
      900,
      measure,
    );
    const huge = layoutArt(
      [{ text: "HI", color: "#ffffff", size: "huge", tilt: 0 }],
      1200,
      900,
      measure,
    );
    expect(huge[0]?.fontPx ?? 0).toBeGreaterThan((small[0]?.fontPx ?? 0) * 2);
    expect(layoutArt([], 1200, 900, measure)).toEqual([]);
  });
});

describe("things people said that it used to miss", () => {
  it("keeps a colour word that is part of the words", () => {
    const { intent, unsure } = say("a hoodie that says born in red clay");
    expect(intent.lines.map((line) => line.text)).toEqual(["BORN IN RED CLAY"]);
    expect(describeIntent(intent)).toContain("BORN IN RED CLAY in white, medium");
    expect(unsure).toEqual([]);
  });

  it("still ends the words at a colour that is an instruction", () => {
    expect(describeIntent(say("a tee that says free world in blue").intent)).toContain(
      "FREE WORLD in blue, medium",
    );
    expect(describeIntent(say("tee that says do better in hot pink on the back").intent)).toEqual([
      "Black tee",
      "Back",
      "DO BETTER in hot pink, medium",
    ]);
    expect(describeIntent(say("tee that says do better in pink big").intent)).toContain(
      "DO BETTER in pink, big",
    );
    expect(describeIntent(say("tee that says do better in red and make it huge").intent)).toContain(
      "DO BETTER in red, huge",
    );
  });

  it("takes two lines said in one breath", () => {
    const comma = say("black tee that says king, and under it put of nothing");
    expect(comma.intent.lines.map((line) => line.text)).toEqual(["KING", "OF NOTHING"]);
    expect(comma.unsure).toEqual([]);
    const plain = say("a hoodie that says stay up and add a line that says stay down in pink");
    expect(plain.intent.lines.map((line) => line.text)).toEqual(["STAY UP", "STAY DOWN"]);
    expect(plain.intent.blank).toBe("hoodie");
    const numbered = say("tee that says king, second line no encore");
    expect(numbered.intent.lines.map((line) => line.text)).toEqual(["KING", "NO ENCORE"]);
  });

  it("replaces the current line and adds under it when a piece already has words", () => {
    const { intent } = say("love", "make it say king and under it put of nothing");
    expect(intent.lines.map((line) => line.text)).toEqual(["KING", "OF NOTHING"]);
  });

  it("changes the words when asked to change them", () => {
    expect(say("hello", "change the words to goodbye").intent.lines[0]?.text).toBe("GOODBYE");
    expect(say("hello", "change it to no encore").intent.lines[0]?.text).toBe("NO ENCORE");
    expect(say("hello", "change it to say no encore").intent.lines[0]?.text).toBe("NO ENCORE");
  });

  it("does not print a colour, a garment or a size it was asked to change to", () => {
    const pink = say("hello", "change it to pink").intent;
    expect(pink.lines.map((line) => line.text)).toEqual(["HELLO"]);
    expect(pink.lines[0]?.color).toBe("#ff5fa2");
    const hoodie = say("hello", "change it to a hoodie").intent;
    expect(hoodie.blank).toBe("hoodie");
    expect(hoodie.lines.map((line) => line.text)).toEqual(["HELLO"]);
    expect(say("hello", "change the words to be bigger").intent.lines[0]).toMatchObject({
      text: "HELLO",
      size: "big",
    });
  });

  it("reads a name that belongs to someone else", () => {
    const { intent, unsure } = say("put my daughter's name Aaliyah on a pink hat");
    expect(describeIntent(intent)).toEqual(["Pink hat", "Front", "AALIYAH in white, medium"]);
    expect(unsure).toEqual([]);
  });

  it("never throws on odd input", () => {
    const odd: unknown[] = [
      null,
      undefined,
      42,
      {},
      [],
      "   ",
      "|||",
      '"',
      "''",
      "\u0000",
      "a".repeat(5000),
    ];
    for (const input of odd) {
      expect(() => applyUtterance(emptyIntent(), input as string)).not.toThrow();
    }
    const long = applyUtterance(emptyIntent(), `tee that says ${"word ".repeat(200)}`);
    expect(long.intent.lines[0]?.text.length ?? 0).toBeLessThanOrEqual(60);
  });
});
