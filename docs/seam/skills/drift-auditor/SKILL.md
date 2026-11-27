---
name: drift-auditor
description: Compare the real codebase against blueprint/BLUEPRINT.md and manifest.json, report every difference in plain English, and propose drift-log rows. Use weekly, before any phase change, and before cutover.
---

# Drift auditor

> **Before you start:** this skill works inside a project that has the seam kit installed, meaning there is a `.seam/` folder at the project root. If there isn't one, stop and tell the human to run `/seam-driven:install` (Claude Code plugin) or `/seam-install` (Cursor plugin), or copy the kit in by hand (see the kit README). Every path below (`blueprint/`, `templates/`, `npm run seam:...`) is relative to the project root, not to this skill's folder.

**Goal:** the plan and the code never silently disagree. Every difference is either fixed or written down with a reason.

## Steps
1. Run `npm run seam:check` and `npm run seam:report`. Every BLOCK or warn line is a finding.
2. For each seam in the manifest, compare:
   - **Files:** files that exist but aren't in the blueprint, and blueprint files that don't exist.
   - **Headers vs blueprint:** does each file's Purpose/Inputs/Outputs still match its blueprint entry?
   - **Handoffs:** does the file import from seams not in its `dependsOn`? (That's a hidden seam crossing.)
   - **Contracts:** is any shape defined locally that should come from `contracts/`?
   - **Status honesty:** seams marked mockGreen whose tests are thin; mock seams that are not realGreen (how long?).
   - **Failure screens:** every row in UI-FAILURE-STATES.md has a test sentence and exists in the UI.
3. Check `plan/FREEZE.md`: every emergency fix in the old app has a matching follow-up in the rewrite.
4. Write a plain-English report: one line per difference, grouped as **Fix the code** (the plan is right), **Fix the plan** (the code learned something real, needs a blueprint + contract change), or **Fine, log it**.
5. Draft the drift-log rows (Date, Seam, Planned, Actually built, Why, Files regenerated) for the "Fix the plan" and "Fine, log it" groups. The human approves; changes to tests/contracts go in a `[contract-change]` commit.

## Never
- Change code or tests during an audit. Report and propose only.

## Done when
- The human has accepted the report, and the drift log explains every remaining difference.
