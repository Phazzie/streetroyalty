# Street Royalty

Street Royalty is a streetwear site with four parts: a home page, a shop, an outfit lab, and a design studio.

- **Home** (`/`) — the drop, the lab, and the studio in one scroll. The opening carousel is drawn in WebGL and falls back to plain photos when WebGL or motion is off.
- **Shop** (`/shop`) — the official drop. It reads products from a Fourthwall shop and hands the bag to Fourthwall's checkout. With no Fourthwall token it shows a preview drop that cannot be bought.
- **Outfit Lab** (`/lab`) — lock a face, build pieces by voice, put them on, and walk the look.
- **Studio** (`/studio`) — turn a design into a real garment: pick a blank, place art and type, preview a mockup, publish it, and check out. Published customs sit on **the rack** (`/rack`).

## Shop

The shop has two modes. Which one runs depends on one variable.

- **Preview drop.** With `FOURTHWALL_STOREFRONT_TOKEN` unset, the shop shows eight built-in pieces from `src/lib/storefront/demo.ts`. Every page says it is a preview, and Checkout explains that nothing can be bought yet.
- **Fourthwall.** With the token set, products, collections, prices, sizes, and stock come from the [Fourthwall Storefront API](https://docs.fourthwall.com/storefront/overview). Checkout creates a Fourthwall cart and sends the shopper to Fourthwall's hosted checkout. Fourthwall takes the payment, prints, and ships.

The bag lives in the browser. A shop piece can be sent to the lab with **Try it on in the lab**, which puts its photo on the board as a piece to wear.

## Outfit Lab

- **Stylist** — on the hub, **Dress me for an occasion** plans three or four pieces. Nothing is built until you confirm, because each piece is a paid picture.
- **Drop card** — on a look, **Drop card** makes a 4:5 poster with the look, its name, and the crown's verdict. Phones get the share sheet; everything else gets a download.
- **Scenes** — the walk can be shot on the runway, a night street, a rooftop, or a subway platform.

## Studio

- **Studio** (`/studio`) — product, color, size, placement (front, back, sleeve when the blank allows it), text, upload, drag, scale, rotate, mockup, save, publish, cart. **Write a line** drafts print copy.
- **Make art** — type an idea, pick a style, and the studio draws print art and cuts the white backdrop away.
- **Print it as** — any picture layer can be cut out, turned into one ink, or rebuilt as a halftone. **Original** undoes it. An uploaded PNG keeps its transparency.
- **On a person** — **See it worn** shows the piece on you if your face is locked in the lab, and on the house model if it is not. It is a generated picture, not a print proof.
- **Rack search** (`/rack`) — type a product word, or **Find** to turn a vibe into catalog words.
- **Crown** — on a look, **Ask the crown** critiques the outfit and **Name it** titles it. On the runway, **Crown picks the crowd**. On a shop piece, **Will this print?** gives placement advice. **Surprise me** opens a random piece on the rack. All of the crown buttons use Grok when `XAI_API_KEY` is set and a local answer when it is not.
- **Board** — rebuild one piece after a confirm. Dropped pieces and saved looks can be undone for a few seconds. Tickets from each build sit on the hub.
- **Gallery** — your saved pieces, grouped by collection.
- **Rack** (`/rack`) — published customs, size picker, add to cart. An old `/shop/<slug>` link to a custom is forwarded here.
- **Checkout** — shipping quote, then payment. The print order is created as a draft and confirmed only after payment.
- **Orders** — status, tracking when the printer sends it.

Sign-in is email and password, plus Google or X. Designs, carts, and orders belong to the signed-in account.

A look from the outfit lab can be sent to the studio with **Print this**. That drops the look in as artwork.

## Sandbox

With no Printful or Stripe keys, the app runs in sandbox:

- Catalog, variants, print areas, and prices come from a built-in blank list (tee, hoodie, hat, crewneck).
- Mockups are drawn in the app.
- Checkout shows **Confirm test payment**. That confirms the sandbox draft. No card is charged and nothing is sent to a factory.
- `POD_MODE=live` together with `PAYMENTS_MODE=sandbox` is refused. A test payment cannot confirm a live Printful order.
- `PAYMENTS_MODE=live` together with sandbox printing is refused before Checkout is created. A card cannot be charged while no printer will receive the garment.

Set the variables below to leave sandbox.

## Environment

Copy `.env.example` to the host’s secret store. Do not commit real keys. This workspace does not ship a `.env` file. `DATABASE_URL` and the auth client credentials are injected on deploy. Preview uses an embedded database when `DATABASE_URL` is unset.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PRINTFUL_API_KEY` | Live print | Private token from [Printful Developers](https://developers.printful.com/). |
| `PRINTFUL_STORE_ID` | Account-level tokens | Store id. Required when the token is not already scoped to one store. Sent as `X-PF-Store-Id`. |
| `PRINTFUL_WEBHOOK_SECRET` | Live webhooks | Hex secret from the webhook configuration. The app hex-decodes it, which is how Printful documents the key. |
| `POD_MODE` | No | `sandbox` (default without a key) or `live`. |
| `STRIPE_SECRET_KEY` | Live payments | Secret key (`sk_test_...` or `sk_live_...`). |
| `STRIPE_WEBHOOK_SECRET` | Live payments | Signing secret (`whsec_...`) for `checkout.session.completed`. |
| `PAYMENTS_MODE` | No | `sandbox` (default without a key) or `live`. |
| `APP_PUBLIC_URL` | Live print | Public https origin, no trailing slash. Printful downloads print files from `{APP_PUBLIC_URL}/api/print-files/{id}`. |
| `STUDIO_MARKUP` | No | Retail = wholesale × markup. Default `2.2`. Clamped between 1 and 5. |
| `PRINT_FILE_SIGNING_SECRET` | Live print files | HMAC key for print-file URLs. Sandbox uses a built-in secret. Live mode will not publish a file URL without it. |
| `STUDIO_ADMIN_EMAILS` | Webhook setup | Comma-separated sign-in emails allowed to press **Connect webhooks**. Empty means nobody can. |
| `DATABASE_URL` | Deploy | Postgres connection. Injected on deploy. Unset in local preview. |
| `XAI_API_KEY` | AI | Server-only key for image, video, the crown critic, the stylist, print art, print lines, rack search, and pull-request review. When it is missing, the text features use a built-in fallback, pictures and video say they are unavailable, and review skips. |
| `FOURTHWALL_STOREFRONT_TOKEN` | Live shop | Public storefront token from the Fourthwall dashboard, under Settings, For developers. Unset means the preview drop. |
| `FOURTHWALL_CHECKOUT_DOMAIN` | No | Host for Fourthwall checkout, for example `your-shop.fourthwall.com`. Defaults to the domain the Storefront API reports for the shop. |
| `BETTER_AUTH_URL` | Hosting outside Grok | The site's public https origin. Sign-in refuses requests from any other origin. |
| `BETTER_AUTH_SECRET` | Hosting outside Grok | Long random string that signs sessions. Without it every server instance invents its own and sign-ins do not stick. |
| `AI_VISITOR_IMAGE`, `AI_VISITOR_VIDEO`, `AI_VISITOR_TEXT` | No | Most generations one visitor gets per day. Defaults 30, 5, 80. |
| `AI_DAILY_IMAGE`, `AI_DAILY_VIDEO`, `AI_DAILY_TEXT` | No | Most generations the whole site makes per day. Defaults 600, 60, 4000. Zero turns a kind off. |

## Spending caps

Every picture, video, and text call is counted before it reaches xAI: once against the visitor and once against the whole site, per day. A request that could never produce anything is turned away before it is counted, and nothing is counted when the key is missing. Over the cap, the lab says it hit today's limit and the text features fall back to their built-in answers. Counters live in the `ai_usage` table, keyed by a one-day hash of the visitor's address, and rows older than a week are deleted.

## Hosting on Vercel

The build writes Vercel's output format, so a Vercel project linked to this repository deploys with no settings. Three things make it more than a demo:

1. **A database.** Without `DATABASE_URL` the app runs on an in-memory database inside each server instance, so accounts, designs, carts, orders, and the spending counters do not last. Add a Postgres store from the Vercel project's Storage tab and it sets `DATABASE_URL`. Migrations run during the build.
2. **Sign-in.** Set `BETTER_AUTH_URL` to the production origin and `BETTER_AUTH_SECRET` to a long random string. Email and password sign-in then works. The Google and X buttons go through Grok's sign-in broker and only work when the app is published through Grok.
3. **Keys.** `XAI_API_KEY` for the lab and the studio's art tools, and `FOURTHWALL_STOREFRONT_TOKEN` for the real shop.

## Accounts to create

1. **Printful.** Create a store, create a private API token, and note the store id if the token is account-level. Billing on that store pays for fulfillment. Stripe charges the buyer. Printful bills the store wallet when an order is confirmed.
2. **Stripe.** Create a Checkout-enabled account. Use test keys until you are ready to charge cards.
3. **Webhooks.** Put the store owner's sign-in email in `STUDIO_ADMIN_EMAILS`. Signed in as that account, open Orders and choose **Connect webhooks**, or register them yourself. Other accounts cannot rotate the Printful webhook.

   - Printful: `POST https://your-domain/api/webhooks/printful`  
     Events: `order_created`, `order_updated`, `order_failed`, `order_canceled`, `order_put_hold`, `shipment_sent`, `shipment_delivered`, `shipment_canceled`, `mockup_task_finished`.  
     Put the hex secret in `PRINTFUL_WEBHOOK_SECRET`.
   - Stripe: `POST https://your-domain/api/webhooks/stripe`  
     Event: `checkout.session.completed` (and `checkout.session.async_payment_succeeded` if you use delayed methods).  
     Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

`APP_PUBLIC_URL` must be the same public origin Printful and Stripe can reach. Localhost is not enough for live file fetch.

## How printing is wired

Catalog, files, mockups, shipping rates, draft orders, confirmation, and webhooks use [Printful API v2](https://developers.printful.com/docs/v2-beta/). Store sync products are still [API v1](https://developers.printful.com/docs/) (`/store/products`) because v2 does not manage them yet. The provider interface is `PodProvider` in `src/lib/pod/types.ts`. `createPrintfulProvider` is the live client. `createSandboxProvider` is the stand-in. Another printer (Printify, for example) can implement the same interface and be selected from `getPodProvider`.

Orders are created with v2 `POST /v2/orders`, which leaves them in `draft`. `POST /v2/orders/{id}/confirmation` runs only after Stripe reports a paid Checkout session, or after the sandbox test payment. A bad webhook signature is rejected. Replays are ignored.

## Checks

`npm run ci` runs lint, typecheck, the tests with their coverage floors, and the production build.

| Command | What it runs | Needs |
| --- | --- | --- |
| `npm test` | Unit, integration and component tests | Nothing |
| `npm run test:coverage` | The same, and fails under the coverage floors | Nothing |
| `npm run test:browser` | The print-file exporter in real Chromium | Chromium |
| `npm run e2e` | Journeys against the built app, at phone and laptop sizes | Chromium, and `npm run build` first |
| `npm run test:live` | One real call to each outside service that has a key set | Keys. One tiny xAI completion per run |
| `npm run mutation` | Plants bugs in the money code and counts how many the tests catch | A few minutes |

Tests are found by file name, so a new one runs without being registered anywhere.

- `*.test.ts` is a unit test of plain logic.
- `*.int.test.ts` is an integration test. It uses the app's own database handle on in-memory Postgres with every file in `migrations/` applied, and fails on any network request that has no mock. Set `DATABASE_URL` to run the same tests on a real Postgres, after `npm run db:migrate`. Because these tests empty every table, they refuse to start unless that database's name contains `test`.
- `*.dom.test.tsx` is a component test in happy-dom.
- `*.browser.test.ts` runs in Chromium, for code that draws on a canvas.
- `*.live.test.ts` calls the real services and only runs with `LIVE=1`.

Shared pieces live in `src/test/`: the database and request helpers, a stand-in printer, mocked Stripe, Printful, Fourthwall and xAI, and two suites that are run against more than one thing.

- `contracts/order-store.contract.ts` is every rule an order store has to keep. It runs against the in-memory store the unit tests use and the SQL store production uses, so the two cannot drift.
- `contracts/order-lifecycle.model.ts` invents random sequences of payments, replays, printer notices and outages for one order and checks after every step that nothing printed without matching money, no status went backwards, and a charged order always says so.

`e2e/` holds the browser journeys. `E2E_BASE_URL` points them at a deployment instead of the local preview. The journeys that create accounts and orders are skipped there unless `E2E_ALLOW_WRITES=1` is also set, which is only for a disposable deployment in sandbox. They stop on their own if the shop does not show its sandbox badge.

Coverage floors are in `vitest.config.ts`: 90% of lines and 85% of branches on printing, payments, the studio's server code and the AI caps, and 50% overall.

Origin runs the checks through Depot. `.depot/workflows/ci.yml` has four jobs: `verify` (`npm run ci`), `postgres` (the integration tests on Postgres 16), `e2e` (Chromium), and the Grok review. Connect the Depot app from the Origin codebase Apps page, then put `XAI_API_KEY` in Depot if you want the review job. That job skips when the key is missing. It comments on the Origin pull request when `PR_NUMBER` is set and the Origin CLI is signed in, and otherwise leaves the review in the log.

`.depot/workflows/live.yml` runs the live checks and mutation testing nightly and on demand, never on a pull request. It reads `XAI_API_KEY`, `FOURTHWALL_STOREFRONT_TOKEN`, `STRIPE_TEST_SECRET_KEY`, `PRINTFUL_API_KEY` and `PRINTFUL_STORE_ID` from Depot's secrets and skips any service whose key is missing. Stripe is only ever called with a test key.

## Develop

```bash
npm install
npm run dev
npm test
npm run typecheck
```

The dev server is what the preview uses. Do not start Vite on its own.
