#!/usr/bin/env node
// One-time setup after copying the seam kit into a repo:
//  - turns on the git hooks (core.hooksPath = .githooks)
//  - creates blueprint/ and plan/ from templates/ (never overwrites your files)
//  - adds the seam npm scripts and dev dependencies to package.json (never overwrites existing entries)
//  - starts you in the explore phase
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let repo;
try {
  repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  console.log('[seam] not inside a git repo yet. Run `git init`, then `npm run seam:install`.');
  process.exit(0);
}
const p = (...x) => path.join(repo, ...x);

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: repo });
for (const h of ['pre-commit', 'commit-msg']) if (fs.existsSync(p('.githooks', h))) fs.chmodSync(p('.githooks', h), 0o755);
console.log('[seam] git hooks on (core.hooksPath = .githooks)');
if (process.argv.includes('--hooks-only')) process.exit(0); // used by `npm install` (prepare) so every clone gets the hooks

const copies = [
  ['templates/BLUEPRINT.md', 'blueprint/BLUEPRINT.md'],
  ['templates/manifest.json', 'blueprint/manifest.json'],
  ['templates/DRIFT-LOG.md', 'blueprint/DRIFT-LOG.md'],
  ['templates/UI-FAILURE-STATES.md', 'blueprint/UI-FAILURE-STATES.md'],
  ['templates/FREEZE.md', 'plan/FREEZE.md'],
  ['templates/FEATURES.md', 'plan/FEATURES.md'],
  ['templates/MIGRATION.md', 'plan/MIGRATION.md'],
  ['templates/CUTOVER.md', 'plan/CUTOVER.md'],
];
for (const [from, to] of copies) {
  if (fs.existsSync(p(to)) || !fs.existsSync(p(from))) continue;
  fs.mkdirSync(path.dirname(p(to)), { recursive: true });
  fs.copyFileSync(p(from), p(to));
  console.log(`[seam] created ${to}`);
}
fs.mkdirSync(p('.seam'), { recursive: true });
if (!fs.existsSync(p('.seam', 'phase'))) fs.writeFileSync(p('.seam', 'phase'), 'explore\n');

const kitPkg = JSON.parse(fs.readFileSync(p('scripts', 'seam', 'package-fragment.json'), 'utf8'));
const pkgPath = p('package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : { name: path.basename(repo), private: true, type: 'module' };
for (const key of ['scripts', 'dependencies', 'devDependencies']) {
  pkg[key] = pkg[key] ?? {};
  for (const [k, v] of Object.entries(kitPkg[key] ?? {})) {
    if (pkg[key][k] && pkg[key][k] !== v) console.log(`[seam] kept your package.json ${key}.${k} = "${pkg[key][k]}" (kit wanted "${v}")`);
    else pkg[key][k] = v;
  }
}
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('[seam] package.json updated. Run: npm install');
console.log(`[seam] phase: ${fs.readFileSync(p('.seam', 'phase'), 'utf8').trim()}. Next: read METHODOLOGY.md, then fill in plan/FREEZE.md and plan/FEATURES.md.`);
