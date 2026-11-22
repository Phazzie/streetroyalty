# Data and storage migration

Decide this **before** building the storage seam. Rewrites are easy; keeping users' existing data working is where they hurt.

## Inventory: what data exists today
| Data | Where it lives now (DB table / bucket / service) | Rough size | Who owns it | Must survive the rewrite? |
| --- | --- | --- | --- | --- |
| users / accounts | | | | |
| user uploads (images) | | | | |
| generated files | | | | |
| settings / preferences | | | | |

## Decision (pick one per row above)
- **Shared**: the rewrite reads and writes the same database/bucket as the old app.
  - Good: no migration, instant parity. Risk: the old app's schema leaks into the new contracts; both apps can corrupt each other's data.
  - Rule if shared: the new app's storage contract must match the existing schema exactly (probe it!). No schema changes until cutover.
- **Fresh + migrate**: the rewrite gets its own database/bucket; a one-time (or repeatable) migration script copies data over.
  - Good: clean contracts. Risk: migration bugs; data written to the old app after the copy.
  - Rule if fresh: write the migration as its own seam with tests, run it on a copy first, and re-run it right before cutover.
- **Fresh, no migration**: users start over. Only if the data is disposable.

| Data | Decision | Why | Migration script / seam | Tested on a copy? |
| --- | --- | --- | --- | --- |
| | | | | |

## Auth accounts
Same auth provider and user IDs? If not, how do old users log in to the new app?

## Rollback
If cutover goes wrong, how do we switch back without losing data written to the new app?
