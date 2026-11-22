# Freeze policy: the old app while the rewrite happens

**Old app:** Street Royalty on `main` (https://streetroyalty.vercel.app)
**Frozen since:** proposed, waiting for the owner. **Owner who approves exceptions:** Trizzy

While the rebuild is being built on `claude/project-thread-692rqu`, `main` only gets:

1. **Emergency fixes**: the site is down, data is lost or leaked, or people can't do the main thing.
2. **Security fixes.**
3. **Go-live settings** that live outside the code (Vercel variables, Printful store, Stripe keys).

It does **not** get new features, redesigns, refactors, or non-security dependency upgrades. This
applies to every agent working on the repo, not only Claude.

## For every emergency fix
- [ ] Fix the old app (smallest possible change).
- [ ] Add a row below.
- [ ] Add the same behaviour to the rebuild as a test sentence for the right seam.

| Date | What broke | Fix in old app | Rebuild follow-up (seam + test sentence) | Done in rebuild? |
| --- | --- | --- | --- | --- |
| | | | | |

## New ideas while frozen
Go to the "Later" list in `plan/FEATURES.md`.
