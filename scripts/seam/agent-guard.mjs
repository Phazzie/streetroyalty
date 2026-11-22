#!/usr/bin/env node
// Agent hook: stops AI agents (Claude Code, Cursor) from editing locked files in build phase, from bypassing git
// hooks, and (skeleton + build phases) from writing code files that aren't in the plan, have no header + pseudocode,
// or (skeleton phase) already contain real code. The git hooks + CI are the real wall; this stops the agent earlier.
//   node scripts/seam/agent-guard.mjs claude          (Claude Code PreToolUse: exit 2 = block, reason on stderr)
//   node scripts/seam/agent-guard.mjs cursor-tool     (Cursor preToolUse: prints {"permission": ...})
//   node scripts/seam/agent-guard.mjs cursor-shell    (Cursor beforeShellExecution: prints {"permission": ...})
import fs from 'node:fs';
import path from 'node:path';
import { parseHeader } from './checks/blueprint-header.mjs';
import { mustBeSkeleton, pseudocodeProblems, skeletonProblems } from './checks/skeleton.mjs';
import { SKELETON_THROW, gitMaybe, isCode, loadConfig, loadConfigAt, loadManifest, loadTs, manifestFiles, matchesPathList, phaseAt, phaseInDir, repoRoot, strictest, toPosix, underAny } from './lib.mjs';

const flavor = process.argv[2] ?? 'claude';

