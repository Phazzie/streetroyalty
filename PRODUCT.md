# Product

<!-- impeccable:product-schema 1 -->

> Drafted from the repository on 2026-11-16 at the owner's request, without an interview.
> Lines marked **(unconfirmed)** are read from the code and copy, not stated by the owner.

## Platform

web

## Users

- People shopping a streetwear drop, mostly on a phone. The site installs to a home screen
  and the installed app opens on the Outfit Lab. **(unconfirmed that phone is the main case)**
- People who want to play with an outfit on their own face before they buy.
- People who want their own art on a real garment.
- **Open decision:** who the core customer is and where they come from. Not established.

## Product Purpose

Street Royalty is a streetwear label's own site. It sells the label's drop, lets a visitor
wear pieces on themselves and walk the look, and lets them design and order a custom piece.

Success means a visitor leaves with something: a bag taken to checkout, a look worth
sharing, or a custom they made.

## Positioning

A brand shop where the fitting room and the print shop are part of the store. A visitor
can try the drop on their own face, see it walk, and print their own piece, all before
paying. **(unconfirmed wording)**

## Operating Context

- **Shop.** Products, prices, sizes and stock come from the owner's Fourthwall shop.
  Fourthwall takes the payment, prints and ships. The bag lives in the browser.
- **Outfit Lab.** Lock a face, describe pieces by voice or text, put them on, walk the look
  in a scene, share a drop card.
- **Studio.** Pick a blank, place art and type, see a mockup, publish to the rack, check
  out. Customs are printed through Printful and paid through Stripe.
- **Rack.** Published customs from the studio.
- Pictures and video are generated with xAI and each one costs money, so paid actions ask
  first and every visitor has a daily allowance.

## Capabilities and Constraints

- With no Fourthwall token the shop shows a labelled preview drop that cannot be bought.
- With no Printful or Stripe keys the studio runs in sandbox and says so.
- Sign-in, saved designs, carts and orders need a database.
- The "Created with Grok" badge and Grok's platform files stay in place (see `AGENTS.md`).
- Vocabulary in use: the drop, the lab, the studio, the rack, the crown, a look, a piece,
  the bag.

## Brand Commitments

- Name: Street Royalty. Mark: a crown, drawn in code (`src/components/site/shell.tsx`).
- Voice in the copy today: short, plain, confident. No hype words. **(unconfirmed as a rule)**
- The owner named mkbhd.com and fourthwall.com as sites to build on. Fourthwall is the
  commerce engine. What should be taken from mkbhd.com is an **open decision**.

## Evidence on Hand

- Brand and product pictures in `public/brand/` are generated images, not photographs of
  real garments.
- No customers, reviews, press, sales figures or founder story are on record. Future work
  must not invent them.

## Product Principles

1. Play comes before the purchase. The lab and the studio are reasons to visit, not extras.
2. Nothing generated is passed off as real. Previews say they are previews.
3. Anything that costs money asks first.
4. The owner's shop is the source of truth for what is for sale.

## Accessibility & Inclusion

No standard has been set. What the site does today: it works with motion reduced, with
WebGL off and with script off, and keeps touch targets at phone size.
