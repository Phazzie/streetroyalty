#!/usr/bin/env node
// Seam kit entry point. Every hook (git, CI, npm scripts) calls this file.
//   node scripts/seam/run.mjs pre-commit            checks the exact snapshot being committed
//   node scripts/seam/run.mjs commit-msg <file>     the test/contract lock (needs the message)
//   node scripts/seam/run.mjs ci --base A --head B  same checks for CI, commit by commit
//   node scripts/seam/run.mjs check                 run the checks on your working folder now
//   node scripts/seam/run.mjs report                seam status table + unflipped seams
//   node scripts/seam/run.mjs phase [explore|blueprint|skeleton|build]
//   node scripts/seam/run.mjs test [mock|real]
//   node scripts/seam/run.mjs unlock [minutes]      HUMAN ONLY: let AI agents edit tests/contracts briefly
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBlueprintHeader } from './checks/blueprint-header.mjs';
import { checkFileSize } from './checks/file-size.mjs';
import { checkLock } from './checks/lock-tests.mjs';
import { checkMocks } from './checks/mocks-from-fixtures.mjs';
import { checkNoSilentErrors } from './checks/no-silent-errors.mjs';
import { checkEnvReads, checkHardcodedKeys } from './checks/secrets-env.mjs';
import { checkOverSeaming, checkSeamCount, checkUnflipped, statusTable, unflippedSeams } from './checks/seam-report.mjs';
import { checkPseudocode, checkSkeleton, checkSkeletonLeft, unbuiltFiles } from './checks/skeleton.mjs';
import { checkTests, checkTypecheck, runRealTests } from './checks/typecheck-tests.mjs';
import { PHASES, git, gitMaybe, loadConfig, loadConfigAt, loadManifest, phaseAt, phaseInDir, repoRoot, strictest } from './lib.mjs';

// What each check does in each phase: 'error' blocks, 'warn' prints, 'off' skips.
export const LEVELS = {
  explore: {},
  blueprint: {
    'blueprint-header': 'error', manifest: 'error', 'manifest-missing-file': 'warn', 'build-order': 'warn', 'seam-status': 'warn',
    'hardcoded-keys': 'error', 'env-reads': 'warn', 'no-silent-errors': 'warn', 'file-size': 'warn', 'mocks-from-fixtures': 'warn',
    'seam-count': 'warn', 'over-seaming': 'warn', unflipped: 'off', 'lock-tests': 'off', typecheck: 'off', tests: 'off',
    pseudocode: 'warn', skeleton: 'off', 'skeleton-left': 'off', 'phase-gate': 'error',
  },
  skeleton: {
    'blueprint-header': 'error', manifest: 'error', 'manifest-missing-file': 'warn', 'build-order': 'warn', 'seam-status': 'warn',
    'hardcoded-keys': 'error', 'env-reads': 'warn', 'no-silent-errors': 'warn', 'file-size': 'warn', 'mocks-from-fixtures': 'warn',
    'seam-count': 'warn', 'over-seaming': 'off', unflipped: 'off', 'lock-tests': 'off', typecheck: 'warn', tests: 'off',
    pseudocode: 'error', skeleton: 'error', 'skeleton-left': 'off', 'phase-gate': 'error',
  },
  build: {
    'blueprint-header': 'error', manifest: 'error', 'manifest-missing-file': 'error', 'build-order': 'error', 'seam-status': 'error',
    'hardcoded-keys': 'error', 'env-reads': 'error', 'no-silent-errors': 'error', 'file-size': 'error', 'mocks-from-fixtures': 'error',
    'seam-count': 'warn', 'over-seaming': 'warn', unflipped: 'warn', 'lock-tests': 'error', typecheck: 'error', tests: 'error',
    pseudocode: 'error', skeleton: 'off', 'skeleton-left': 'warn', 'phase-gate': 'error',
  },
};

function levelFor(phase, check, cfg) {
  if (phase === 'explore') return cfg.exploreAlwaysOn.includes(check) ? 'error' : 'off';
  let lvl = LEVELS[phase][check] ?? 'warn';
  if (check === 'unflipped' && cfg.unflippedFail && phase === 'build') lvl = 'error';
  return lvl;
}

