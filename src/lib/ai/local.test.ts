import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterByTerms,
  localCritique,
  localCrowd,
  localLines,
  localLookName,
  localPrintNote,
  parseCritique,
  parseCrowd,
  parseLines,
  parseLookName,
  parseTerms,
  searchTerms,
} from "./local.ts";

describe("local critique and lines", () => {
  it("asks for shoes when the look has none", () => {
    const critique = localCritique("black hoodie and wool trousers");
    assert.match(critique.next, /Shoes/);
    assert.equal(localCritique("").verdict, "Nothing on yet");
  });

  it("parses a model critique and rejects junk", () => {
    assert.deepEqual(parseCritique('note {"verdict":"Sharp","note":"The coat carries it.","next":"Black boots"}'), {
      verdict: "Sharp",
      note: "The coat carries it.",
      next: "Black boots",
    });
    assert.equal(parseCritique("no json here"), null);
  });

  it("keeps three short lines", () => {
    assert.equal(localLines("night bus").length, 3);
    assert.deepEqual(parseLines("1. CROWN\n- ON\n\"LATE\""), ["CROWN", "ON", "LATE"]);
  });
});

describe("names, print notes, and the crowd", () => {
  it("names a look from the clothes and parses a model title", () => {
    assert.equal(localLookName("black hoodie and wool trousers"), "Black Hoodie And");
    assert.equal(parseLookName(' "Night Bus" '), "Night Bus");
    assert.equal(parseLookName("x"), null);
  });

  it("gives sleeve, back, and front different print advice", () => {
    assert.match(localPrintNote("sleeve", "tee"), /Sleeve/);
    assert.match(localPrintNote("back", "hoodie"), /back/);
    assert.match(localPrintNote("front", "tee"), /poster/);
    assert.equal(parseCrowd("They should boo"), "boo");
    assert.equal(parseCrowd("no opinion"), null);
    assert.equal(localCrowd(0), "cheer");
  });
});

describe("rack search", () => {
  it("matches any useful word and ignores tiny ones", () => {
    assert.deepEqual(searchTerms("a pink hoodie"), ["pink", "hoodie"]);
    const rack = [
      { title: "Night bus tee", productName: "Heavyweight Street Tee" },
      { title: "Lime hat", productName: "Dad Hat" },
    ];
    assert.equal(filterByTerms(rack, parseTerms("tee, hat"), (item) => `${item.title} ${item.productName}`).length, 2);
    assert.equal(filterByTerms(rack, ["missing"], (item) => item.title).length, 0);
  });
});
