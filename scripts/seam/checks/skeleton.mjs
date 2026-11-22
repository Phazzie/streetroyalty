// skeleton + pseudocode: the plan for every file lives at the top of that file, and in the skeleton phase
// the file is ONLY the plan (header, pseudocode, imports, types, and functions that throw the SKELETON error).
//   pseudocode    every code file in headerDirs has a "Pseudocode:" section with >= minPseudocodeSteps real steps
//   skeleton      (skeleton phase) no real code yet: every function body is exactly the SKELETON throw
//   skeleton-left (build phase) lists files that still contain the SKELETON throw, so unbuilt files stay visible
// Uses the repo's TypeScript parser when installed (accurate); otherwise a rough keyword scan (see METHODOLOGY.md).
import path from 'node:path';
import { SKELETON_THROW, finding, isCode, listFiles, loadTs, manifestFiles, readText, underAny } from '../lib.mjs';
import { leadingComment, parseHeader } from './blueprint-header.mjs';

const STEP = /^\s*(\d+)[.)]\s+(.*)$/;
const KEY = /^\s*(Purpose|Inputs|Outputs|Seams|Errors|Notes?|Pseudocode)\s*:/i;
const MARK = /throw\s+new\s+Error\(\s*['"`]SKELETON:/;
const COMPONENT = ['.vue', '.svelte'];
const FILLER = /^(step\s*\w+|(do|handle|add|write|implement|build|code)( the| some)? (stuff|things?|it|this|logic|code|work|rest)( here| later)?|(the )?(logic|code|stuff) (goes )?here|same as (above|before)|and so on|etc|fill (this )?in( later)?|to be (decided|done|written)|not sure( yet)?|n\/?a|tbd)$/i;

/** Numbered steps from the header's "Pseudocode:" section, or null if there is no such section. */
export function parsePseudocode(text) {
  const c = leadingComment(text);
  if (c == null) return null;
  const lines = c.split('\n').map((l) => l.replace(/^\s*\*?\s?/, ''));
  const start = lines.findIndex((l) => /^\s*Pseudocode\s*:/i.test(l));
  if (start === -1) return null;
  const steps = [];
  const rest = lines[start].replace(/^\s*Pseudocode\s*:\s*/i, '');
  const body = [rest, ...lines.slice(start + 1)];
  for (let i = 0; i < body.length; i++) {
    const ln = body[i];
    if (i > 0 && KEY.test(ln)) break;
    const m = ln.match(STEP);
    if (m) steps.push({ n: Number(m[1]), text: m[2].trim() });
    else if (ln.trim() && steps.length) steps[steps.length - 1].text += ` ${ln.trim()}`;
  }
  return steps;
}

export function isPlaceholderStep(t) {
  const s = t.trim();
  if (/\b(TODO|TBD|FIXME|XXX|lorem|ipsum|placeholder|dolor sit)\b/i.test(s)) return true;
  if (/\.\.\.|…/.test(s)) return true;
  if (FILLER.test(s.replace(/[.!?]+$/, ''))) return true;
  return s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length < 3;
}

/** Plain-English problems with a file's pseudocode (empty list = fine). */
export function pseudocodeProblems(text, cfg) {
  const min = cfg.minPseudocodeSteps ?? 3;
  const steps = parsePseudocode(text);
  if (steps == null) return [`has no "Pseudocode:" section in its header. Add at least ${min} numbered plain-English steps (1., 2., 3.) saying what the file does, copied from its blueprint entry. See templates/FILE-HEADER.md.`];
  const out = [];
  if (steps.length < min) out.push(`has ${steps.length} pseudocode step(s); at least ${min} numbered steps are required (1., 2., 3.). Write out what the file does, step by step.`);
  if (steps.some((s, i) => s.n !== i + 1)) out.push(`pseudocode steps must be numbered 1., 2., 3. in order (found ${steps.map((s) => s.n).join(', ')}).`);
  const seen = new Set();
  for (const s of steps) {
    if (isPlaceholderStep(s.text)) out.push(`pseudocode step ${s.n} ("${s.text.slice(0, 60)}") is a placeholder. Write what the code really does, in at least a short plain-English sentence (no TODO, TBD, or "...").`);
    else if (seen.has(s.text.toLowerCase())) out.push(`pseudocode step ${s.n} repeats an earlier step word for word. Each step must say something new.`);
    seen.add(s.text.toLowerCase());
  }
  return out;
}

// ---------- does a file contain real code? ----------

function kindFor(ts, file) {
  const ext = path.extname(file);
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (['.js', '.mjs', '.cjs'].includes(ext)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function analyzeTs(ts, text, file) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kindFor(ts, file));
  const probs = [];
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const bad = (n, msg) => probs.push({ line: lineOf(n), msg });
  const isSkelThrow = (st) => {
    if (!st || !ts.isThrowStatement(st) || !st.expression || !ts.isNewExpression(st.expression)) return false;
    const e = st.expression;
    const a = e.arguments?.[0];
    return ts.isIdentifier(e.expression) && e.expression.text === 'Error' && a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && /^SKELETON:/.test(a.text);
  };
  const isSuper = (st) => st && ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) && st.expression.expression.kind === ts.SyntaxKind.SuperKeyword;
  const fnOk = (node, label, allowSuper = false) => {
    const b = node.body;
    if (!b) return; // overload or abstract signature
    if (!ts.isBlock(b)) return bad(node, `${label} is written as a one-line arrow with real code. Give it a body that is only ${SKELETON_THROW}`);
    const sts = [...b.statements];
    if (allowSuper && isSuper(sts[0])) sts.shift();
    if (sts.length !== 1 || !isSkelThrow(sts[0])) bad(node, `${label} has real code in its body. In the skeleton phase every body must be exactly ${SKELETON_THROW}`);
  };
  const nameOf = (n) => (n.name && ts.isIdentifier(n.name) ? n.name.text : 'default');
  const isFn = (e) => e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));
  const hasDeclare = (n) => (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
  const VALUE = 'In the skeleton phase only imports, types, and function signatures that throw the SKELETON error are allowed. Describe data with a type, put schemas in contracts/, and put values inside a function.';
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isImportEqualsDeclaration(st) || ts.isExportDeclaration(st)) continue;
    if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isEnumDeclaration(st) || ts.isEmptyStatement(st)) continue;
    if (ts.isModuleDeclaration(st)) {
      if (!hasDeclare(st)) bad(st, `namespace "${st.name.getText(sf)}" holds code. ${VALUE}`);
      continue;
    }
    if (ts.isFunctionDeclaration(st)) {
      fnOk(st, `function "${nameOf(st)}"`);
      continue;
    }
    if (ts.isClassDeclaration(st)) {
      const cls = nameOf(st);
      for (const m of st.members) {
        if (ts.isConstructorDeclaration(m)) fnOk(m, `the constructor of class "${cls}"`, true);
        else if (ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) fnOk(m, `method "${m.name.getText(sf)}" of class "${cls}"`);
        else if (ts.isPropertyDeclaration(m) && m.initializer) {
          if (isFn(m.initializer)) fnOk(m.initializer, `method "${m.name.getText(sf)}" of class "${cls}"`);
          else bad(m, `class "${cls}" property "${m.name.getText(sf)}" is given a starting value. ${VALUE}`);
        } else if (ts.isClassStaticBlockDeclaration(m)) bad(m, `class "${cls}" has a static block that runs code. ${VALUE}`);
      }
      continue;
    }
    if (ts.isVariableStatement(st)) {
      if (hasDeclare(st)) continue;
      for (const d of st.declarationList.declarations) {
        const name = d.name.getText(sf);
        if (isFn(d.initializer)) fnOk(d.initializer, `function "${name}"`);
        else bad(d, `"${name}" is set to a real value. ${VALUE}`);
      }
      continue;
    }
    if (ts.isExportAssignment(st)) {
      if (ts.isIdentifier(st.expression)) continue;
      if (isFn(st.expression)) fnOk(st.expression, 'the default export');
      else bad(st, `the default export is a real value. ${VALUE}`);
      continue;
    }
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) continue; // 'use client' / 'use strict'
    bad(st, `this line runs real code when the file loads ("${st.getText(sf).split('\n')[0].slice(0, 50)}"). ${VALUE}`);
  }
  return probs;
}

