import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dnaFrom, dnaLabel, mutateDna, seededRng, variantFamily, designChangelog } from "./dna.ts";
import { bundlePrice, categorize, completeTheLook } from "./bundle.ts";
import { adKitFor, psaCards } from "./adkit.ts";
import { rescueFor, scoreFitting, FIT_PROBLEMS } from "./fitting.ts";
import { courtTerms, joinCourt, leaveCourt, ROYAL_COURT_TIERS } from "./membership.ts";

const BANNED = ["comeback", "fresh start", "second chance", "rebuild", "healing", "journey", "you got this", "proud of you"];

describe("remix dice", () => {
  it("is deterministic from a seed and mutates within the family", () => {
    const dna = dnaFrom();
    const a = variantFamily(dna, 4, 42);
    const b = variantFamily(dna, 4, 42);
    assert.deepEqual(a, b);
    assert.equal(a.length, 4);
    for (const variant of a) {
      assert.equal(variant.garment, dna.garment);
      assert.notEqual(dnaLabel(variant), dnaLabel(dna));
    }
    const rng = seededRng(7);
    for (let i = 0; i < 50; i += 1) {
      const value = rng();
      assert.ok(value >= 0 && value < 1);
    }
    const mutated = mutateDna(dna, seededRng(3));
    assert.equal(mutated.garment, dna.garment);
  });

  it("writes a public changelog with drop openings and fork credits", () => {
    const entries = designChangelog(
      [{ title: "Night Fork", forkedFromTitle: "Night Shift Tee", updatedAt: "2026-11-12T00:00:00.000Z", collectionId: "c1" }],
      [{ collectionId: "c1", name: "Core Four", dropAt: "2026-11-10T00:00:00.000Z" }],
    );
    assert.equal(entries.length, 2);
    assert.match(entries[0]!.text, /Co-designed/);
    assert.match(entries[1]!.text, /Drop opened/);
  });
});

describe("bundles", () => {
  it("categorizes the rack and prices a complete look at 10% off, integer cents", () => {
    assert.equal(categorize("Joggers"), "bottom");
    assert.equal(categorize("Pullover Hoodie"), "outer");
    assert.equal(categorize("Dad Hat"), "hat");
    const price = bundlePrice([
      { id: "1", title: "Tee", category: "top", retailCents: 3069 },
      { id: "2", title: "Joggers", category: "bottom", retailCents: 5930 },
      { id: "3", title: "Hat", category: "hat", retailCents: 2629 },
    ]);
    assert.equal(price.complete, true);
    assert.equal(price.subtotalCents, 11628);
    assert.equal(price.discountCents, 1162);
    assert.equal(price.totalCents, 10466);
    const partial = bundlePrice([{ id: "1", title: "Tee", category: "top", retailCents: 3069 }]);
    assert.equal(partial.complete, false);
    assert.equal(partial.discountCents, 0);
  });

  it("suggests the missing categories, cheapest first", () => {
    const rack = [
      { id: "t1", productType: "T-Shirt", retailCents: 3000 },
      { id: "j1", productType: "Joggers", retailCents: 5900 },
      { id: "j2", productType: "Joggers", retailCents: 4900 },
      { id: "h1", productType: "Hat", retailCents: 2600 },
    ];
    const suggestions = completeTheLook(rack, [rack[0]!]);
    assert.deepEqual(
      suggestions.map((piece) => piece.id),
      ["j2", "h1"],
    );
  });
});

describe("ad factory", () => {
  const piece = { title: "Night Shift Tee", productName: "Heavyweight Street Tee", retailCents: 3069 };
  it("mints statics across colorways and both themes, plus offers and PSA cards", () => {
    const kit = adKitFor(piece);
    const statics = kit.filter((card) => card.kind === "static");
    assert.equal(statics.length, 12);
    assert.ok(kit.some((card) => card.kind === "offer" && card.sub.includes("No membership")));
    assert.equal(psaCards(piece).length, 4);
    assert.ok(kit.length >= 18);
  });

  it("keeps every card inside the voice locks", () => {
    for (const card of adKitFor(piece)) {
      const text = `${card.headline} ${card.sub} ${card.cta}`.toLowerCase();
      for (const banned of BANNED) assert.ok(!text.includes(banned), `banned in: ${text}`);
    }
  });
});

describe("crown fitting + fit rescue", () => {
  it("seeds a colorway and a size lane from answers", () => {
    const stealth = scoreFitting({ scene: "boardroom", fit: "classic", nerve: "stealth" });
    assert.equal(stealth.colorway.name, "Clean money");
    assert.match(stealth.sizeLane, /Classic lane/);
    const loud = scoreFitting({ scene: "night", fit: "oversized", nerve: "loud" });
    assert.equal(loud.colorway.name, "Ultraviolet block");
    assert.match(loud.line, /Fitted:/);
  });

  it("every rescue names a fix and a target blank, in voice", () => {
    for (const problem of FIT_PROBLEMS) {
      const rescue = rescueFor(problem.id);
      assert.ok(rescue.fix.length > 20);
      assert.ok(rescue.targetType.length > 0);
      const text = `${rescue.psa} ${rescue.fix}`.toLowerCase();
      for (const banned of BANNED) assert.ok(!text.includes(banned), `banned in: ${text}`);
    }
    assert.equal(rescueFor("nope").id, FIT_PROBLEMS[0]!.id);
  });
});

describe("royal court (test mode)", () => {
  it("prints the terms loud: price, test mode, one-click exit", () => {
    for (const tier of ROYAL_COURT_TIERS) {
      const terms = courtTerms(tier).join(" ");
      assert.match(terms, /TEST MODE: no card is charged/);
      assert.match(terms, /Cancel in one click/);
      assert.match(terms, /a month/);
    }
  });

  it("join and leave flip local test state only", () => {
    const joined = joinCourt({ tierId: null, mode: "test", joined: false }, "court");
    assert.equal(joined.joined, true);
    assert.equal(joined.mode, "test");
    assert.deepEqual(leaveCourt(), { tierId: null, mode: "test", joined: false });
    const bad = joinCourt({ tierId: null, mode: "test", joined: false }, "nope");
    assert.equal(bad.joined, false);
  });
});