function treeChecks(ctx, phase) {
  const on = (c) => levelFor(phase, c, ctx.cfg) !== 'off';
  const all = [];
  if (on('hardcoded-keys')) all.push(...checkHardcodedKeys(ctx));
  if (phase === 'explore') return all;
  all.push(...checkBlueprintHeader(ctx));
  if (on('pseudocode')) all.push(...checkPseudocode(ctx));
  if (on('skeleton')) all.push(...checkSkeleton(ctx));
  if (on('skeleton-left')) all.push(...checkSkeletonLeft(ctx));
  if (on('env-reads')) all.push(...checkEnvReads(ctx));
  if (on('no-silent-errors')) all.push(...checkNoSilentErrors(ctx));
  if (on('file-size')) all.push(...checkFileSize(ctx));
  if (on('mocks-from-fixtures')) all.push(...checkMocks(ctx));
  if (on('seam-count')) all.push(...checkSeamCount(ctx));
  if (on('over-seaming')) all.push(...checkOverSeaming(ctx));
  if (on('unflipped')) all.push(...checkUnflipped(ctx));
  return all;
}

function slowChecks(ctx, phase) {
  const out = [];
  if (levelFor(phase, 'typecheck', ctx.cfg) !== 'off') out.push(...checkTypecheck(ctx));
  if (levelFor(phase, 'tests', ctx.cfg) !== 'off') out.push(...checkTests(ctx));
  return out;
}

// ---------- phase gates: the skeleton step can't be skipped ----------
const STEP_BEFORE = { blueprint: ['explore'], skeleton: ['blueprint'], build: ['skeleton'] };
const PHASE_HOW = {
  blueprint: 'write the plan first (skills/blueprint-generator)',
  skeleton: 'go through the blueprint phase first: npm run seam:phase blueprint, write and review the plan',
  build: 'go through the skeleton phase first: npm run seam:phase skeleton, write every planned file as a skeleton (skills/skeleton-writer), have the human review it, then npm run seam:phase build',
};

/** Everything that must be true before leaving skeleton for build, checked on the whole tree (not just changed files). */
function skeletonGate(ctx) {
  const gate = (f) => ({ ...f, check: 'phase-gate', level: 'error', msg: `[leaving skeleton] ${f.msg}` });
  const keep = new Set(['blueprint-header', 'manifest', 'manifest-missing-file', 'pseudocode', 'skeleton']);
  return [...checkBlueprintHeader(ctx), ...checkPseudocode(ctx), ...checkSkeleton(ctx)].filter((f) => keep.has(f.check)).map(gate);
}

/** Findings for a commit that moves the phase forward from `from` to `to`. Moving backward is handled by the lock. */
function transitionFindings(ctx, from, to) {
  if (!from || !to || from === to || PHASES.indexOf(to) < PHASES.indexOf(from)) return [];
  const out = [];
  if (!STEP_BEFORE[to].includes(from)) {
    out.push({ check: 'phase-gate', level: 'error', file: '.seam/phase', line: null, msg: `you can't jump from the ${from} phase straight to ${to}. Phases go explore -> blueprint -> skeleton -> build, one step at a time: ${PHASE_HOW[to]}.` });
  }
  if (to === 'build') out.push(...skeletonGate(ctx));
  return out;
}

function classify(findings, phase, cfg) {
  return findings
    .map((f) => ({ ...f, level: f.level ?? levelFor(phase, f.check, cfg) }))
    .filter((f) => f.level !== 'off');
}

function print(title, phase, findings) {
  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');
  const infos = findings.filter((f) => f.level === 'info');
  const loc = (f) => (f.file ? `${f.file}${f.line ? `:${f.line}` : ''}  ` : '');
  console.log(`\n[seam] ${title} (phase: ${phase})`);
  for (const f of errors) console.log(`  BLOCK  [${f.check}] ${loc(f)}${f.msg}`);
  const shown = {};
  for (const f of warns) {
    shown[f.check] = (shown[f.check] ?? 0) + 1;
    if (shown[f.check] <= 5 || process.argv.includes("--all")) console.log(`  warn   [${f.check}] ${loc(f)}${f.msg}`);
  }
  for (const [check, n] of Object.entries(shown)) if (n > 5 && !process.argv.includes("--all")) console.log(`  warn   [${check}] ...and ${n - 5} more like this (run: npm run seam:check -- --all)`);
  for (const f of infos) console.log(`  note   [${f.check}] ${f.msg}`);
  if (errors.length) {
    console.log(`\n[seam] BLOCKED: ${errors.length} problem(s). Fix them (or regenerate the file from the blueprint) and commit again.`);
    console.log('[seam] Do not bypass with --no-verify: CI runs the same checks and will fail the push.');
  } else {
    console.log(`[seam] OK${warns.length ? ` with ${warns.length} warning(s)` : ''}.`);
  }
  return errors.length;
}

