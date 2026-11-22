// lock-tests: in build phase, tests/, contracts/, fixtures, and the kit itself are locked.
// Changing them needs a tag in the commit message plus a matching blueprint + drift-log update in the SAME commit.
import { finding, matchesPathList } from '../lib.mjs';

export function checkLock({ cfg, phase, files, message }) {
  if (phase !== 'build') return [];
  const out = [];
  const msg = message ?? '';
  const touched = (list) => files.filter((f) => matchesPathList(f, list));
  const hasDrift = files.includes(cfg.driftLog);
  const hasBlueprint = files.some((f) => cfg.blueprintFiles.includes(f));

  const locked = touched(cfg.lockedPaths);
  if (locked.length) {
    const problems = [];
    if (!/\[contract-change\]/i.test(msg)) problems.push('the commit message does not contain [contract-change]');
    if (!hasBlueprint) problems.push(`${cfg.blueprintFiles.join(' or ')} was not updated in this commit`);
    if (!hasDrift) problems.push(`${cfg.driftLog} was not updated in this commit`);
    if (problems.length) {
      out.push(finding('lock-tests', `tests/contracts/fixtures are locked in build phase. You changed: ${locked.join(', ')}. Blocked because ${problems.join('; ')}. If the plan is wrong: update the blueprint and contract first, log it in the drift log, then commit with [contract-change].`));
    }
  }

  const kit = touched(cfg.kitPaths);
  const phaseFile = kit.filter((f) => f === '.seam/phase');
  const otherKit = kit.filter((f) => f !== '.seam/phase');
  if (phaseFile.length && !(/\[phase-change\]/i.test(msg) && hasDrift)) {
    out.push(finding('lock-tests', `.seam/phase changed while in build phase. Leaving build turns the guard rails off, so it needs [phase-change] in the message and a ${cfg.driftLog} entry saying why.`));
  }
  if (otherKit.length && !(/\[kit-change\]/i.test(msg) && hasDrift)) {
    out.push(finding('lock-tests', `kit files are locked in build phase (${otherKit.join(', ')}). Changing hooks, checks, or test settings needs [kit-change] in the message and a ${cfg.driftLog} entry.`));
  }
  return out;
}
