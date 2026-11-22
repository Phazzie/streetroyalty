# Locked feature list

**Status: DRAFT, waiting for the owner to confirm.** Not locked yet. Changing it after it is locked
is a blueprint change (log it in the drift log).
Source: what `main` does today (2026-11-22), read route by route.

## Proposed must-have for cutover
| # | Feature (plain English) | Seam(s) | In old app? | Test sentences written? | Mock-green | Real-green |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sign in from Grok without clicking (gate identity), plus email/password and the Grok broker | auth | yes | | | |
| 2 | Admins (by email list) see admin tools; nobody else does | auth, admin | yes | | | |
| 3 | Design a piece in the studio: blank, colour, art, type, curved text, preflight, mockup | studio, catalog, printing | yes | | | |
| 4 | Save designs into collections and see them in the gallery | studio, storage | yes | | | |
| 5 | Build a colour-blocked set (`/studio?set=`) | studio, catalog | yes | | | |
| 6 | Publish a piece to the rack; browse Fresh / Crowned / Following; search | rack | yes | | | |
| 7 | Product page: crown, follow, remix, family tree, money split, try-on, report | rack, lab, admin | yes | | | |
| 8 | Maker shop window (`/m/handle`) and my profile with activity (`/me`) | rack | yes | | | |
| 9 | Cart, shipping quote, checkout through Stripe (or sandbox test payment), orders, retry a failed print | orders, payments, printing | yes | | | |
| 10 | Printful and Stripe webhooks, signed and de-duplicated | orders | yes | | | |
| 11 | Outfit Lab: lock a face, generate pieces and looks, runway video, drop card | lab, ai, state | yes | | | |
| 12 | Say: describe a piece by voice or text and get a starting design | lab, studio | yes | | | |
| 13 | Daily AI allowance per visitor, asked before paid actions | ai | yes | | | |
| 14 | Moderation queue for reports | admin | yes | | | |
| 15 | Go-live board (launch checklist and service health) | admin, config | yes | | | |
| 16 | Home page with the WebGL hero, site shells, crown mark, Sandbox/Live tag | site | yes | | | |
| 17 | Hang tag with QR and story card (`/tag/slug`), scan counting | site, rack | yes | | | |

## Proposed "later" (kept in the old app, rebuilt after cutover)
| Feature | Why later |
| --- | --- |
| Battles and the Throne leaderboard | Not on the money path; 1,100 lines |
| Pattern lab (`/patterns`) | Pure client tool; easy to port after the core is stable |
| Clash slot machine (`/clash`) | Pure client tool |
| Made and Math explainers | Content pages |
| Episodes ("The Show") | Placeholder today: one planned episode, only the wardrobe sheet works |

## Dropped on purpose
| Feature | Why dropped |
| --- | --- |
| Grok connectors client (`src/lib/app-data`) | Template code; nothing in the app uses it |
| Admin "Connect webhooks" button inside the customer orders page | Moves to the go-live board, and stops printing the secret on screen |
| All-over print ordering | Stays closed exactly as today until the printer templates exist; designing all-over pieces stays |

## Later (new ideas during the rebuild)
| Idea | Who asked | Date |
| --- | --- | --- |
| Brands (`docs/brand-spec.md`) | owner, earlier plan | 2026-11-19 |
| better-auth 1.7 migration | Claude, earlier plan | 2026-11-19 |
