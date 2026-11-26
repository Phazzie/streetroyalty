import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  AOP_TEMPLATES,
  HOUSE_COLORWAYS,
  MAX_ART_SRC,
  MAX_GARMENT_JSON,
  materialLine,
  printfulCard,
  canOrderProduct,
  addColorway,
  defaultGarment,
  parseGarment,
  parseStoredGarment,
  removeColorway,
  renderGarmentSvg,
  resolveGarment,
  setPanelFill,
  setRoleColor,
  studioProofPixels,
} from "./garments.ts";

const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

describe("all-over garments", () => {
  it("covers a hoodie, joggers, and a track jacket, each tied to a Printful product", () => {
    assert.deepEqual(Object.keys(AOP_TEMPLATES), ["aop-hoodie", "aop-joggers", "aop-track-jacket"]);
    assert.equal(printfulCard("aop-hoodie")?.catalogProductId, 388);
    assert.equal(printfulCard("aop-joggers")?.catalogProductId, 400);
    assert.equal(printfulCard("aop-track-jacket")?.catalogProductId, 801);
    assert.equal("printful" in (AOP_TEMPLATES["aop-hoodie"] ?? {}), false);
    for (const template of Object.values(AOP_TEMPLATES)) {
      const ids = template.panels.map((panel) => panel.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(template.panels.some((panel) => panel.role === "contrast"));
      assert.ok(template.panels.some((panel) => panel.role === "trim"));
    }
    assert.ok(AOP_TEMPLATES["aop-hoodie"]?.panels.some((panel) => panel.id === "hood"));
    assert.ok(AOP_TEMPLATES["aop-joggers"]?.panels.some((panel) => panel.id === "stripe_left"));
    // Printful cuts no seat, back or pocket piece on the joggers. Each leg wraps the leg.
    assert.ok(!AOP_TEMPLATES["aop-joggers"]?.panels.some((panel) => panel.id === "pocket"));
  });

  it("paints a lilac body and cream side panels from the active colorway", () => {
    const garment = defaultGarment("aop-hoodie");
    const front = resolveGarment(garment, "front");
    const body = front.panels.find((item) => item.panel.id === "body_front");
    const side = front.panels.find((item) => item.panel.id === "side_left");
    const piping = front.panels.find((item) => item.panel.id === "piping_left");
    assert.deepEqual(body?.paint, { type: "solid", hex: "#c4a6e0" });
    assert.deepEqual(side?.paint, { type: "solid", hex: "#f3e6d0" });
    assert.deepEqual(piping?.paint, { type: "solid", hex: "#ff6a00" });
    assert.equal(
      front.panels.some((item) => item.panel.id === "body_back"),
      false,
    );
    const back = resolveGarment(garment, "back");
    assert.equal(
      back.panels.some((item) => item.panel.id === "body_back"),
      true,
    );
    assert.equal(
      back.panels.some((item) => item.panel.id === "body_front"),
      false,
    );
  });

  it("lets a panel leave the colorway for its own color, pattern, or art", () => {
    let garment = setPanelFill(defaultGarment("aop-hoodie"), "pocket", {
      kind: "pattern",
      pattern: "stripe",
      hex: "#141414",
      accent: "#c6a15b",
    });
    garment = setPanelFill(garment, "mark", { kind: "art", src: "https://cdn.example/logo.png" });
    const front = resolveGarment(garment, "front");
    assert.equal(front.panels.find((item) => item.panel.id === "pocket")?.paint.type, "pattern");
    assert.equal(front.panels.find((item) => item.panel.id === "mark")?.paint.type, "art");
    const svg = decode(renderGarmentSvg({ templateId: "aop-hoodie", garment, label: "SR" }));
    assert.match(svg, /data-panel="body_front"/);
    assert.match(svg, /pat-pocket/);
    assert.match(svg, /cdn\.example\/logo\.png/);
    assert.match(svg, />SR<\/text>/);
  });

  it("saves and switches colorways without dropping the others", () => {
    let garment = defaultGarment("aop-joggers");
    garment = addColorway(garment, "Night mint");
    assert.match(garment.activeColorwayId, /^[0-9a-f-]{36}$/);
    assert.equal(garment.colorways.at(-1)?.name, "Night mint");
    garment = updateActive(garment, garment.activeColorwayId);
    const addedId = garment.activeColorwayId;
    const current = garment.colorways.find((item) => item.id === garment.activeColorwayId);
    assert.ok(current);
    garment = {
      ...garment,
      colorways: garment.colorways.map((item) =>
        item.id === current?.id ? setRoleColor(item, "body", "#9fe7c8") : item,
      ),
    };
    assert.equal(garment.colorways.length, HOUSE_COLORWAYS.length + 1);
    assert.equal(
      garment.colorways.find((item) => item.id === "lilac-white")?.colors.body,
      "#c4a6e0",
    );
    garment = removeColorway(garment, addedId);
    assert.equal(
      garment.colorways.some((item) => item.id === addedId),
      false,
    );
    let again = defaultGarment("aop-hoodie");
    again = addColorway(again, "Night mint");
    again = addColorway(again, "Night mint");
    const fresh = again.colorways.slice(HOUSE_COLORWAYS.length).map((item) => item.id);
    assert.equal(new Set(fresh).size, 2);
    assert.equal(
      fresh.some((id) => id.startsWith("night-mint")),
      false,
    );
    assert.throws(
      () =>
        removeColorway(
          { ...garment, colorways: garment.colorways.slice(0, 1) },
          garment.colorways[0]!.id,
        ),
      /at least one/,
    );
  });

  it("rejects a garment that is not one of the templates", () => {
    assert.throws(
      () => parseGarment({ templateId: "tee-heavy", colorways: HOUSE_COLORWAYS }),
      /template/,
    );
    const parsed = parseGarment(defaultGarment("aop-track-jacket"));
    assert.equal(parsed.panels.length, AOP_TEMPLATES["aop-track-jacket"]?.panels.length);
  });

  it("keeps the studio proof size helper", () => {
    assert.deepEqual(studioProofPixels(10, 20), { widthPx: 450, heightPx: 900 });
  });

  it("names the fabric only for all-over pieces", () => {
    assert.match(materialLine("aop-hoodie"), /sublimation/);
    assert.equal(materialLine("tee-heavy"), "");
  });

  it("opens the all-over pieces, blocks an unknown product and keeps a placement blank orderable", () => {
    assert.equal(canOrderProduct("aop-hoodie"), true);
    assert.equal(canOrderProduct("aop-joggers"), true);
    assert.equal(canOrderProduct("aop-track-jacket"), true);
    assert.equal(canOrderProduct("388"), true);
    assert.equal(canOrderProduct("400"), true);
    assert.equal(canOrderProduct("801"), true);
    assert.equal(canOrderProduct("tee-heavy"), true);
    assert.equal(canOrderProduct("hoodie-pullover"), true);
    assert.equal(canOrderProduct("71"), false);
    assert.equal(canOrderProduct("yacht"), false);
    assert.equal(canOrderProduct(""), false);
    assert.equal(canOrderProduct("aop-hoodie-typo"), false);
  });

  it("reads a saved garment whose template id is still the sandbox key or a Printful catalog id", () => {
    const legacy = defaultGarment("aop-hoodie");
    const stored = parseStoredGarment(JSON.stringify(legacy));
    assert.equal(stored?.templateId, "aop-hoodie");
    assert.equal(stored?.activeColorwayId, "lilac-cream");
    const fromCatalog = parseStoredGarment(JSON.stringify({ ...legacy, templateId: "388" }));
    assert.equal(fromCatalog?.templateId, "aop-hoodie");
    assert.equal(fromCatalog?.panels.length, legacy.panels.length);
    assert.equal(parseStoredGarment("not json"), null);
    assert.equal(parseStoredGarment(null), null);
  });
});

function updateActive(garment: ReturnType<typeof defaultGarment>, id: string) {
  return { ...garment, activeColorwayId: id };
}

/** A strict enough XML check: balanced tags, quoted attributes, and only whole entities. */
function wellFormed(xml: string): boolean {
  const body = xml.replace(/^<\?xml[^?]*\?>\s*/, "");
  const entitiesOk = (text: string) =>
    !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(text);
  const token =
    /<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*="[^"<]*")*)\s*(\/?)>|([^<]+)/y;
  const stack: string[] = [];
  let index = 0;
  while (index < body.length) {
    token.lastIndex = index;
    const match = token.exec(body);
    if (!match) return false;
    index = token.lastIndex;
    if (match[1]) {
      if (stack.pop() !== match[1]) return false;
    } else if (match[2]) {
      if (!entitiesOk(match[3] ?? "")) return false;
      if (!match[4]) stack.push(match[2]);
    } else if (!entitiesOk(match[5] ?? "")) {
      return false;
    }
  }
  return stack.length === 0;
}

