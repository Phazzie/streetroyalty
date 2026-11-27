# Data and storage migration

Recommendation, for the owner to confirm: **share the existing Neon database and Better Auth
accounts.** No customer orders exist yet, but saved designs, makers and sign-ins do, and sharing keeps
them with zero copying.

## Inventory: what data exists today
| Data | Where it lives now | Who owns it in the rebuild | Must survive? |
| --- | --- | --- | --- |
| Accounts and sessions | `user`, `session`, `account`, `verification` (Better Auth) | auth | yes |
| Designs, collections, garment sets | `designs`, `collections`, `garment_sets` | studio | yes |
| Print files | `print_files` (base64 in Postgres) | studio | yes |
| Cart and orders | `cart_items`, `orders`, `checkout_claims`, `webhook_events` | orders | yes (no real orders yet) |
| AI usage and runway runs | `ai_usage`, `runway_runs` | ai | no, but harmless to keep |
| Social | `profiles`, `follows`, `crowns`, `design_lineage`, `tag_scans`, `battle_votes`, `action_quotas` | rack | yes |
| Moderation | `reports` | admin | yes |
| Lab looks | browser IndexedDB `street-royalty` / `lab` | state | yes, same key and shape |

## Decision
| Data | Decision | Why |
| --- | --- | --- |
| Every table above | **Shared** | Parity on day one; the rebuild's row schemas are written by probing the real tables |
| Lab IndexedDB | **Shared** (same database and key) | Visitors keep their looks |

Rules because it is shared: the storage contracts must match the existing schema exactly; no
schema changes until cutover; new migrations are numbered after `0016` and must be safe for the old
app too. The rebuild's preview deploys must not point at production data while it writes test rows:
use a Neon branch for previews.

## Auth accounts
Same Better Auth install, same cookie names, same user ids. Nobody has to sign in again.

## Rollback
Revert the cutover merge on `main`. Because the database is shared and the schema unchanged, the
old app reads everything the new one wrote.
