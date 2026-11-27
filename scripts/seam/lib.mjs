// Shared helpers for the seam kit checks. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export const PHASES = ['explore', 'blueprint', 'skeleton', 'build'];

/** The one way to write an unbuilt function body in the skeleton phase. */
export const SKELETON_THROW = "throw new Error('SKELETON: not built yet');";

export const DEFAULT_CONFIG = {
  maxLines: 200,
  maxSeams: 15,
  minSeamsHint: 3,
  unflippedWarnDays: 3,
  unflippedWarnCommits: 10,
  unflippedFail: false,
  foundationSeams: ['config', 'auth', 'state'],
  codeDirs: ['src', 'contracts', 'mocks', 'probes'],
  headerDirs: ['src', 'contracts', 'mocks'],
  codeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'],
  configDir: 'src/config',
  mocksDir: 'mocks',
  fixturesDir: 'probes/fixtures',
  contractsDir: 'contracts',
  lockedPaths: ['tests/', 'contracts/', 'probes/fixtures/'],
  kitPaths: ['.seam/', '.githooks/', 'scripts/seam/', '.github/workflows/seam.yml', '.claude/', '.cursor/hooks.json', '.cursor/hooks/', 'vitest.config.ts', 'tsconfig.json'],
  blueprintFiles: ['blueprint/BLUEPRINT.md', 'blueprint/manifest.json'],
  driftLog: 'blueprint/DRIFT-LOG.md',
  manifest: 'blueprint/manifest.json',
  exploreAlwaysOn: ['hardcoded-keys'],
  ignoreDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', '.vercel'],
  secretScanSkip: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'],
  secretAllowlist: [],
  typecheckCmd: 'npx tsc --noEmit -p tsconfig.json',
  testCmd: 'npx vitest run',
  ciRunRealTests: false,
  minPseudocodeSteps: 3,
  skeletonExemptDirs: ['contracts', 'mocks'],
};

export function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

/** Like git() but returns null when git exits non-zero (for "file may not exist" lookups). */
export function gitMaybe(args, opts = {}) {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

export function repoRoot(cwd = process.cwd()) {
  const out = gitMaybe(['rev-parse', '--show-toplevel'], { cwd });
  return out ? out.trim() : cwd;
}

export function normalizePhase(text) {
  if (text == null) return null;
  const p = String(text).trim().toLowerCase();
  if (!PHASES.includes(p)) {
    throw new Error(`.seam/phase contains "${p}". It must be one of: ${PHASES.join(', ')}`);
  }
  return p;
}

/** Phase stored in a commit (ref) or in the index (ref = ':'). null if the file is missing there. */
export function phaseAt(ref, cwd) {
  const spec = ref === ':' ? ':.seam/phase' : `${ref}:.seam/phase`;
  const out = gitMaybe(['show', spec], { cwd });
  return out == null ? null : normalizePhase(out);
}

export function phaseInDir(dir) {
  const f = path.join(dir, '.seam', 'phase');
  if (!fs.existsSync(f)) return null;
  return normalizePhase(fs.readFileSync(f, 'utf8'));
}

/** The strictest of several phases (build > skeleton > blueprint > explore). Missing values are ignored. */
export function strictest(...phases) {
  const known = phases.filter(Boolean);
  if (known.length === 0) return 'explore';
  return known.reduce((a, b) => (PHASES.indexOf(b) > PHASES.indexOf(a) ? b : a));
}

export function loadConfig(dir) {
  const f = path.join(dir, '.seam', 'config.json');
  if (!fs.existsSync(f)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { ...DEFAULT_CONFIG, ...raw };
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Recursively list files under dir (relative POSIX paths), skipping ignored directories. */
export function listFiles(dir, cfg, sub = '') {
  const start = path.join(dir, sub);
  if (!fs.existsSync(start)) return [];
  const out = [];
  const stack = [sub];
  while (stack.length) {
    const rel = stack.pop();
    const abs = path.join(dir, rel);
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (cfg.ignoreDirs.includes(ent.name)) continue;
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) stack.push(r);
      else if (ent.isFile()) out.push(toPosix(r));
    }
  }
  return out.sort();
}

export function isCode(file, cfg) {
  return cfg.codeExtensions.includes(path.extname(file));
}

export function underAny(file, dirs) {
  return dirs.some((d) => {
    const dd = d.endsWith('/') ? d : `${d}/`;
    return file === d || file.startsWith(dd);
  });
}

export function matchesPathList(file, list) {
  return list.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}

export function readText(dir, file) {
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

export function loadManifest(dir, cfg) {
  const f = path.join(dir, cfg.manifest);
  if (!fs.existsSync(f)) return { manifest: null, error: `${cfg.manifest} is missing` };
  try {
    return { manifest: JSON.parse(fs.readFileSync(f, 'utf8')), error: null };
  } catch (e) {
    return { manifest: null, error: `${cfg.manifest} is not valid JSON: ${e.message}` };
  }
}

/** Every file path the manifest mentions, mapped to the seam that owns it. */
export function manifestFiles(manifest) {
  const map = new Map();
  for (const seam of manifest?.seams ?? []) {
    const add = (f, role) => {
      if (typeof f === 'string' && f) map.set(f, { seam: seam.name, role });
    };
    for (const f of seam.files ?? []) add(f, 'file');
    add(seam.contract, 'contract');
    add(seam.mock, 'mock');
    for (const f of seam.tests ?? []) add(f, 'test');
    for (const f of seam.realTests ?? []) add(f, 'realTest');
    for (const f of seam.fixtures ?? []) add(f, 'fixture');
  }
  return map;
}

export function finding(check, msg, file, line) {
  return { check, msg, file: file ?? null, line: line ?? null };
}

/** Config as committed in a ref (so a commit can't loosen the rules that judge it). Falls back to defaults. */
export function loadConfigAt(ref, cwd) {
  const out = gitMaybe(['show', `${ref}:.seam/config.json`], { cwd });
  return out == null ? { ...DEFAULT_CONFIG } : { ...DEFAULT_CONFIG, ...JSON.parse(out) };
}

/** The repo's own TypeScript compiler (accurate parsing), or null if it isn't installed. */
export function loadTs(dir) {
  try {
    return createRequire(path.join(dir, 'package.json'))('typescript');
  } catch {
    return null;
  }
}
