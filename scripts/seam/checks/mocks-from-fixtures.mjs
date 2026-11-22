// mocks-from-fixtures: every mock is built from saved probe responses and checked against the contract.
import { finding, isCode, listFiles, readText, underAny } from '../lib.mjs';

export function checkMocks(ctx) {
  const { dir, cfg } = ctx;
  const out = [];
  const fx = cfg.fixturesDir.replace(/\/$/, '');
  const ct = cfg.contractsDir.replace(/\/$/, '');
  for (const file of listFiles(dir, cfg)) {
    if (!underAny(file, [cfg.mocksDir]) || !isCode(file, cfg)) continue;
    const text = readText(dir, file);
    const imports = [...text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (!imports.some((p) => p.includes(`${fx}/`) || p.includes(fx))) out.push(finding('mocks-from-fixtures', `mock does not import anything from ${fx}/. Mocks must be built from saved probe responses, never from guesses.`, file));
    if (!imports.some((p) => p.includes(`${ct}/`) || new RegExp(`(^|/)${ct}$`).test(p))) out.push(finding('mocks-from-fixtures', `mock does not import its shape from ${ct}/. Validate fixture data with the contract so the mock cannot drift.`, file));
    text.split('\n').forEach((ln, i) => {
      if (/\bfetch\s*\(|\baxios\b|\bhttps?\.request\b/.test(ln) && !/\bfetch\s*:/.test(ln)) {
        out.push(finding('mocks-from-fixtures', 'mock makes or wires a real network call. Mocks must never touch the network.', file, i + 1));
      }
    });
  }
  return out;
}
