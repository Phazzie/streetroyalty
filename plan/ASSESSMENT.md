# Architecture assessment (seam-driven lens)

Written 2026-11-22 on branch `claude/project-thread-692rqu`, before any rebuild code. Evidence
comes from reading `main` at `fac19ae`. Numbers are counts from the code, not estimates.

## The short version

The app works and is better tested than most (140 test files, a pure order core, fakes for
Printful). The problems are the three the seam method was made for:

1. **Decisions nobody wrote down.** There is no contract at any handoff. Zod is installed but
   imported in one file. Data crossing from the database, Printful, Stripe and xAI is cast by hand
   (`String(row.x)`, `JSON.parse(...) as T`). The same idea is typed differently in different
   places: `Scene` means two unrelated things, `Colorway` has two shapes, `"live" | "sandbox"` is
   retyped in about 15 places instead of using `PodMode`, and an order's saved items have 12 fields
   on write but 4 on read.
2. **Silent failures.** 25 places swallow errors (`.catch(() => undefined)`, empty `catch {}`). The
   xAI image and chat clients never throw: they log and return `null` or `{ok:false}`. A failed
   Printful price call becomes `null`. The go-live loader quietly shows the public view when it
   fails, and the studio shell defaults to "Sandbox" when its config call fails.
3. **No walls between areas.** Social code reads the studio's `designs` table and its private
   helpers, studio reads the social `reports` table, checkout writes the AI usage table, a library
   file imports a component, and there are two database pools. 21 files read environment variables
   directly, in three different styles. 84 non-test files are over 200 lines; the editor is 1,082,
   the lab store 805, and `studio/orders.server.ts` does checkout, the order table, Stripe calls,
   both webhooks, admin lookup and webhook registration in one file.

What already works as a seam and should be carried over in spirit: `pod/order-flow.ts` (a pure core
that takes an injected store and printer), the Printful and Stripe clients that accept a `fetch`,
the test fakes, and the order-store contract test.

## Seam map for the rebuild (14 seams)

| # | Seam | Owns | Outside service |
| --- | --- | --- | --- |
| 1 | config | every setting and secret, validated once | none |
| 2 | auth | sign-in, Grok gate identity, OAuth broker, admin role, one `optionalUser` | Grok gate + broker |
| 3 | state | client state: the lab store, the art hand-off between tools, local preferences | none |
| 4 | storage | one database pool, migrations, row schemas, one repository per table owner | Neon |
| 5 | catalog | blanks, garments, panels, outlines, colourways, money math (pure) | Printful catalog |
| 6 | printing | the printer contract, Printful client, sandbox printer, print-file tokens | Printful |
| 7 | payments | checkout sessions, webhook signatures | Stripe |
| 8 | ai | images, video, text, daily spend caps | xAI |
| 9 | studio | designs, collections, print files, mockups, the editor screens | via printing |
| 10 | orders | cart, checkout, the order lifecycle, both webhooks, fulfilment | via printing + payments |
| 11 | rack | publish, rack feed, makers, crowns, follows, remix, tag scans, battles, activity | none |
| 12 | admin | moderation reports, the go-live board | none |
| 13 | lab | Outfit Lab, try-on, Say | via ai |
| 14 | site | home page, shells, patterns, clash, made/math, hang tags, episodes | none |

Rules that fix the problems above: each table has exactly one owning seam and others ask that seam
through its contract; only `src/config/` reads the environment; every outside answer is parsed by a
Zod contract; every failure throws a named error that the UI maps to a failure screen
(`blueprint/UI-FAILURE-STATES.md`).

## How the rebuild is laid out

- The rebuild happens on this branch only. `main` and the live site are untouched until cutover.
- The kit's checks assume the new code lives in the top-level `src/`. When the skeleton phase
  starts, today's `src/` moves to `prototype/src/` as a frozen, read-only reference, and the new
  `src/` is generated from the blueprint. Platform files (`vite.config.ts`, `server/`,
  `scripts/grok-*`, `public/`) stay as they are; the Street Royalty look (`src/styles.css`,
  `DESIGN.md`, `public/brand/`) is carried over unchanged.
- Cutover is merging this branch, and only when `plan/CUTOVER.md` is all ticked.

## What needs the owner

- Confirm the feature list in `plan/FEATURES.md` (the method does not continue without it).
- Agree to the freeze in `plan/FREEZE.md`, which includes the other agents working on `main`.