/** Rough fallback when TypeScript isn't installed: strip comments/strings and look for statements real code needs. */
function analyzeRough(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  const probs = [];
  stripped.split('\n').forEach((ln, i) => {
    const m = ln.match(/\b(return|await|if|else|for|while|switch|try|catch|yield|console)\b|^\s*(export\s+)?(const|let|var)\s/);
    if (m) probs.push({ line: i + 1, msg: `"${(m[1] ?? m[3]).trim()}" looks like real code (rough check: TypeScript isn't installed, run npm install for an exact check). In the skeleton phase every function body must be exactly ${SKELETON_THROW}` });
  });
  return probs;
}

/** Real-code problems in a skeleton file: [{ line, msg }]. Empty list = it's a proper skeleton. */
export function skeletonProblems(text, file, ts) {
  if (COMPONENT.includes(path.extname(file))) {
    // Component files mix markup and script, so we only ask for the marker (see "Known limits").
    return MARK.test(text) ? [] : [{ line: 1, msg: `component skeletons must contain ${SKELETON_THROW} in their <script> part so they can't be mistaken for built screens.` }];
  }
  return ts ? analyzeTs(ts, text, file) : analyzeRough(text);
}

export const hasSkeletonThrow = (text) => MARK.test(text);

function headerFiles(dir, cfg) {
  return listFiles(dir, cfg).filter((f) => underAny(f, cfg.headerDirs) && isCode(f, cfg));
}

