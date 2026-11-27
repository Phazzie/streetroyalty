# Blueprint: Street Royalty (rebuild)

> Written BEFORE any rebuild code. Every file the app needs, grouped by seam, in build order.
> Next step after review: the skeleton phase turns every entry below into a skeleton file.
> Status: **draft.** Foundation seams (config, auth, storage) have full entries. The other seams
> have their file lists and contracts; their pseudocode and test sentences are written once the
> owner confirms `plan/FEATURES.md`, so no effort goes into features that get cut.
> Kept in sync with `blueprint/manifest.json`. Why the rebuild: `plan/ASSESSMENT.md`.

## 0. One-paragraph summary
Street Royalty is a clothing label and a make-your-own-clothes shop for people who dress by nobody's
rules, many of them not techy (`PRODUCT.md`). People design pieces in the studio, publish them to the
rack, and buy them; Printful prints and ships, Stripe takes payment, xAI draws art, looks and
runway video. The rebuild keeps every screen, word and colour of today's app and replaces what is
underneath with 14 seams that each own their data, talk through Zod contracts, and fail loudly.

## 1. Seam map

| Seam | What it owns | Talks to | Outside service? |
| --- | --- | --- | --- |
| config | every setting and secret, read and validated once | everyone (read-only) | no |
| auth | session, Grok gate identity, Grok broker OAuth, email/password, admin role, server-function middleware | config, storage | yes (Grok gate, broker) |
| state | client state: lab store, art hand-off between tools, kept colourways, seen-markers | auth | no (IndexedDB, storage APIs) |
| storage | the one pg pool / PGlite fallback, migrations, row schemas, transactions | config | yes (Neon) |
| catalog | blanks, garment models, panels, outlines, colourways, money math, prices | config, printing | yes (Printful catalog, via printing) |
| printing | printer contract, Printful client, sandbox printer, print-file tokens, webhook signature | config | yes (Printful) |
| payments | Stripe checkout sessions, Stripe signature | config | yes (Stripe) |
| ai | xAI images / video / chat, daily allowance, spend ledger | config, storage, auth | yes (xAI) |
| studio | designs, collections, print files, mockups, sets; editor, gallery screens | catalog, printing, storage, auth, state | no |
| orders | cart, shipping quote, checkout, order lifecycle, both webhooks, retry print | studio, printing, payments, storage, auth | no |
| rack | publish, feed, makers, profiles, crowns, follows, remix, lineage, tag scans, activity | studio, storage, auth, ai | no |
| admin | moderation reports, go-live board, webhook registration | auth, storage, config, printing, payments | no |
| lab | Outfit Lab screens, try-on, Say | ai, state, studio, catalog | no |
| site | routes' shells, home + WebGL hero, hang tags, error component, crown mark | everyone (read-only) | no |

### Ownership rules (the walls)
- Each table belongs to exactly one seam. Others call that seam's exported functions, typed by its
  contract. Today's offenders this fixes: social reading `designs` and `user`, studio reading
  `reports`, checkout writing `ai_usage`.
- `designs` belongs to studio. Rack asks studio for `DesignSummary` lists by id; it never queries
  `designs` itself. Studio asks admin `isHidden(designIds)` instead of reading `reports`.
- Checkout metering gets its own `orders` counter instead of borrowing the AI ledger.
- Only `src/config/` reads `process.env` / `import.meta.env`.
- Server-only files end in `.server.ts`. Client files never import them, not even types; shared
  types live in `contracts/`.
- No component imports from another seam's internals; screens import their own seam's client API.

