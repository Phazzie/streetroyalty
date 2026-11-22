# Cutover: when the new app replaces the old one

Switch users over only when **every box is ticked**. Not before. Not "almost". This list stops endless polishing *and* premature switching.

**Target date:** <date>     **Decision owner:** <name>

## Must-do list
- [ ] Every "Must have" feature in plan/FEATURES.md is **real-green** (not just mock-green). `npm run seam:report` shows no unflipped seams.
- [ ] Every failure screen in blueprint/UI-FAILURE-STATES.md exists and was seen working (timeout, upload failed, rate limited, auth expired, empty).
- [ ] Data plan in plan/MIGRATION.md done: shared DB verified, or migration run on a copy and then for real, with row/file counts matching.
- [ ] Existing users can sign in to the new app with their existing accounts.
- [ ] All emergency fixes from plan/FREEZE.md are also in the rewrite.
- [ ] CI green on main; phase is `build`; drift log has no unexplained rows.
- [ ] `npm run seam:report` shows no files that are still skeletons.
- [ ] Secrets set in production (from .env.example), nothing hardcoded.
- [ ] A person (not the AI) used the new app end to end for the 3 most common tasks: 1) ____ 2) ____ 3) ____
- [ ] Rollback plan written (plan/MIGRATION.md "Rollback") and someone knows how to do it.

## Switch day
1. Announce the switch window.
2. Final data sync / migration re-run if using fresh + migrate.
3. Point users (domain / links / app store) at the new app.
4. Watch errors for 48 hours. The old app stays read-only and available for rollback.

## After
- [ ] Old app archived (not deleted) after <N> days with no rollback.
- [ ] "Later" list in plan/FEATURES.md becomes the next blueprint.