const BYPASS = [
  [/--no-verify\b/, 'skipping git hooks with --no-verify'],
  [/\bgit\s+(?:-c\s+\S+\s+)*commit\b[^|;&]*\s-[a-zA-Z]*n[a-zA-Z]*\b/, 'skipping git hooks with git commit -n'],
  [/core\.hooksPath/, 'changing core.hooksPath (turns the git hooks off)'],
  [/\bHUSKY=0\b/, 'turning husky off'],
  [/seam[:/ -]+unlock|run\.mjs\s+unlock/, 'unlocking tests/contracts (only the human may run seam:unlock)'],
  [/\.git\/(hooks|seam-unlock)/, 'touching git hook internals'],
];
const WRITEY = /(^|[\s;&|(])(rm|mv|cp|tee|truncate|touch|chmod|ln|dd|install|patch|unlink)\s|>>?|\bsed\s+(-\w*\s+)*-i|\bperl\s+-\w*i|\bgit\s+(checkout|restore|rm|mv|apply|stash|reset)\b|\bnode\s+-e\b|\bpython3?\s+-c\b|writeFile|\bnpx\s+prettier\b.*--write/;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function currentPhase(repo) {
  const head = gitMaybe(['rev-parse', '--verify', 'HEAD'], { cwd: repo }) ? phaseAt('HEAD', repo) : null;
  return strictest(head, phaseInDir(repo));
}

function unlocked(repo) {
  const out = gitMaybe(['rev-parse', '--git-dir'], { cwd: repo });
  if (!out) return false;
  const gitDir = path.resolve(repo, out.trim());
  const f = path.join(gitDir, 'seam-unlock');
  return fs.existsSync(f) && Number(fs.readFileSync(f, 'utf8')) > Date.now();
}

function pathsIn(input) {
  const keys = ['file_path', 'path', 'filePath', 'target_file', 'targetFile', 'notebook_path', 'file', 'target'];
  const out = [];
  for (const k of keys) if (typeof input?.[k] === 'string') out.push(input[k]);
  for (const e of input?.edits ?? []) if (typeof e?.file_path === 'string') out.push(e.file_path);
  return out;
}

function decide(event, repo, cfg) {
  const input = event.tool_input ?? event;
  const command = typeof input.command === 'string' ? input.command : typeof event.command === 'string' ? event.command : null;
  const phase = currentPhase(repo);
  const protectedList = [...cfg.lockedPaths, ...cfg.kitPaths, '.git/'];
  if (command) {
    for (const [re, why] of BYPASS) if (re.test(command)) return `Blocked: ${why}. The seam hooks are the safety net; fix the problem instead of skipping the check.`;
    if (phase === 'build' && !unlocked(repo) && WRITEY.test(command)) {
      const hit = protectedList.find((p) => command.includes(p.replace(/\/$/, '')));
      if (hit) return `Blocked: this command looks like it changes "${hit}", which is locked in build phase. Tests and contracts are the spec; do not change them to make code pass. If the plan is wrong, stop and tell the human (METHODOLOGY.md, "When the plan is wrong").`;
    }
    return null;
  }
  const paths = pathsIn(input).map((p) => toPosix(path.relative(repo, path.resolve(repo, p))));
  if (phase === 'build' && !unlocked(repo)) {
    for (const rel of paths) {
      if (matchesPathList(rel, protectedList)) {
        return `Blocked: ${rel} is locked in build phase (tests/, contracts/, probe fixtures, and the seam kit itself). Make the code pass the existing tests instead. If you believe the test or contract is wrong, STOP and explain to the human; they must update the blueprint and contract first and log it in blueprint/DRIFT-LOG.md.`;
      }
    }
  }
  if (phase === 'skeleton' || phase === 'build') {
    for (const rel of paths) {
      const why = planCheck(rel, input, repo, cfg, phase);
      if (why) return why;
    }
  }
  return null;
}

const CONTENT_KEYS = ['content', 'contents', 'file_text', 'text', 'new_content', 'newContent', 'code'];

/** The file as it would look after this tool call, or null if we can't tell (then the commit hook checks it). */
function resultingContent(input, abs) {
  for (const k of CONTENT_KEYS) if (typeof input?.[k] === 'string') return input[k];
  let edits = null;
  if (typeof input?.old_string === 'string' && typeof input?.new_string === 'string') edits = [input];
  else if (Array.isArray(input?.edits) && input.edits.length && input.edits.every((e) => typeof e?.old_string === 'string' && typeof e?.new_string === 'string')) edits = input.edits;
  if (!edits) return null;
  if (!fs.existsSync(abs)) return edits.length === 1 && edits[0].old_string === '' ? edits[0].new_string : null;
  let t = fs.readFileSync(abs, 'utf8');
  for (const e of edits) {
    if (e.old_string === '' || !t.includes(e.old_string)) return null;
    t = e.replace_all ? t.split(e.old_string).join(e.new_string) : t.replace(e.old_string, () => e.new_string);
  }
  return t;
}

/** Skeleton + build phases: code files must be planned, carry a header with pseudocode, and (skeleton) hold no real code. */
function planCheck(rel, input, repo, cfg, phase) {
  if (rel.startsWith('..') || !underAny(rel, cfg.headerDirs) || !isCode(rel, cfg)) return null;
  const { manifest } = loadManifest(repo, cfg);
  if (!manifestFiles(manifest).has(rel)) {
    const build = phase === 'build'
      ? ' We are in the build phase, so a new file is a plan change: STOP and tell the human. They update the blueprint, log it in blueprint/DRIFT-LOG.md, and commit with [contract-change]; then write the file.'
      : ' Then write it as a skeleton.';
    return `Blocked: ${rel} is not in the plan. Every code file must be planned before it is written: add it to blueprint/BLUEPRINT.md (purpose, inputs, outputs, pseudocode) and list it under its seam in ${cfg.manifest}.${build}`;
  }
  const text = resultingContent(input, path.join(repo, rel));
  if (text == null) return null;
  const min = cfg.minPseudocodeSteps ?? 3;
  const h = parseHeader(text);
  const missing = ['Purpose', 'Inputs', 'Outputs', 'Seams'].filter((k) => !h?.[k]);
  if (missing.length) {
    return `Blocked: ${rel} would not start with a complete header (missing: ${h ? missing.join(', ') : 'the whole header comment'}). Every code file starts with the comment block from templates/FILE-HEADER.md: Purpose, Inputs, Outputs, Seams, and Pseudocode with at least ${min} numbered plain-English steps. Copy them from this file's entry in blueprint/BLUEPRINT.md.`;
  }
  const pc = pseudocodeProblems(text, cfg);
  if (pc.length) {
    return `Blocked: ${rel} ${pc.join(' Also: ')} Never delete or hollow out the pseudocode; it is the plan for this file. If the plan is wrong, fix the steps (and log it in blueprint/DRIFT-LOG.md), don't remove them.`;
  }
  if (phase === 'skeleton' && mustBeSkeleton(rel, cfg, manifest)) {
    const probs = skeletonProblems(text, rel, loadTs(repo));
    if (probs.length) {
      const list = probs.slice(0, 3).map((p) => `line ${p.line}: ${p.msg}`).join(' / ');
      return `Blocked: we are in the skeleton phase, so ${rel} must be a skeleton only: the header with pseudocode, imports, types, and function signatures whose body is exactly ${SKELETON_THROW} Real code found: ${list}. Remove the real code (keep the plan in the Pseudocode steps); it gets written in the build phase.`;
    }
  }
  return null;
}

let event = {};
const raw = readStdin();
try {
  event = raw.trim() ? JSON.parse(raw) : {};
} catch (e) {
  console.error(`seam agent-guard: could not read hook input as JSON: ${e.message}`);
  process.exit(2);
}
const repo = repoRoot(event.cwd || (event.workspace_roots ?? [])[0] || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const hasHead = gitMaybe(['rev-parse', '--verify', 'HEAD'], { cwd: repo }) != null;
const reason = decide(event, repo, hasHead ? loadConfigAt('HEAD', repo) : loadConfig(repo));

if (flavor === 'claude') {
  if (reason) {
    console.error(reason);
    process.exit(2);
  }
  process.exit(0);
}
if (reason) {
  console.log(JSON.stringify({ permission: 'deny', user_message: reason, agent_message: reason }));
  process.exit(2);
}
// Cursor needs a valid answer. For shell commands we hand the decision back to the human ("ask") instead of
// auto-approving, so this hook never makes Cursor *less* careful than it was.
console.log(JSON.stringify({ permission: flavor === 'cursor-shell' ? 'ask' : 'allow' }));
process.exit(0);