## 2. Build order
1. config
2. auth
3. state
4. storage
5. catalog (pure; needs printing's contract only)
6. printing
7. payments
8. ai
9. studio
10. orders
11. rack
12. admin
13. lab
14. site

## 3. Layout on this branch
- New code: `src/`, `contracts/`, `mocks/`, `probes/`, `tests/`, `tests/real/`.
- Old app: moved to `prototype/src/` at the start of the skeleton phase, read-only, ignored by the
  seam checks and the build. Deleted one week after cutover.
- Kept as is: `vite.config.ts`, `server/`, `scripts/grok-*`, `scripts/with-app-env.mjs`,
  `public/` (including `public/__grok/` and `public/brand/`), `migrations/`, `src/styles.css`
  (carried into the new `src/` byte for byte), `src/router.tsx` and `src/routes/__root.tsx`
  contracts from `AGENTS.md`.
- Routes stay at the same URLs. Route files are thin: they render one screen from their seam.

## 4. Files, seam by seam

### Seam: config
Contract: `contracts/config.ts` - Mock: none - Probe: none
Failure screens: config row of UI-FAILURE-STATES.md

#### `src/config/index.ts`
- **Purpose:** Read every environment variable once, check it, and hand out one typed, frozen settings object.
- **Inputs:** the process environment (server) and `import.meta.env` (client, `VITE_` only).
- **Outputs:** `ServerConfig` and `ClientConfig` (contracts/config.ts). Throws `ConfigError` naming the variable.
- **Seams touched:** config
- **Errors:** `ConfigError` when a variable is malformed, or required for the current mode and missing (for example `POD_MODE=live` without `PRINTFUL_API_KEY`, `PRINTFUL_STORE_ID`, `APP_PUBLIC_URL`; `PAYMENTS_MODE=live` with `POD_MODE=sandbox`).
- **Pseudocode:**
  1. Collect the raw values for every known variable, trimming blanks to "not set".
  2. Parse them with the ServerConfig schema: modes must be exactly `sandbox` or `live`, numbers are clamped (studio markup 1 to 5), email lists are split and lower-cased.
  3. Apply the cross-checks: live payments need live printing, live printing needs its keys and public URL, a database URL forbids the auth-off dev user.
  4. If anything fails, throw one ConfigError that lists every bad variable by name, never its value.
  5. Freeze the result and cache it so every caller gets the same object.
- **Test sentences:**
  - When `POD_MODE` is `live` and `PRINTFUL_API_KEY` is missing, it throws a ConfigError naming `PRINTFUL_API_KEY`.
  - When `PAYMENTS_MODE` is `live` and `POD_MODE` is `sandbox`, it throws a ConfigError saying live payments need live printing.
  - When `STUDIO_MARKUP` is 9, the config says 5.
  - When `STUDIO_ADMIN_EMAILS` is " A@x.com, b@y.com ", the config holds ["a@x.com", "b@y.com"].
  - When `POD_MODE` is "Live", it throws (modes are exact).
  - A ConfigError message never contains a secret's value.

#### `src/config/client.ts`
- **Purpose:** The browser-safe slice of settings (auth on/off, production build or not).
- **Inputs:** `import.meta.env` (`VITE_AUTH_ENABLED`, `PROD`).
- **Outputs:** `ClientConfig` (contracts/config.ts).
- **Seams touched:** config
- **Errors:** `ConfigError` when `VITE_AUTH_ENABLED` is neither "true", "false" nor unset.
- **Pseudocode:**
  1. Read the two `VITE_` values the client may know about.
  2. Parse them with the ClientConfig schema, defaulting auth to on.
  3. Return the frozen object.
- **Test sentences:**
  - When `VITE_AUTH_ENABLED` is "false", auth is off.
  - When it is "maybe", it throws a ConfigError.

### Seam: auth
Contract: `contracts/auth.ts` (`SessionUser`, `AuthContext`, `AuthError`) - Mock: `mocks/auth.mock.ts` - Probe: `probes/auth.probe.ts` (gate JWKS, broker userinfo)
Failure screens: auth row

#### `src/auth/server.ts`
- **Purpose:** Build the one Better Auth instance (cookies, plugins, database) the whole app uses.
- **Inputs:** `ServerConfig.auth`, the storage seam's pool.
- **Outputs:** the Better Auth handler for `/api/auth/$`.
- **Seams touched:** auth, config, storage
- **Errors:** `AuthError("misconfigured")` when the secret is missing outside preview.
- **Pseudocode:**
  1. Take the database from the storage seam (one pool, never a second one).
  2. Configure Better Auth with today's cookie names (`__Host-grok-auth.*`), 300 s cookie cache, the bearer plugin, the TanStack cookie plugin, email/password behind its flag, and the Grok broker generic OAuth.
  3. Add the gate-identity plugin from `gate.server.ts` on `/get-session`.
  4. Return the instance, cached.
- **Test sentences:**
  - The auth cookies keep today's names, so signed-in people stay signed in after cutover.
  - When the broker client id is missing on a non-preview host, the broker sign-in button is not offered.

#### `src/auth/gate.server.ts`
- **Purpose:** Turn a verified Grok gate identity header into a Better Auth session.
- **Inputs:** the `x-grok-identity` header; gate origin and project id from config.
- **Outputs:** a `SessionUser` (contracts/auth.ts) or an `AuthError`.
- **Seams touched:** auth, config
- **Errors:** `AuthError("gate_rejected")` on a bad signature, wrong audience or expired token; `AuthError("gate_unreachable")` when the key set can't be fetched.
- **Pseudocode:**
  1. Fetch the gate's key set from `{gateOrigin}/__gate/identity-key`, cached for ten minutes.
  2. Verify the header as a JWT with audience `app:{projectId}`; on failure throw gate_rejected.
  3. Parse the claims with the GateClaims contract.
  4. Find or create the matching user and session, and set the gate marker cookie.
- **Test sentences:**
  - When the identity token is signed by the gate's key, the person gets a session with their gate email.
  - When the token's audience is another project, it throws AuthError gate_rejected.
  - When the key set request fails, it throws AuthError gate_unreachable (never a signed-out session).

#### `src/auth/middleware.ts`
- **Purpose:** The two server-function middlewares every seam uses: `requireUser` and `optionalUser`.
- **Inputs:** the request (cookies, bearer token, `Sec-Fetch-Site`, `Origin`).
- **Outputs:** `AuthContext` `{ userId }` or `{ userId: null }`.
- **Seams touched:** auth
- **Errors:** `AuthError("signed_out")`, `AuthError("cross_site")`.
- **Pseudocode:**
  1. Reject cross-site requests by checking Sec-Fetch-Site and Origin; throw cross_site.
  2. Read the session through Better Auth (cookie, or bearer token in the preview iframe).
  3. For requireUser, throw signed_out when there is no session; for optionalUser, pass null.
  4. When auth is off by config, use the dev user, and refuse if a database URL is set.
- **Test sentences:**
  - When a request has no session, requireUser throws AuthError signed_out.
  - When a request has no session, optionalUser gives userId null.
  - When Sec-Fetch-Site is cross-site, both throw AuthError cross_site.
  - When auth is off and DATABASE_URL is set, it throws.

#### `src/auth/admin.server.ts`
- **Purpose:** Answer "is this user an admin" in one place.
- **Inputs:** a user id; `ServerConfig.adminEmails`.
- **Outputs:** boolean; `requireAdmin` middleware.
- **Seams touched:** auth, config, storage
- **Errors:** `AuthError("staff_only")` from requireAdmin.
- **Pseudocode:**
  1. If the admin list is empty, nobody is an admin.
  2. Look up the user's email through the auth tables (auth owns `user`).
  3. Compare it lower-cased against the list.
- **Test sentences:**
  - When the admin list is empty, no one is an admin.
  - When the user's email matches in a different case, they are an admin.
  - When a non-admin calls an admin function, it throws AuthError staff_only.

#### `src/auth/client.ts`
- **Purpose:** The browser auth client: session hook, sign in / out, bearer token for the preview iframe.
- **Inputs:** `ClientConfig`.
- **Outputs:** `useCurrentUser()`, `signIn`, `signOut`.
- **Seams touched:** auth, config
- **Errors:** surfaces `AuthError` codes; never shows raw "Unauthorized".
- **Pseudocode:**
  1. Create the Better Auth client pointing at `/api/auth`.
  2. Keep the bearer token in session storage when cookies are partitioned.
  3. Expose the current user and the sign-in/out actions.
- **Test sentences:**
  - When the session call fails with 401, useCurrentUser reports signed out with code signed_out.

### Seam: storage
Contract: `contracts/storage.ts` (`Sql`, `StorageError`) - Mock: `mocks/storage.mock.ts` (PGlite with migrations) - Probe: `probes/storage.probe.ts` (reads `information_schema` to confirm the shared schema)
Failure screens: storage row

#### `src/storage/db.server.ts`
- **Purpose:** The one database handle: a pg pool for Neon, or in-memory PGlite when no URL is set.
- **Inputs:** `ServerConfig.databaseUrl`.
- **Outputs:** `Sql` tagged-template function and `transaction()`.
- **Seams touched:** storage, config
- **Errors:** `StorageError("unavailable")` on connection failure; `StorageError("query", detail)` on query errors.
- **Pseudocode:**
  1. If a database URL is set, open one pg pool against it; otherwise start PGlite and apply the migrations.
  2. Wrap queries so a connection failure throws StorageError unavailable and other failures throw StorageError query with the statement name.
  3. Offer a transaction helper that rolls back and rethrows on any error.
  4. Cache the handle so auth and every seam share it.
- **Test sentences:**
  - When no database URL is set, every migration is applied and the `designs` table exists.
  - When a query inside a transaction throws, nothing in that transaction is saved and the error is rethrown.
  - When the database can't be reached, it throws StorageError unavailable.

#### `src/storage/rows.ts`
- **Purpose:** Parse a database row with a Zod row schema, so no seam casts by hand.
- **Inputs:** a row schema from a seam's contract and raw rows.
- **Outputs:** typed rows.
- **Seams touched:** storage
- **Errors:** `StorageError("row_shape", table, issue)` when a row doesn't match.
- **Pseudocode:**
  1. Run each row through the given schema.
  2. If any row fails, throw StorageError row_shape naming the table and the field.
  3. Return the typed rows.
- **Test sentences:**
  - When an `orders.items_json` value is missing a field the contract requires, it throws StorageError row_shape naming `orders`.

### Seam: state
Contract: `contracts/state.ts` (`LabSnapshot`, `ArtHandoff`)
Planned files: `src/state/lab-store.ts` (zustand store, state only, no network), `src/state/lab-persist.ts` (IndexedDB `street-royalty`/`lab`, same key and shape as today), `src/state/art-handoff.ts` (the typed replacement for the ad-hoc `sr-print-art` session key used by say, patterns and lab), `src/state/local-prefs.ts` (seen-markers, kept colourways, saved cast).

### Seam: catalog
Contract: `contracts/catalog.ts` (`Blank`, `Variant`, `Garment`, `Panel`, `Outline`, `Colorway` (one shape), `Money`)
Planned files: `src/catalog/blanks.ts`, `src/catalog/garments.ts`, `src/catalog/panels.ts`, `src/catalog/outlines.ts`, `src/catalog/colorways.ts`, `src/catalog/money.ts`, `src/catalog/catalog.server.ts` (prices and variants through printing), plus the drawing code under `src/catalog/draw/` (shapes, patterns, effects; split so no file passes 200 lines).

### Seam: printing
Contract: `contracts/printing.ts` (`Printer`, `PrintOrder`, `PrintfulWebhook`, `PodMode`, `PrintError`) - Mock: `mocks/printing.mock.ts` - Probe: `probes/printing.probe.ts` (catalog product, variants, prices, shipping rates, mockup task, draft order, errors 400/404/429)
Planned files: `src/printing/printful.server.ts`, `src/printing/printful-errors.ts`, `src/printing/sandbox.server.ts` (stateless: orders kept in the database, not `globalThis`), `src/printing/print-token.server.ts`, `src/printing/signature.server.ts`, `src/printing/index.server.ts`.

### Seam: payments
Contract: `contracts/payments.ts` (`CheckoutSession`, `StripeEvent`, `PaymentsMode`, `PaymentError`) - Mock: `mocks/payments.mock.ts` - Probe: `probes/payments.probe.ts` (test-mode session create/retrieve, signed event)
Planned files: `src/payments/stripe.server.ts`, `src/payments/signature.server.ts`, `src/payments/sandbox.server.ts`.

### Seam: ai
Contract: `contracts/ai.ts` (`ImageResult`, `VideoJob`, `TextResult`, `Allowance`, `AiError`) - Mock: `mocks/ai.mock.ts` - Probe: `probes/ai.probe.ts` (one image, one video poll, one chat, plus a refused prompt and a 429)
Planned files: `src/ai/images.server.ts`, `src/ai/video.server.ts`, `src/ai/text.server.ts` (all throw `AiError`; no more `null` on failure), `src/ai/allowance.server.ts`, `src/ai/visitor-key.server.ts` (the one salted visitor hash, shared with rack's battle tickets), `src/ai/api.ts` (server functions).

### Seam: studio
Contract: `contracts/studio.ts` (`Design`, `DesignSummary`, `Collection`, `PrintFile`, `GarmentSet`, `StudioError`)
Planned files: `src/studio/designs.server.ts`, `src/studio/collections.server.ts`, `src/studio/print-files.server.ts`, `src/studio/mockups.server.ts`, `src/studio/sets.server.ts`, `src/studio/validate.ts`, `src/studio/api.ts`, and the editor split into `src/studio/editor/` (canvas, art tools, type tools, preflight, all-over stage, colour panel, save bar; each under 200 lines), `src/studio/gallery.tsx`, `src/studio/set-board.tsx`, `src/studio/print-file.ts`.

### Seam: orders
Contract: `contracts/orders.ts` (`CartLine` (with colourway and provider), `OrderItem` (one shape, read = write), `Order`, `OrderStatus`, `OrderError`)
Planned files: `src/orders/cart.server.ts`, `src/orders/lifecycle.ts` (today's pure `order-flow` core, carried over), `src/orders/order-store.server.ts`, `src/orders/checkout.server.ts`, `src/orders/checkout-claim.server.ts`, `src/orders/checkout-limit.server.ts` (own counter), `src/orders/webhooks.server.ts`, `src/orders/api.ts`, screens `src/orders/cart-page.tsx`, `checkout-page.tsx`, `orders-page.tsx`.

### Seam: rack
Contract: `contracts/rack.ts` (`RackPiece`, `Maker`, `Profile`, `Activity`, `Lineage`, `RackError`)
Planned files: `src/rack/feed.server.ts`, `src/rack/makers.server.ts`, `src/rack/crowns.server.ts`, `src/rack/follows.server.ts`, `src/rack/remix.server.ts`, `src/rack/scans.server.ts`, `src/rack/activity.server.ts`, `src/rack/quota.server.ts`, `src/rack/api.ts`, screens under `src/rack/screens/` (feed, product page, maker window, me, family tree, try-on panel, money split).

### Seam: admin
Contract: `contracts/admin.ts` (`Report`, `ReportReason`, `GoLiveBoard`, `AdminError`)
Planned files: `src/admin/reports.server.ts`, `src/admin/hidden.server.ts` (`isHidden(designIds)` for studio and rack), `src/admin/board.server.ts`, `src/admin/switchboard.ts`, `src/admin/webhooks.server.ts`, `src/admin/api.ts`, screens `src/admin/queue.tsx`, `src/admin/go-live.tsx`.

### Seam: lab
Contract: `contracts/lab.ts` (`Piece`, `Look`, `RunwayRun`, `SayIntent`, `LabError`)
Planned files: `src/lab/api.ts`, `src/lab/runway-owner.server.ts`, `src/lab/drop-card.ts`, screens under `src/lab/screens/` (lock, hub, board, look, runway, chrome), `src/lab/tryon/`, `src/lab/say/` (parse, fit, colours, art, page).

### Seam: site
Contract: none (renders only)
Planned files: `src/site/shell.tsx`, `src/site/studio-shell.tsx`, `src/site/home.tsx`, `src/site/hero.tsx`, `src/site/gl/`, `src/site/crown-mark.tsx`, `src/site/error-component.tsx`, `src/site/tag/` (hang tag, story card, QR encoder), `src/site/failure.tsx` (one component that maps every seam's error code to its line in UI-FAILURE-STATES.md).

## 5. Open questions
1. Feature scope: does the owner accept the "later" list in `plan/FEATURES.md` (battles, patterns, clash, made/math, episodes)?
2. Freeze: will the other agents (Grok Bot, Cursor agents) hold feature work on `main` until cutover?
3. Shared database (`plan/MIGRATION.md`): confirm, and allow a Neon branch for the rebuild's previews.
4. Probes need real keys. `XAI_API_KEY` and `PRINTFUL_API_KEY` are production-only in Vercel; Stripe has no test key yet. Probes for those seams run once keys are available to previews.