export function checkPseudocode(ctx) {
  const { dir, cfg } = ctx;
  const out = [];
  for (const file of headerFiles(dir, cfg)) {
    const text = readText(dir, file);
    if (!parseHeader(text)) continue; // blueprint-header already reports a missing header
    for (const p of pseudocodeProblems(text, cfg)) out.push(finding('pseudocode', p, file, 1));
  }
  return out;
}

/** Should this file be a pure skeleton right now? Contracts and mocks are real code by design, and files of seams
 *  already marked green were built in an earlier pass (their tests must really pass to enter build). */
export function mustBeSkeleton(file, cfg, manifest) {
  if (underAny(file, cfg.skeletonExemptDirs ?? [])) return false;
  const seamName = manifestFiles(manifest).get(file)?.seam;
  const st = (manifest?.seams ?? []).find((s) => s.name === seamName)?.status ?? {};
  return !(st.mockGreen || st.realGreen);
}

export function checkSkeleton(ctx) {
  const { dir, cfg, manifest } = ctx;
  const ts = loadTs(dir);
  const out = [];
  for (const file of headerFiles(dir, cfg)) {
    if (!mustBeSkeleton(file, cfg, manifest)) continue;
    for (const p of skeletonProblems(readText(dir, file), file, ts)) out.push(finding('skeleton', p.msg, file, p.line));
  }
  return out;
}

/** Files that still contain the SKELETON throw. In build phase: a warning, or a block if the seam claims green. */
export function unbuiltFiles(ctx) {
  const { dir, cfg, manifest } = ctx;
  const owners = manifestFiles(manifest);
  const rows = [];
  for (const file of headerFiles(dir, cfg)) {
    if (!hasSkeletonThrow(readText(dir, file))) continue;
    const seamName = owners.get(file)?.seam ?? null;
    const seam = (manifest?.seams ?? []).find((s) => s.name === seamName);
    rows.push({ file, seam: seamName, green: Boolean(seam?.status?.mockGreen || seam?.status?.realGreen) });
  }
  return rows;
}

export function checkSkeletonLeft(ctx) {
  return unbuiltFiles(ctx).map((r) => (r.green
    ? { ...finding('skeleton-left', `still contains the SKELETON throw, but seam "${r.seam}" is marked green. Build this file (follow its pseudocode) or un-mark the seam.`, r.file), level: 'error' }
    : finding('skeleton-left', 'not built yet (still contains the SKELETON throw). Build it from its pseudocode with the seam-builder skill.', r.file)));
}