describe("the all-over flat as a file", () => {
  it("the XML check itself catches a cut entity and a stray tag", () => {
    assert.equal(wellFormed('<svg a="1"><text>ME &amp; YOU</text></svg>'), true);
    assert.equal(wellFormed("<svg><text>MAMA&a</text></svg>"), false);
    assert.equal(wellFormed("<svg><text>a < b</text></svg>"), false);
    assert.equal(wellFormed("<svg><text>open</svg>"), false);
  });

  it("outlines the label in the body colour, so it reads across the chest-logo box", () => {
    const svg = decode(renderGarmentSvg({ templateId: "aop-hoodie", label: "STREET ROYALTY" }));
    const label = /<text [^>]*>STREET ROYALTY<\/text>/.exec(svg)?.[0] ?? "";
    assert.match(label, /fill="#1a1024"/);
    assert.match(label, /stroke="#c4a6e0"/);
    assert.match(label, /paint-order="stroke"/);
  });

  it("stays well-formed with & ' \" < > at every position of the label up to 30", () => {
    for (const mark of ["&", "'", '"', "<", ">"]) {
      for (let position = 0; position <= 30; position += 1) {
        const label = `${"M".repeat(position)}${mark}${"A".repeat(Math.max(0, 30 - position))}`;
        const svg = decode(renderGarmentSvg({ templateId: "aop-hoodie", label }));
        assert.ok(wellFormed(svg), `label with ${mark} at ${position} broke the SVG`);
      }
    }
    for (const label of ["EVERYBODY EATS AT MAMA'S", "MAMA'S & PAPA'S KITCHEN TABLE", "ME & YOU"]) {
      const svg = decode(renderGarmentSvg({ templateId: "aop-hoodie", label }));
      assert.ok(wellFormed(svg), label);
    }
  });

  it("cuts the label to 24 whole characters before escaping, without splitting an emoji", () => {
    const svg = decode(
      renderGarmentSvg({ templateId: "aop-hoodie", label: "EVERYBODY EATS AT MAMA'S KITCHEN" }),
    );
    assert.match(svg, />EVERYBODY EATS AT MAMA&apos;S</);
    const emoji = renderGarmentSvg({ templateId: "aop-hoodie", label: `${"A".repeat(23)}👑👑` });
    assert.match(decode(emoji), new RegExp(`>${"A".repeat(23)}👑<`));
    assert.ok(
      wellFormed(
        decode(renderGarmentSvg({ templateId: "aop-hoodie", label: "NUL\u0000BELL\u0007" })),
      ),
    );
  });
});

describe("art panel size", () => {
  const big = `data:image/png;base64,${"A".repeat(MAX_ART_SRC)}`;
  const fits = `data:image/png;base64,${"A".repeat(500_000)}`;

  it("refuses one art fill over the layer cap", () => {
    const garment = setPanelFill(defaultGarment("aop-hoodie"), "hood", { kind: "art", src: big });
    assert.throws(() => parseGarment(garment), /panel picture is too large/);
  });

  it("refuses a garment whose art fills are too large together", () => {
    let garment = defaultGarment("aop-hoodie");
    for (const id of ["hood", "sleeve_left", "sleeve_right", "body_front"]) {
      garment = setPanelFill(garment, id, { kind: "art", src: fits });
    }
    assert.ok(JSON.stringify(garment).length > MAX_GARMENT_JSON);
    assert.throws(() => parseGarment(garment), /too large together/);
    const three = setPanelFill(
      setPanelFill(defaultGarment("aop-hoodie"), "hood", { kind: "art", src: fits }),
      "pocket",
      {
        kind: "art",
        src: fits,
      },
    );
    assert.equal(parseGarment(three).panels.find((item) => item.id === "pocket")?.fill.kind, "art");
  });
});
