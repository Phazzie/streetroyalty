// blueprint-header + manifest: every code file has the header block and is listed in blueprint/manifest.json,
// and every manifest entry points at a real file. Also checks build order and seam status sanity.
import fs from 'node:fs';
import path from 'node:path';
import { finding, isCode, listFiles, manifestFiles, readText, underAny } from '../lib.mjs';

const REQUIRED_KEYS = ['Purpose', 'Inputs', 'Outputs', 'Seams'];

/** Pull the leading comment block (JS/TS block comment, HTML comment, or # lines) out of a file. */
export function leadingComment(text) {
  let t = text.replace(/^\uFEFF/, '');
  if (t.startsWith('#!')) t = t.slice(t.indexOf('\n') + 1);
  t = t.trimStart();
  if (t.startsWith('/*')) {
    const end = t.indexOf('*/');
    return end === -1 ? null : t.slice(2, end);
  }
  if (t.startsWith('<!--')) {
    const end = t.indexOf('-->');
    return end === -1 ? null : t.slice(4, end);
  }
  if (t.startsWith('//') || t.startsWith('#')) {
    const lines = [];
    for (const ln of t.split('\n')) {
      if (/^\s*(\/\/|#)/.test(ln)) lines.push(ln.replace(/^\s*(\/\/|#)/, ''));
      else break;
    }
    return lines.join('\n');
  }
  return null;
}

export function parseHeader(text) {
  const c = leadingComment(text);
  if (c == null) return null;
  const fields = {};
  for (const raw of c.split('\n')) {
    const ln = raw.replace(/^\s*\*?\s?/, '');
    const m = ln.match(/^(Purpose|Inputs|Outputs|Seams)\s*:\s*(.*)$/i);
    if (m) fields[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()] = m[2].trim();
  }
  return fields;
}

export function checkBlueprintHeader(ctx) {
  const { dir, cfg, manifest, manifestError } = ctx;
  const out = [];
  if (manifestError) {
    out.push(finding('manifest', `${manifestError}. Copy templates/manifest.json to ${cfg.manifest} and fill it in.`));
    return out;
  }
  const seams = Array.isArray(manifest.seams) ? manifest.seams : [];
  if (!Array.isArray(manifest.seams)) out.push(finding('manifest', 'manifest has no "seams" list'));
  const seamNames = new Set();
  for (const s of seams) {
    if (!s.name) out.push(finding('manifest', 'a seam in the manifest has no "name"'));
    else if (seamNames.has(s.name)) out.push(finding('manifest', `seam "${s.name}" is listed twice`));
    seamNames.add(s.name);
  }
  const listed = manifestFiles(manifest);

  // 1. Every code file in headerDirs: header present + complete, listed in manifest, header seams agree.
  for (const file of listFiles(dir, cfg)) {
    if (!underAny(file, cfg.headerDirs) || !isCode(file, cfg)) continue;
    const h = parseHeader(readText(dir, file));
    if (!h) {
      out.push(finding('blueprint-header', 'missing the header comment block at the top of the file (Purpose / Inputs / Outputs / Seams / Pseudocode). See templates/FILE-HEADER.md.', file, 1));
    } else {
      const missing = REQUIRED_KEYS.filter((k) => !h[k]);
      if (missing.length) out.push(finding('blueprint-header', `header is missing: ${missing.join(', ')}`, file, 1));
    }
    const owner = listed.get(file);
    if (!owner) {
      out.push(finding('manifest', `file is not listed in ${cfg.manifest}. Add it to its seam (or delete it). Unlisted files are how plans drift.`, file));
    } else if (h?.Seams) {
      const named = h.Seams.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
      for (const n of named) if (!seamNames.has(n)) out.push(finding('manifest', `header names seam "${n}", which is not in the manifest`, file, 1));
      if (!named.includes(owner.seam)) out.push(finding('manifest', `manifest puts this file in seam "${owner.seam}" but its header Seams line does not mention it`, file, 1));
    }
  }

  // 2. Every manifest entry points at a file that exists.
  for (const [file, { seam }] of listed) {
    if (!fs.existsSync(path.join(dir, file))) out.push(finding('manifest-missing-file', `manifest (seam "${seam}") lists this file but it does not exist yet`, file));
  }

  // 3. Build order: every seam appears once, dependencies come first, foundation seams (config/auth/state) lead.
  const order = Array.isArray(manifest.buildOrder) ? manifest.buildOrder : [];
  if (!Array.isArray(manifest.buildOrder)) out.push(finding('build-order', 'manifest has no "buildOrder" list'));
  for (const s of seams) if (!order.includes(s.name)) out.push(finding('build-order', `seam "${s.name}" is missing from buildOrder`));
  for (const n of order) if (!seamNames.has(n)) out.push(finding('build-order', `buildOrder names "${n}", which is not a seam`));
  for (const s of seams) {
    for (const d of s.dependsOn ?? []) {
      if (!seamNames.has(d)) out.push(finding('build-order', `seam "${s.name}" depends on unknown seam "${d}"`));
      else if (order.indexOf(d) > order.indexOf(s.name)) out.push(finding('build-order', `seam "${s.name}" is built before "${d}", which it depends on. Dependency-free seams go first.`));
    }
  }
  const foundation = cfg.foundationSeams.filter((n) => seamNames.has(n));
  const firstFeature = order.findIndex((n) => !cfg.foundationSeams.includes(n));
  for (const f of foundation) {
    if (firstFeature !== -1 && order.indexOf(f) > firstFeature) out.push(finding('build-order', `foundation seam "${f}" must be built before feature seams (it comes after "${order[firstFeature]}")`));
  }

  // 4. Status sanity: you can't claim green without the pieces that make green mean something.
  for (const s of seams) {
    const st = s.status ?? {};
    const exists = (f) => f && fs.existsSync(path.join(dir, f));
    if (st.mockGreen && !(s.tests ?? []).length) out.push(finding('seam-status', `seam "${s.name}" is marked mockGreen but lists no tests`));
    if (st.realGreen && !st.mockGreen) out.push(finding('seam-status', `seam "${s.name}" is marked realGreen but never went mockGreen`));
    if (st.realGreen && s.mock && !(s.realTests ?? []).some(exists)) out.push(finding('seam-status', `seam "${s.name}" is marked realGreen but has no real test file (realTests) proving it`));
    if (s.mock && !(s.fixtures ?? []).length) out.push(finding('seam-status', `seam "${s.name}" has a mock but lists no probe fixtures. Mocks must be built from saved probe responses.`));
  }
  return out;
}
