# Freeze policy: the old app while the rewrite happens

**Old app:** <name / repo / URL>     **Frozen since:** <date>     **Owner who approves exceptions:** <name>

While the rewrite is being built, the old app is **frozen**. It only gets:

1. **Emergency fixes**: it's down, data is being lost or leaked, or users can't do the main thing.
2. **Security fixes.**

It does **not** get: new features, redesigns, refactors, "quick" improvements, dependency upgrades that aren't security fixes.

## For every emergency fix
- [ ] Fix the old app (smallest possible change).
- [ ] Add a row below.
- [ ] Add the same behavior to the rewrite: a test sentence for the right seam (contract change if it crosses a seam).

| Date | What broke | Fix in old app | Rewrite follow-up (seam + test sentence) | Done in rewrite? |
| --- | --- | --- | --- | --- |
| | | | | |

## New ideas while frozen
Go to the "Later" list in plan/FEATURES.md. Not into either app.

## Why
If both apps keep changing, the rewrite chases a moving target and never catches up.
