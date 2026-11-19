import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "vitest";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const srcRoot = join(root, "src");

/** Cycles that already existed before the garment split. A new one fails the test. */
const KNOWN_CYCLES = new Set([
  "lib/social/activity-api.ts|lib/social/activity.server.ts",
  "lib/social/makers.server.ts|lib/social/rack.server.ts",
  "routeTree.gen.ts|router.tsx",
]);

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      found.push(...walk(path));
      continue;
    }
    if (/\.(ts|tsx|mts)$/.test(entry)) found.push(path);
  }
  return found;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith("@/")) target = join(srcRoot, spec.slice(2));
  else if (spec.startsWith(".")) target = resolve(dirname(fromFile), spec);
  else return null;
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.mts`,
    join(target, "index.ts"),
    join(target, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importsOf(file: string): string[] {
  const text = stripComments(readFileSync(file, "utf8"));
  const specs = new Set<string>();
  for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
    if (match[1]) specs.add(match[1]);
  }
  for (const match of text.matchAll(/import\s*\(\s*["']([^"']+)["']/g)) {
    if (match[1]) specs.add(match[1]);
  }
  const resolved: string[] = [];
  for (const spec of specs) {
    const next = resolveSpec(file, spec);
    if (next) resolved.push(next);
  }
  return resolved;
}

function relSrc(file: string): string {
  return relative(srcRoot, file).split("\\").join("/");
}

describe("garment module boundaries", () => {
  it("does not let the pod layer import studio code or components", () => {
    const offenders: string[] = [];
    for (const file of walk(join(srcRoot, "lib", "pod"))) {
      if (/\.test\./.test(file)) continue;
      for (const next of importsOf(file)) {
        const rel = relSrc(next);
        if (rel.startsWith("lib/studio/") || rel.startsWith("components/")) {
          offenders.push(`${relSrc(file)} -> ${rel}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("has no new import cycles", () => {
    const files = walk(srcRoot);
    const ids = new Set(files.map(relSrc));
    const graph = new Map<string, string[]>();
    for (const file of files) {
      graph.set(
        relSrc(file),
        importsOf(file)
          .map(relSrc)
          .filter((item) => ids.has(item)),
      );
    }
    const color = new Map<string, number>();
    const cycles = new Set<string>();
    function visit(node: string, stack: string[]) {
      color.set(node, 1);
      stack.push(node);
      for (const next of graph.get(node) ?? []) {
        const state = color.get(next) ?? 0;
        if (state === 1) {
          const start = stack.indexOf(next);
          if (start >= 0) cycles.add([...stack.slice(start)].sort().join("|"));
        } else if (state === 0 && graph.has(next)) {
          visit(next, stack);
        }
      }
      stack.pop();
      color.set(node, 2);
    }
    for (const node of graph.keys()) {
      if ((color.get(node) ?? 0) === 0) visit(node, []);
    }
    const fresh = [...cycles].filter((cycle) => !KNOWN_CYCLES.has(cycle)).sort();
    assert.deepEqual(fresh, []);
  });

  it("does not fall back to a hardcoded tracksuit id", () => {
    const files = [
      "src/components/studio/editor.tsx",
      "src/lib/studio/garments.server.ts",
      "src/lib/pod/sandbox.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(root, file), "utf8");
      assert.equal(text.includes('?? "aop-hoodie"'), false, file);
      assert.equal(text.includes('?? "aop-joggers"'), false, file);
      assert.equal(text.includes('"aop-hoodie"'), false, file);
      assert.equal(text.includes('"aop-joggers"'), false, file);
      assert.equal(text.includes('"aop-track-jacket"'), false, file);
    }
  });
});