function ctxFor(dir, repo, phase) {
  const cfg = loadConfig(dir);
  const { manifest, error } = loadManifest(dir, cfg);
  return { dir, repo, cfg, manifest, manifestError: error, phase };
}

function headExists(repo) {
  return gitMaybe(['rev-parse', '--verify', 'HEAD'], { cwd: repo }) != null;
}

/** Export exactly what is staged into a temp folder, so we check the commit and not your unsaved edits. */
function snapshotIndex(repo) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-snap-'));
  git(['checkout-index', '-a', '-f', `--prefix=${tmp}${path.sep}`], { cwd: repo });
  const nm = path.join(repo, 'node_modules');
  if (fs.existsSync(nm) && !fs.existsSync(path.join(tmp, 'node_modules'))) fs.symlinkSync(nm, path.join(tmp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return tmp;
}

/** Export one commit's tree into a temp folder (used by CI to judge a phase change as of that commit). */
function snapshotCommit(repo, rev) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-commit-'));
  const tar = spawnSync('git', ['archive', '--format=tar', rev], { cwd: repo, maxBuffer: 1 << 30 });
  if (tar.status !== 0) throw new Error(`could not read commit ${rev}: ${tar.stderr}`);
  const x = spawnSync('tar', ['-x', '-C', tmp], { input: tar.stdout });
  if (x.status !== 0) throw new Error(`could not unpack commit ${rev}: ${x.stderr}`);
  const nm = path.join(repo, 'node_modules');
  if (fs.existsSync(nm) && !fs.existsSync(path.join(tmp, 'node_modules'))) fs.symlinkSync(nm, path.join(tmp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return tmp;
}

function stagedFiles(repo) {
  return git(['diff', '--cached', '--name-only', '--no-renames', '-z'], { cwd: repo }).split('\0').filter(Boolean);
}

function cmdPreCommit() {
  const repo = repoRoot();
  const before = headExists(repo) ? phaseAt('HEAD', repo) : null;
  const phase = strictest(before, phaseAt(':', repo));
  const snap = snapshotIndex(repo);
  try {
    const ctx = ctxFor(snap, repo, phase);
    let findings = treeChecks(ctx, phase).concat(transitionFindings(ctx, before, phaseAt(':', repo)));
    const fast = classify(findings, phase, ctx.cfg);
    // Only spend time on typecheck/tests if the fast checks passed.
    if (!fast.some((f) => f.level === 'error')) findings = findings.concat(slowChecks(ctx, phase));
    return print('pre-commit checks', phase, classify(findings, phase, ctx.cfg));
  } finally {
    fs.rmSync(snap, { recursive: true, force: true });
  }
}

function cmdCommitMsg(msgFile) {
  const repo = repoRoot();
  const message = fs.readFileSync(msgFile, 'utf8').split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const phase = headExists(repo) ? strictest(phaseAt('HEAD', repo)) : 'explore';
  const cfg = headExists(repo) ? loadConfigAt('HEAD', repo) : loadConfig(repo);
  const findings = classify(checkLock({ cfg, phase, files: stagedFiles(repo), message }), phase, cfg);
  return print('commit lock (tests/contracts/kit)', phase, findings);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

function cmdCi() {
  const repo = repoRoot();
  const head = arg('--head') || 'HEAD';
  let base = arg('--base');
  if (base && (/^0+$/.test(base) || !gitMaybe(['cat-file', '-e', `${base}^{commit}`], { cwd: repo }))) base = null;
  const range = base ? `${base}..${head}` : head;
  const commits = git(['rev-list', '--no-merges', '--reverse', range], { cwd: repo }).split('\n').filter(Boolean);
  let errors = 0;
  // 1. Re-run the commit lock on every commit in the push, judged by the phase in force before it.
  for (const c of commits) {
    const parent = gitMaybe(['rev-parse', '--verify', `${c}^`], { cwd: repo })?.trim();
    const phase = parent ? strictest(phaseAt(parent, repo)) : 'explore';
    const files = git(['diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', '--root', c], { cwd: repo }).split('\n').filter(Boolean);
    const message = git(['log', '-1', '--format=%B', c], { cwd: repo });
    const cfg = parent ? loadConfigAt(parent, repo) : loadConfigAt(c, repo);
    const f = classify(checkLock({ cfg, phase, files, message }), phase, cfg);
    if (f.length) errors += print(`commit ${c.slice(0, 8)} lock`, phase, f);
    // A commit that moves the phase forward must pass the gate on the tree AS OF that commit.
    const next = phaseAt(c, repo);
    if (parent && next && next !== phase && PHASES.indexOf(next) > PHASES.indexOf(phase)) {
      const snap = snapshotCommit(repo, c);
      try {
        const t = transitionFindings(ctxFor(snap, repo, next), phase, next);
        if (t.length) errors += print(`commit ${c.slice(0, 8)} phase ${phase} -> ${next}`, next, t);
      } finally {
        fs.rmSync(snap, { recursive: true, force: true });
      }
    }
  }
  // 2. Full checks on the final tree, at the strictest phase seen at base or head.
  const phase = strictest(base ? phaseAt(base, repo) : null, phaseAt(head, repo), phaseInDir(repo));
  const ctx = ctxFor(repo, repo, phase);
  const cfg = ctx.cfg;
  let findings = treeChecks(ctx, phase).concat(slowChecks(ctx, phase));
  if (phase === 'build' && cfg.ciRunRealTests) findings = findings.concat(runRealTests(ctx));
  errors += print(`CI checks on ${head} (${commits.length} commit(s))`, phase, classify(findings, phase, cfg));
  return errors;
}

function cmdCheck() {
  const repo = repoRoot();
  const phase = arg('--phase') || strictest(headExists(repo) ? phaseAt('HEAD', repo) : null, phaseInDir(repo));
  const ctx = ctxFor(repo, repo, phase);
  const findings = treeChecks(ctx, phase).concat(slowChecks(ctx, phase));
  return print('working-folder checks', phase, classify(findings, phase, ctx.cfg));
}

function cmdReport() {
  const repo = repoRoot();
  const ctx = ctxFor(repo, repo, phaseInDir(repo) ?? 'explore');
  if (!ctx.manifest) {
    console.log(`[seam] ${ctx.manifestError}`);
    return 0;
  }
  const n = ctx.manifest.seams?.length ?? 0;
  console.log(`\nPhase: ${ctx.phase}    Seams: ${n} (aim for 8-15; warning above ${ctx.cfg.maxSeams})\n`);
  console.log(statusTable(ctx.manifest));
  const rows = unflippedSeams(ctx);
  console.log('\nUnflipped seams (green on mocks, not yet proven against the real thing):');
  if (!rows.length) console.log('  none');
  for (const r of rows) console.log(`  - ${r.seam}: mock-green since ${r.mockGreen} (${r.days ?? '?'} day(s), ${r.commits ?? '?'} commit(s) ago)`);
  const unbuilt = unbuiltFiles(ctx);
  console.log('\nUnbuilt files (still a skeleton: contain the SKELETON throw):');
  if (!unbuilt.length) console.log('  none');
  for (const r of unbuilt) console.log(`  - ${r.file} (seam ${r.seam ?? '?'})${r.green ? '  <- seam is marked green but this file is not built!' : ''}`);
  for (const f of [...checkSeamCount(ctx), ...checkOverSeaming(ctx)]) console.log(`  warn [${f.check}] ${f.msg}`);
  return 0;
}

function cmdPhase() {
  const repo = repoRoot();
  const target = process.argv[3];
  const current = phaseInDir(repo) ?? 'explore';
  if (!target) {
    console.log(current);
    return 0;
  }
  if (!PHASES.includes(target)) {
    console.error(`Unknown phase "${target}". Use one of: ${PHASES.join(', ')}`);
    return 1;
  }
  const forward = PHASES.indexOf(target) > PHASES.indexOf(current);
  if (forward && !STEP_BEFORE[target].includes(current)) {
    console.error(`[seam] You can't jump from ${current} straight to ${target}. Phases go explore -> blueprint -> skeleton -> build: ${PHASE_HOW[target]}.`);
    return 1;
  }
  if (target === 'skeleton' && forward) {
    // Skeletons are written FROM the plan, so the plan must exist and be reviewed.
    const ctx = ctxFor(repo, repo, 'skeleton');
    const problems = [];
    if (!ctx.manifest) problems.push(ctx.manifestError);
    else if (!(ctx.manifest.seams ?? []).length) problems.push('the manifest has no seams yet');
    for (const s of ctx.manifest?.seams ?? []) {
      if (!s.status?.blueprint) problems.push(`seam "${s.name}": blueprint not reviewed yet (set status.blueprint to true once the human has read it)`);
      if (!(s.files ?? []).length && !s.contract && !s.mock) problems.push(`seam "${s.name}": lists no files`);
    }
    if (problems.length) {
      console.error('[seam] Not ready for the skeleton phase. Finish and review the blueprint first:');
      for (const p of problems) console.error(`  - ${p}`);
      return 1;
    }
  }
  if (target === 'build' && forward) {
    // Hooks only go to full strength once the plan is actually locked, and every planned file exists as a skeleton.
    const ctx = ctxFor(repo, repo, 'build');
    const problems = [];
    if (!ctx.manifest) problems.push(ctx.manifestError);
    for (const f of skeletonGate(ctxFor(repo, repo, 'skeleton'))) problems.push(`${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.msg.replace('[leaving skeleton] ', '')}`);
    for (const s of ctx.manifest?.seams ?? []) {
      const st = s.status ?? {};
      if (!st.blueprint) problems.push(`seam "${s.name}": blueprint not marked done`);
      if (!st.contract) problems.push(`seam "${s.name}": contract not marked done`);
      if (!st.tests) problems.push(`seam "${s.name}": failing tests not written yet`);
      if (s.contract && !fs.existsSync(path.join(repo, s.contract))) problems.push(`seam "${s.name}": contract file ${s.contract} does not exist`);
      for (const t of s.tests ?? []) if (!fs.existsSync(path.join(repo, t))) problems.push(`seam "${s.name}": test file ${t} does not exist`);
      if (s.mock) for (const fx of s.fixtures ?? []) if (!fs.existsSync(path.join(repo, fx))) problems.push(`seam "${s.name}": probe fixture ${fx} missing (run the probes first)`);
    }
    if (problems.length) {
      console.error('[seam] Not ready for build phase. Finish the plan and the skeleton first:');
      for (const p of problems) console.error(`  - ${p}`);
      return 1;
    }
  }
  if (current === 'build' && target !== 'build') {
    console.log('[seam] Leaving build phase turns guard rails off. Commit with [phase-change] and a DRIFT-LOG entry saying why.');
  }
  fs.mkdirSync(path.join(repo, '.seam'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.seam', 'phase'), `${target}\n`);
  console.log(`[seam] phase: ${current} -> ${target}. Commit .seam/phase to make it official.`);
  return 0;
}

function cmdTest() {
  const mode = process.argv[3] === 'real' ? 'real' : 'mock';
  const cfg = loadConfig(repoRoot());
  const [cmd, ...args] = cfg.testCmd.trim().split(/\s+/);
  const r = spawnSync(cmd, [...args, ...process.argv.slice(4)], { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SEAM_MODE: mode } });
  return r.status ?? 1;
}

function cmdUnlock() {
  const repo = repoRoot();
  const minutes = Number(process.argv[3] ?? 30);
  const gitDir = path.resolve(repo, git(['rev-parse', '--git-dir'], { cwd: repo }).trim());
  const until = Date.now() + minutes * 60_000;
  fs.writeFileSync(path.join(gitDir, 'seam-unlock'), String(until));
  console.log(`[seam] AI agents may edit locked files for ${minutes} minute(s). Commits still need [contract-change] + blueprint + drift log.`);
  return 0;
}

const commands = { 'pre-commit': cmdPreCommit, 'commit-msg': () => cmdCommitMsg(process.argv[3]), ci: cmdCi, check: cmdCheck, report: cmdReport, phase: cmdPhase, test: cmdTest, unlock: cmdUnlock };
const name = process.argv[2];
if (!commands[name]) {
  console.error(`usage: node scripts/seam/run.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
process.exit(commands[name]() ? 1 : 0);
