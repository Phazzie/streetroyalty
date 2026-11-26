import { describe, expect, it } from "vitest";
import type { DesignLayer } from "../pod/types.ts";
import {
  applyOps,
  cheyDemo,
  cleanContext,
  localAnswer,
  matchFont,
  matchGarmentColor,
  parseAnswer,
  resolveWordRefs,
  stampKey,
  stampsNeeded,
  systemPrompt,
  turnPrompt,
  type Canvas,
  type ChatOp,
  type LocalDesign,
} from "./chat.ts";
import { parseLayers } from "./validate.ts";

const text = (id: string, extra: Partial<Extract<DesignLayer, { type: "text" }>> = {}): DesignLayer => ({
  id,
  type: "text",
  text: "KING",
  font: "Archivo Black",
  color: "#ffffff",
  x: 0.5,
  y: 0.3,
  scale: 1,
  rotation: 0,
  ...extra,
});

const canvas = (spots: Record<string, DesignLayer[]>, placement = "front", selected = ""): Canvas => ({ placement, spots, selected });

let counter = 0;
const options = (extra: Partial<Parameters<typeof applyOps>[2]> = {}) => ({
  placements: ["front", "back", "sleeve_left", "sleeve_right"],
  stamps: {},
  newId: (kind: string) => `${kind}-${++counter}`,
  ...extra,
});

const HOODIE_COLORS = [
  { name: "Black", hex: "#080808" },
  { name: "Bone", hex: "#f5e8ce" },
  { name: "Forest Green", hex: "#335231" },
];

const design = (spots: Record<string, DesignLayer[]>, selected = ""): LocalDesign => ({
  canvas: canvas(spots, "front", selected),
  blank: { id: "hoodie-pullover", name: "Premium Pullover Hoodie", type: "Hoodie" },
  blanks: [
    { id: "tee-heavy", name: "Heavyweight Tee", type: "T-Shirt" },
    { id: "hoodie-pullover", name: "Premium Pullover Hoodie", type: "Hoodie" },
    { id: "crew-sweat", name: "Premium Crewneck", type: "Sweatshirt" },
  ],
  colors: HOODIE_COLORS,
});

describe("reading the model's answer", () => {
  it("keeps good edits, drops broken ones, and clamps numbers", () => {
    const answer = parseAnswer(
      'Sure! {"reply":"Red and bigger.","ops":[{"op":"edit","layer":"t1","color":"red","scale":9},{"op":"teleport"},{"op":"edit","layer":""},{"op":"add_text","spot":"back","text":"  CHI  ","font":"big shoulders","arc":400}]}',
    );
    expect(answer?.reply).toBe("Red and bigger.");
    expect(answer?.ops).toEqual([
      { op: "edit", layer: "t1", color: "#e11d2e", scale: 3 },
      { op: "add_text", spot: "back", text: "CHI", font: "Big Shoulders Display", arc: 120 },
    ]);
  });

  it("lets through at most one paid picture a turn", () => {
    const answer = parseAnswer(
      JSON.stringify({ reply: "Two?", ops: [{ op: "make_art", idea: "a lion" }, { op: "make_art", idea: "a rose", style: "nope" }] }),
    );
    expect(answer?.ops).toEqual([{ op: "make_art", idea: "a lion", style: "ink" }]);
  });

  it("refuses an unknown stamp and anything that isn't JSON", () => {
    expect(parseAnswer('{"reply":"","ops":[{"op":"add_stamp","stamp":"eiffel-tower"}]}')).toBeNull();
    expect(parseAnswer("I made it red for you")).toBeNull();
  });
});

describe("applying edits", () => {
  it("edits, nudges and restacks across spots, leaving the rest alone", () => {
    const start = canvas({ front: [text("a"), text("b", { text: "QUEEN" })], back: [text("c")] }, "front", "b");
    const ops: ChatOp[] = [
      { op: "edit", layer: "selected", color: "#e0182d", stroke: "#ffffff" },
      { op: "nudge", layer: "c", dy: -0.1, grow: 1.5, turn: 190 },
      { op: "stack", layer: "a", to: "front" },
    ];
    const { canvas: out, changed, skipped } = applyOps(start, ops, options());
    expect(changed).toBe(3);
    expect(skipped).toEqual([]);
    expect(out.spots.front?.map((layer) => layer.id)).toEqual(["b", "a"]);
    expect(out.spots.front?.[0]).toMatchObject({ color: "#e0182d", stroke: "#ffffff", text: "QUEEN" });
    expect(out.spots.back?.[0]).toMatchObject({ y: 0.2, scale: 1.5, rotation: -170 });
    expect(start.spots.front?.[0]?.id).toBe("a");
  });

  it("turns outline-only type and a sticker outline into one or the other, never both", () => {
    const start = canvas({ front: [text("a", { stroke: "#ffffff" })] });
    const out = applyOps(start, [{ op: "edit", layer: "a", outline: true }], options()).canvas;
    expect(out.spots.front?.[0]).toMatchObject({ outline: true });
    expect(out.spots.front?.[0]).not.toHaveProperty("stroke");
  });

  it("adds stamps only when drawn, honours the layer limit and unknown spots", () => {
    const full = Array.from({ length: 8 }, (_, index) => text(`t${index}`));
    const key = stampKey("chicago-skyline", "#e0182d");
    const result = applyOps(
      canvas({ front: full }),
      [
        { op: "add_text", text: "NINE" },
        { op: "add_stamp", spot: "back", stamp: "chicago-skyline", color: "#e0182d", scale: 1.8 },
        { op: "add_stamp", spot: "hood", stamp: "chicago-star", color: "#e0182d" },
      ],
      options({ stamps: { [key]: "data:image/png;base64,AAAA" } }),
    );
    expect(result.canvas.spots.front).toHaveLength(8);
    expect(result.canvas.spots.back?.[0]).toMatchObject({ type: "image", scale: 1.8, src: "data:image/png;base64,AAAA" });
    expect(result.skipped.join(" ")).toMatch(/eight layers/);
    expect(result.skipped.join(" ")).toMatch(/no hood/);
  });

  it("matches loose spot names and moves the screen", () => {
    const out = applyOps(canvas({ front: [] }), [{ op: "add_text", spot: "left sleeve", text: "CHI" }, { op: "show_spot", spot: "Left-Sleeve" }], options()).canvas;
    expect(out.placement).toBe("sleeve_left");
    expect(out.spots.sleeve_left?.[0]).toMatchObject({ text: "CHI" });
  });

  it("makes layers the server will still accept", () => {
    const out = applyOps(
      canvas({ front: [] }),
      [{ op: "add_text", text: "CHEY", font: "Big Shoulders Display", color: "#e0182d", tracking: 0.04, scale: 2.4, stroke: "#f2ece4" }],
      options(),
    ).canvas;
    expect(parseLayers(out.spots.front)).toEqual(out.spots.front);
  });
});

