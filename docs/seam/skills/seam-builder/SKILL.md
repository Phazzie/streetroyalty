---
name: seam-builder
description: Build or regenerate exactly ONE file starting from its skeleton (header + pseudocode + signatures), its contract, and its locked tests, with the 2-strike regenerate rule. Use for every implementation step in build phase.
---

# Seam builder

> **Before you start:** this skill works inside a project that has the seam kit installed, meaning there is a `.seam/` folder at the project root. If there isn't one, stop and tell the human to run `/seam-driven:install` (Claude Code plugin) or `/seam-install` (Cursor plugin), or copy the kit in by hand (see the kit README). Every path below (`blueprint/`, `templates/`, `npm run seam:...`) is relative to the project root, not to this skill's folder.

**Goal:** one file, built only from the plan, passing locked tests, regenerable at any time.

## Inputs (and nothing else)
- The file's skeleton (it already exists: header, pseudocode, signatures, SKELETON throws)
- The file's entry in `blueprint/BLUEPRINT.md`
- Its contract(s) in `contracts/`
- Its locked tests in `tests/` (and `tests/real/` for the flip)
- The mocks it may use in `mocks/`
- `AGENTS.md`
Use templates/SEAM-PROMPT.md as the prompt.

## Steps
1. Check `.seam/phase` is `build` and that every seam this one depends on (manifest `dependsOn`) is at least mockGreen. If not, build those first (build order).
2. **Start from the skeleton, never from a blank file.** Keep the header and its `Pseudocode:` steps at the top, exactly as they are (the hooks block deleting them or cutting them below the minimum). Replace each `throw new Error('SKELETON: not built yet')` with code that does the pseudocode, **one step at a time, in order**. Keep the function names and signatures from the skeleton: the tests were written against them. Under 200 lines. Import shapes from `contracts/`, settings from `src/config`. Throw clear errors; never swallow them. Take outside dependencies (fetch, clients) as parameters so tests can pass in mocks.
   - **If a pseudocode step turns out to be wrong** (it can't work, or a step is missing): fix the pseudocode first, then the code. Add a row to `blueprint/DRIFT-LOG.md` saying what changed and why, and update the file's blueprint entry. If the change crosses a seam (new field, new file, different handoff), stop: that's "When the plan is wrong" below.
   - When the file is done, no SKELETON throw is left in it (`npm run seam:report` lists files that still have one).
3. Run `npm test`. Read failures as "which test sentence isn't true yet".
4. **Strike counting.** A strike is a fix attempt that still leaves tests failing.
   - Strike 1: fix it.
   - Strike 2: fix it, and write down what went wrong both times.
   - **After strike 2, regenerate.** Put the file back to its skeleton (`git show <skeleton commit>:<file>`, or rewrite the header + signatures) and build it again from the pseudocode + contract + tests, adding your notes as "known pitfalls" to the prompt. If the regenerated file also fails twice, the blueprint is probably wrong: stop and tell the human (see "When the plan is wrong").
5. When tests pass: commit (the hooks run typecheck, tests, and all checks). Set the seam's `status.mockGreen` to today in the manifest and commit again.
6. **Flip now, not later:** run `npm run test:real` for this seam. When it passes, set `status.realGreen` and commit. If it fails, the mock and reality disagree: re-probe (a contract change), don't patch around it.

## Never
- Edit tests, contracts, fixtures, or kit files (blocked in build phase anyway). Never weaken a test to get green.
- Touch files in other seams. Never "temporarily" return fake data.
- Use `--no-verify`.

## When the plan is wrong
If the fix needs anything that crosses a seam (new field, new file, different handoff), stop. Write a short proposal for the human: what's wrong, the blueprint change, the contract change, which files must be regenerated. The human commits it with `[contract-change]` + a drift-log row. Then regenerate the affected files with this skill.
