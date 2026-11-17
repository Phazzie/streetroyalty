import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every server function is an endpoint anyone on the internet can call. This
 * reads the source and checks that each one either requires a signed-in user or
 * is on the list below with the reason it is open. A new open endpoint has to
 * be put here on purpose.
 */

const OPEN: Record<string, string> = {
  // Studio catalog and config: the same for everyone, nothing personal.
  getStudioConfig: "public config",
  listCatalog: "public catalog",
  getCatalogProduct: "public catalog",
  makeMockup: "anyone can preview a mockup; it reads the user only if there is one",
  shopList: "the public rack",
  shopPiece: "a public rack page",
  // Fourthwall storefront: a public shop.
  getStorefront: "public shop",
  getStoreProduct: "public shop",
  startStoreCheckout: "guest checkout on Fourthwall, capped per visitor",
  getProductPhoto: "public product photo",
  // The lab and the crown: open to visitors, bounded by the daily AI caps.
  critiqueOutfit: "AI text, capped",
  suggestLines: "AI text, capped",
  nameLook: "AI text, capped",
  printNote: "AI text, capped",
  pickCrowd: "AI text, capped",
  vibeTerms: "AI text, capped",
  planOutfit: "AI text, capped",
  generateArt: "AI image, capped",
  generatePiece: "AI image, capped",
  generateLook: "AI image, capped",
  startRunway: "AI video, capped",
  pollRunway: "reads a run the visitor started",
  getConnectorReadiness: "template plumbing; reports readiness only",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

type Endpoint = { name: string; file: string; requiresUser: boolean };

function endpoints(): Endpoint[] {
  const found: Endpoint[] = [];
  for (const file of sourceFiles("src")) {
    if (file.startsWith(join("src", "test"))) continue;
    const text = readFileSync(file, "utf8");
    const starts = [...text.matchAll(/export const (\w+) = createServerFn\(/g)];
    starts.forEach((match, index) => {
      const from = match.index ?? 0;
      const to = starts[index + 1]?.index ?? text.length;
      const chain = text.slice(from, to);
      const beforeHandler = chain.slice(0, chain.indexOf(".handler("));
      found.push({
        name: match[1] ?? "",
        file,
        requiresUser: /\.middleware\(\[\s*authMiddleware\s*\]\)/.test(beforeHandler),
      });
    });
  }
  return found;
}

describe("server functions", () => {
  const all = endpoints();

  it("are all found by this test", () => {
    expect(all.length).toBeGreaterThanOrEqual(40);
  });

  it("require a signed-in user unless listed as open, with a reason", () => {
    const unlisted = all.filter((fn) => !fn.requiresUser && !(fn.name in OPEN));
    expect(unlisted.map((fn) => `${fn.name} (${fn.file})`)).toEqual([]);
  });

  it("are not both gated and listed as open", () => {
    const stale = all.filter((fn) => fn.requiresUser && fn.name in OPEN).map((fn) => fn.name);
    expect(stale).toEqual([]);
  });

  it("has no open-list entry for a function that no longer exists", () => {
    const names = new Set(all.map((fn) => fn.name));
    expect(Object.keys(OPEN).filter((name) => !names.has(name))).toEqual([]);
  });

  it("never take the user id from the client", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src/lib")) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("createServerFn(")) continue;
      if (/data\.userId|input\.userId|data\.user_id/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