describe("the no-AI reader", () => {
  const front = { front: [text("a"), text("b", { text: "CHEY" })] };

  it("colours, sizes and moves the selected text", () => {
    const answer = localAnswer("make the text red, bigger and move it up", design(front, "a"));
    expect(answer?.ops).toEqual([
      { op: "edit", layer: "a", color: "#e11d2e" },
      { op: "nudge", layer: "a", grow: 1.25, dy: -0.07 },
    ]);
  });

  it("falls back to the newest text when nothing is selected", () => {
    expect(localAnswer("old english font", design(front))?.ops).toEqual([{ op: "edit", layer: "b", font: "UnifrakturCook" }]);
  });

  it("changes the garment, not the text, when the garment is named", () => {
    expect(localAnswer("make the hoodie bone", design(front))?.ops).toEqual([{ op: "set_color", color: "Bone" }]);
    expect(localAnswer("put it on a black crewneck", design(front))?.ops).toEqual([
      { op: "set_blank", blank: "crew-sweat" },
      { op: "set_color", color: "Black" },
    ]);
  });

  it("writes new words and draws the skyline where asked", () => {
    const words = localAnswer('add "CHI TOWN" on the back', design(front));
    expect(words?.ops[0]).toMatchObject({ op: "add_text", spot: "back", text: "CHI TOWN" });
    const sky = localAnswer("put the Chicago skyline on the back in red", design(front));
    expect(sky?.ops).toEqual([
      { op: "add_stamp", spot: "back", stamp: "chicago-skyline", color: "#e11d2e", y: 0.42, scale: 1.7 },
      { op: "show_spot", spot: "back" },
    ]);
  });

  it("says nothing when it does not understand", () => {
    expect(localAnswer("make it look like a summer in Lisbon", design(front))).toBeNull();
  });
});

describe("the Chey Society example", () => {
  it("builds a printable hoodie front, back and sleeve through the same edits", () => {
    const turns = cheyDemo("hoodie-pullover");
    let state = canvas({ front: [text("starter", { text: "STREET ROYALTY" })] });
    const stamps: Record<string, string> = {};
    for (const turn of turns) {
      for (const need of stampsNeeded(turn.ops)) stamps[stampKey(need.stamp, need.color)] = "data:image/png;base64,AAAA";
    }
    for (const turn of turns) {
      const result = applyOps(state, resolveWordRefs(turn.ops, state), options({ stamps }));
      expect(result.skipped).toEqual([]);
      state = result.canvas;
    }
    expect(state.placement).toBe("front");
    expect(state.spots.front?.map((layer) => (layer.type === "text" ? layer.text : "art"))).toEqual(["CHEY", "SOCIETY"]);
    expect(state.spots.front?.[0]).toMatchObject({ font: "Big Shoulders Display", color: "#e0182d", stroke: "#f2ece4" });
    expect(state.spots.back).toHaveLength(3);
    expect(state.spots.sleeve_left).toHaveLength(1);
    for (const list of Object.values(state.spots)) expect(parseLayers(list)).toEqual(list);
  });
});

describe("what the model is told", () => {
  it("cleans what the browser sends and keeps the prompt bounded", () => {
    const context = cleanContext({
      blank: { id: "hoodie-pullover", name: "Hoodie", type: "Hoodie" },
      blanks: "nope",
      colors: ["Black", "Bone"],
      placement: "front",
      spots: [{ placement: "front", title: "Front" }, { title: "no key" }],
      selected: "a",
      layers: { front: [{ id: "a", kind: "text", text: "x".repeat(500), x: 7, font: "Comic Sans", color: "blue" }, "junk"] },
    });
    expect(context?.spots).toHaveLength(1);
    expect(context?.layers.front?.[0]).toMatchObject({ x: 1, font: "Archivo Black", color: "#2563eb" });
    expect(context?.layers.front?.[0]?.text).toHaveLength(80);
    const prompt = turnPrompt(context!, "make it red");
    expect(prompt).toContain("Garment colours for this blank: Black, Bone.");
    expect(systemPrompt()).toContain("chicago-skyline");
    expect(cleanContext({ blank: {} })).toBeNull();
  });

  it("matches fonts and garment colours loosely but only from real lists", () => {
    expect(matchFont("Chicago")).toBe("Big Shoulders Display");
    expect(matchFont("comic sans")).toBeUndefined();
    expect(matchGarmentColor("forest green", HOODIE_COLORS)?.name).toBe("Forest Green");
    expect(matchGarmentColor("purple", HOODIE_COLORS)).toBeNull();
  });
});
