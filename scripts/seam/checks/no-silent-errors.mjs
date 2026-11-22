// no-silent-errors: fail loudly. Blocks swallowed errors, fake fallbacks, and type-checker escape hatches.
// Uses the TypeScript parser when the repo has `typescript` installed (accurate), else a regex fallback.
import { createRequire } from 'node:module';
import path from 'node:path';
import { finding, isCode, listFiles, readText, underAny } from '../lib.mjs';

const ID = 'no-silent-errors';
const DIRECTIVES = [
  [/@ts-ignore\b/, '@ts-ignore hides a type error instead of fixing it'],
  [/@ts-nocheck\b/, '@ts-nocheck turns off type checking for the whole file'],
  [/@ts-expect-error\b/, '@ts-expect-error hides a type error instead of fixing it'],
  [/eslint-disable/, 'eslint-disable switches off the lint rules'],
];

function loadTs(dir) {
  try {
    return createRequire(path.join(dir, 'package.json'))('typescript');
  } catch {
    return null;
  }
}

function isFallbackExpr(ts, e) {
  if (!e) return true; // bare `return;`
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression;
  if (e.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isIdentifier(e) && e.text === 'undefined') return true;
  if (ts.isVoidExpression(e)) return true;
  if (ts.isArrayLiteralExpression(e) && e.elements.length === 0) return true;
  if (ts.isObjectLiteralExpression(e) && e.properties.length === 0) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (ts.isStringLiteral(e) && e.text === '') return true;
  return false;
}

function isConsoleCallExpr(ts, e) {
  if (!e || !ts.isCallExpression(e)) return false;
  const c = e.expression;
  return ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'console';
}

function isConsoleCall(ts, st) {
  return ts.isExpressionStatement(st) && isConsoleCallExpr(ts, st.expression);
}

/** A block "swallows" if it has no statements, or only logs and/or returns a fallback value. */
function blockSwallows(ts, block) {
  const sts = block.statements;
  if (sts.length === 0) return 'is empty';
  const allSoft = sts.every((s) => isConsoleCall(ts, s) || (ts.isReturnStatement(s) && isFallbackExpr(ts, s.expression)));
  if (allSoft) return 'only logs and/or returns an empty fallback value (null, undefined, [], {}, false, "")';
  return null;
}

function scanAst(ts, file, text) {
  const out = [];
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : file.match(/\.(m|c)?js$/) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node) => {
    if (ts.isCatchClause(node)) {
      const why = blockSwallows(ts, node.block);
      if (why) out.push(finding(ID, `catch block ${why}. Let the error surface (rethrow, or throw a clearer error).`, file, lineOf(node)));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'catch') {
      const h = node.arguments[0];
      if (h && (ts.isArrowFunction(h) || ts.isFunctionExpression(h))) {
        let why = null;
        if (ts.isBlock(h.body)) why = blockSwallows(ts, h.body);
        else if (isFallbackExpr(ts, h.body)) why = 'returns an empty fallback value';
        else if (isConsoleCallExpr(ts, h.body)) why = 'only logs';
        if (why) out.push(finding(ID, `.catch() handler ${why}. That hides failures.`, file, lineOf(node)));
      }
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      out.push(finding(ID, 'explicit `any` type. Use the real type from contracts/ or `unknown` and validate it.', file, lineOf(node)));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
}

function scanRegex(file, text) {
  const out = [];
  const code = stripComments(text);
  const lineAt = (i) => code.slice(0, i).split('\n').length;
  const rules = [
    [/catch\s*(\([^)]*\))?\s*\{\s*\}/g, 'empty catch block'],
    [/catch\s*(\([^)]*\))?\s*\{\s*return\s*(null|undefined|\[\]|\{\}|false)?\s*;?\s*\}/g, 'catch block that only returns an empty fallback'],
    [/\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>\s*(null|undefined|\[\]|\(\{\}\)|\{\s*\})\s*\)/g, '.catch() handler that swallows the error'],
    [/(:\s*any\b|\bas\s+any\b|<any>|\bany\[\])/g, 'explicit `any` type'],
  ];
  for (const [re, msg] of rules) for (const m of code.matchAll(re)) out.push(finding(ID, msg, file, lineAt(m.index)));
  return out;
}

export function checkNoSilentErrors(ctx) {
  const { dir, cfg } = ctx;
  const ts = loadTs(dir);
  const out = [];
  if (!ts) out.push({ ...finding(ID, 'typescript is not installed, so a less accurate regex scan was used. Run npm install.'), level: 'warn' });
  for (const file of listFiles(dir, cfg)) {
    if (!underAny(file, cfg.codeDirs) || !isCode(file, cfg)) continue;
    const text = readText(dir, file);
    text.split('\n').forEach((ln, i) => {
      for (const [re, msg] of DIRECTIVES) if (re.test(ln)) out.push(finding(ID, msg, file, i + 1));
    });
    const parseable = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
    if (ts && parseable) out.push(...scanAst(ts, file, text));
    else out.push(...scanRegex(file, text));
  }
  return out;
}
