// typecheck + tests: in build phase every commit must typecheck, and every seam already marked mockGreen
// must still pass its (locked) tests in mock mode with the network blocked. Red seams can't be hidden as green.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { finding } from '../lib.mjs';

function run(cmd, args, dir, env = {}) {
  const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, ...env } });
  if (r.error) throw new Error(`could not run "${cmd} ${args.join(' ')}": ${r.error.message}`);
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function splitCmd(s) {
  const parts = s.trim().split(/\s+/);
  return [parts[0], parts.slice(1)];
}

export function checkTypecheck(ctx) {
  const { dir, cfg, manifest } = ctx;
  if (!fs.existsSync(path.join(dir, 'tsconfig.json'))) return [];
  const [cmd, args] = splitCmd(cfg.typecheckCmd);
  const { code, out } = run(cmd, args, dir);
  if (code === 0) return [];
  // Tests for seams that are not built yet are SUPPOSED to fail (they import code that doesn't exist yet).
  const pending = new Set();
  for (const s of manifest?.seams ?? []) if (!s.status?.mockGreen) for (const t of [...(s.tests ?? []), ...(s.realTests ?? [])]) pending.add(t);
  const res = [];
  const errLines = out.split('\n').filter((l) => /error TS\d+/.test(l));
  for (const l of errLines) {
    const m = l.match(/^(.+?)\((\d+),\d+\):\s*error/);
    const file = m ? m[1].replace(/\\/g, '/') : null;
    const f = finding('typecheck', l.trim(), file, m ? Number(m[2]) : null);
    res.push(file && pending.has(file) ? { ...f, level: 'warn', msg: `(not built yet, allowed) ${f.msg}` } : f);
  }
  if (!errLines.length) res.push(finding('typecheck', `typecheck failed:\n${out.slice(0, 2000)}`));
  return res;
}

export function checkTests(ctx) {
  const { dir, cfg, manifest } = ctx;
  const green = [];
  const pending = [];
  for (const s of manifest?.seams ?? []) {
    if (s.status?.mockGreen) green.push(...(s.tests ?? []));
    else if ((s.tests ?? []).length) pending.push(s.name);
  }
  const res = [];
  if (pending.length) res.push({ ...finding('tests', `not built yet (tests expected to fail, not run as a gate): ${pending.join(', ')}`), level: 'info' });
  const files = green.filter((f) => fs.existsSync(path.join(dir, f)));
  if (!files.length) return res;
  const [cmd, args] = splitCmd(cfg.testCmd);
  const { code, out } = run(cmd, [...args, ...files], dir, { SEAM_MODE: 'mock' });
  if (code !== 0) {
    const tail = out.split('\n').filter((l) => /FAIL|✗|×|Error|expected|network/i.test(l)).slice(0, 25).join('\n');
    res.push(finding('tests', `tests for green seams failed in mock mode (network blocked). A seam marked mockGreen must stay green.\n${tail || out.slice(-2000)}`));
  }
  return res;
}

export function runRealTests(ctx) {
  const { dir, cfg, manifest } = ctx;
  const files = [];
  for (const s of manifest?.seams ?? []) if (s.status?.realGreen) files.push(...(s.realTests ?? []));
  if (!files.length) return [];
  const [cmd, args] = splitCmd(cfg.testCmd);
  const { code, out } = run(cmd, [...args, ...files], dir, { SEAM_MODE: 'real' });
  return code === 0 ? [] : [finding('tests', `real (live) tests failed for seams marked realGreen:\n${out.slice(-2000)}`)];
}
