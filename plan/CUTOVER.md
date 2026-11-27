# Cutover: when the rebuild replaces the old app

Cutover means merging `claude/project-thread-692rqu` into `main`. Only when **every box is ticked**.

**Target date:** not set     **Decision owner:** Trizzy

## Must-do list
- [ ] Every "Must have" feature in `plan/FEATURES.md` is **real-green**. `npm run seam:report` shows no unflipped seams.
- [ ] Every failure screen in `blueprint/UI-FAILURE-STATES.md` exists and was seen working.
- [ ] Shared database verified: the rebuild reads every existing design, maker and account (`plan/MIGRATION.md`).
- [ ] Existing users stay signed in across the switch (same Better Auth cookies and user ids).
- [ ] All emergency fixes from `plan/FREEZE.md` are also in the rebuild.
- [ ] Phase is `build`; the drift log has no unexplained rows; no file is still a skeleton.
- [ ] `npm run build`, `npm run typecheck`, the seam checks and the browser smoke pass on the branch's Vercel preview.
- [ ] The Street Royalty look matches `main` side by side on home, studio, rack, product page, cart and lab (desktop and 390px phone).
- [ ] A person used the preview end to end for: 1) design and save a piece 2) publish it and find it on the rack 3) bag it and finish a sandbox checkout.
- [ ] Rollback written down: revert the merge commit on `main`.

## Switch day
1. Merge the pull request.
2. Watch Vercel runtime errors for 48 hours.
3. Keep `prototype/` until a week passes with no rollback, then delete it in its own pull request.
