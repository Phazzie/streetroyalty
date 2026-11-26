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
  getShopContact: "the shop email shown on the public contact page",
  getSizeGuides: "Printful size tables shown on the public size guide",
  listOAuthProviders: "login page asks which sign-in buttons this host may show; no user data",
  listCatalog: "public catalog",
  getCatalogProduct: "public catalog",
  makeMockup: "anyone can preview a mockup; it reads the user only if there is one",
  shopList: "the public rack",
  shopPiece: "a public rack page",
  getConnectorReadiness: "template plumbing; reports readiness only",
  // Street scans: a stranger who scans a tag is not signed in.
  countTagScan: "counts one scan of a public piece; same-site only, capped per piece per day",
  tagScans: "a public count on a public rack page",
  // Makers and the social rack: public shop pages. The viewer is read only to mark their own crowns and follows.
  rackList: "the public rack, with makers and crown counts",
  rackPiece: "a public rack page",
  makerPage: "a maker's public shop window, published pieces only",
  pieceFamily: "a published piece's public family tree",
  nextBattle: "anyone can watch a battle; reads published pieces only, writes nothing",
  throne: "the public battle leaderboard",
  tryOnStatus: "says whether try-on is on and the daily allowance; the same for everyone",
  goLiveBoard: "lists services and missing variable names; per-variable status only for admins",
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

  it("refuses a signed-out caller on every route that spends on xAI", () => {
    const paid = [
      "generateArt",
      "generateLook",
      "startRunway",
      "pollRunway",
      "critiqueOutfit",
      "suggestLines",
      "nameLook",
      "printNote",
      "pickCrowd",
      "vibeTerms",
      "planOutfit",
    ];
    const byName = new Map(all.map((fn) => [fn.name, fn]));
    const open = paid.filter((name) => !byName.get(name)?.requiresUser);
    expect(open).toEqual([]);
    expect(paid.filter((name) => name in OPEN)).toEqual([]);
  });

  it("charges those calls to the signed-in account, not an address the client picked", () => {
    const art = readFileSync("src/lib/ai/art.ts", "utf8");
    expect(art).toContain('admit("image", context.userId)');
    const lab = readFileSync("src/lib/lab-api.ts", "utf8");
    expect(lab).toContain("admit(kind, userId)");
    expect(lab).toContain('refuse("image", context.userId)');
    expect(lab).toContain('refuse("video", context.userId)');
    const api = readFileSync("src/lib/ai/api.ts", "utf8");
    const calls = api.match(/guardedText\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(7);
    expect((api.match(/context\.userId/g) ?? []).length).toBeGreaterThanOrEqual(calls.length);
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
