// seam-count + over-seaming + unflipped: keeps the seam map sane and nags about mocks that never went real.
import fs from 'node:fs';
import path from 'node:path';
import { finding, gitMaybe, readText } from '../lib.mjs';

const DAY = 24 * 60 * 60 * 1000;

export function checkSeamCount(ctx) {
  const { cfg, manifest } = ctx;
  const out = [];
  const seams = manifest?.seams ?? [];
  if (seams.length > cfg.maxSeams) {
    out.push(finding('seam-count', `${seams.length} seams (aim for 8-15, warning above ${cfg.maxSeams}). You are probably cutting one seam per button. Merge seams that always change together.`));
  }
  if (seams.length > 0 && seams.length < cfg.minSeamsHint) {
    out.push(finding('seam-count', `only ${seams.length} seam(s). Fine for a tiny app or a demo; a real app usually has 8-15.`));
  }
  return out;
}

export function checkOverSeaming(ctx) {
  const { dir, manifest } = ctx;
  const out = [];
  for (const s of manifest?.seams ?? []) {
    const files = (s.files ?? []).filter((f) => fs.existsSync(path.join(dir, f)));
    if (files.length === 1 && !s.mock && !s.contract) {
      const n = readText(dir, files[0]).split('\n').length;
      if (n < 25 && !['config'].includes(s.name)) out.push(finding('over-seaming', `seam "${s.name}" is a single ${n}-line file with no contract. Consider folding it into the seam that uses it.`));
    }
  }
  return out;
}

/** Seams that went green on mocks but have not been flipped to real yet, with age in days and commits. */
export function unflippedSeams(ctx) {
  const { manifest, repo } = ctx;
  const now = ctx.now ?? Date.now();
  const rows = [];
  for (const s of manifest?.seams ?? []) {
    const st = s.status ?? {};
    if (!s.mock || !st.mockGreen || st.realGreen) continue;
    const since = Date.parse(st.mockGreen);
    if (Number.isNaN(since)) {
      rows.push({ seam: s.name, mockGreen: st.mockGreen, days: null, commits: null, bad: true });
      continue;
    }
    const days = Math.floor((now - since) / DAY);
    const c = repo ? gitMaybe(['rev-list', '--count', `--since=${st.mockGreen}`, 'HEAD'], { cwd: repo }) : null;
    rows.push({ seam: s.name, mockGreen: st.mockGreen, days, commits: c == null ? null : Number(c.trim()) });
  }
  return rows;
}

export function checkUnflipped(ctx) {
  const { cfg } = ctx;
  return unflippedSeams(ctx).map((r) => {
    if (r.bad) return finding('unflipped', `seam "${r.seam}" has mockGreen "${r.mockGreen}", which is not a date (use YYYY-MM-DD)`);
    const old = r.days >= cfg.unflippedWarnDays || (r.commits ?? 0) >= cfg.unflippedWarnCommits;
    const age = `${r.days} day(s), ${r.commits ?? '?'} commit(s)`;
    return finding('unflipped', old
      ? `seam "${r.seam}" has been green on mocks for ${age} and is still not flipped to real. Flip it now, before more is built on top of it.`
      : `seam "${r.seam}" is green on mocks (${age}) but not flipped to real yet.`);
  });
}

export function statusTable(manifest) {
  const seams = manifest?.seams ?? [];
  const order = manifest?.buildOrder ?? seams.map((s) => s.name);
  const cell = (v) => (v ? (typeof v === 'string' ? v : 'yes') : '-');
  const lines = ['seam | blueprint | contract | tests | mock-green | real-green', '--- | --- | --- | --- | --- | ---'];
  for (const name of order) {
    const s = seams.find((x) => x.name === name);
    if (!s) continue;
    const st = s.status ?? {};
    const real = s.mock ? cell(st.realGreen) : 'n/a (no mock)';
    lines.push(`${s.name} | ${cell(st.blueprint)} | ${cell(st.contract)} | ${cell(st.tests)} | ${cell(st.mockGreen)} | ${real}`);
  }
  return lines.join('\n');
}
