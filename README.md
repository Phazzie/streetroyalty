# Street Royalty

Street Royalty is an outfit lab and a print shop. The lab still locks a face, builds pieces by voice, and walks a look. The studio turns a design into a real garment: pick a blank, place art and type, preview a mockup, publish it, and check out. Paid orders are sent to print. Unpaid orders stay drafts.

## Studio

- **Studio** (`/studio`) — product, color, size, placement (front, back, sleeve when the blank allows it), text, upload, drag, scale, rotate, mockup, save, publish, cart.
- **Gallery** — your saved pieces, grouped by collection.
- **Shop** — published pieces, size picker, add to cart.
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
| `DATABASE_URL` | Deploy | Postgres connection. Injected on deploy. Unset in local preview. |

## Accounts to create

1. **Printful.** Create a store, create a private API token, and note the store id if the token is account-level. Billing on that store pays for fulfillment. Stripe charges the buyer. Printful bills the store wallet when an order is confirmed.
2. **Stripe.** Create a Checkout-enabled account. Use test keys until you are ready to charge cards.
3. **Webhooks.** In the app, signed in, open Orders and choose **Connect webhooks**, or register them yourself.

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

## Develop

```bash
npm install
npm run dev
npm test
npm run typecheck
```

The dev server is what the preview uses. Do not start Vite on its own.
