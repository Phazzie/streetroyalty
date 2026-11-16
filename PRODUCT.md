# Product

<!-- impeccable:product-schema 1 -->

> Recorded from the owner's answers on 2026-11-16. Lines marked **(derived)** follow from
> those answers but were not said in so many words. Open decisions are labelled.

## Platform

web

## Users

- People who have lived the street life or done time and are trying to do better, and who
  still want to look fly.
- People who go against both what society expects and what the street expects, and do
  their own thing.
- Many of them are not good with technology. Someone who is not techy has to be able to
  make their own gear here and express themselves.

## Product Purpose

Street Royalty is a clothing label and a make-your-own-clothes shop. The owner is building
it for a friend who wants to do clothes, and it has to be uniquely his.

The heart of it is a high-powered, deeply customizable print-on-demand studio. Not
graphics on a shirt: actual clothes that are eclectic, weird and fashionable. If someone
wants to clash, they can.

Success means two things. A person with no design or tech skill leaves with a piece that
is theirs and looks like nobody else's. And the label's own pieces exist as real garments.

## Positioning

Custom clothes at the level of the garment, its colours, panels and patterns, for people
who do not dress by anybody's rules. **(derived wording)**

## Operating Context

- **Studio.** The core of the product. Today it places art and type on a blank and prints
  through Printful, paid through Stripe.
- **Shop.** The label's own drop. Products come from the owner's Fourthwall shop, which
  takes payment, prints and ships.
- **Outfit Lab.** Lock a face, describe pieces by voice or text, put them on, walk the
  look, share a drop card.
- **Rack.** Customs that people published from the studio.
- Everything is made to order. There is no stock.
- Pictures and video are generated with xAI and each one costs money, so paid actions ask
  first and every visitor has a daily allowance.

## Capabilities and Constraints

- **Known gap.** The studio today is art on a blank tee, hoodie, hat or crewneck. That is
  the "graphics on a shirt" the owner does not want to stop at.
- **Open decision.** How garment-level customizing works (colours per panel, patterns,
  trims) and which maker or makers produce it.
- **Open decision.** Whether people get their own profile that others can follow. The
  owner raised it as a maybe.
- With no Fourthwall token the shop shows a labelled preview drop that cannot be bought.
- With no Printful or Stripe keys the studio runs in sandbox and says so.
- Sign-in, saved designs, carts and orders need a database.
- The "Created with Grok" badge and Grok's platform files stay in place (see `AGENTS.md`).
- Vocabulary in use: the drop, the lab, the studio, the rack, the crown, a look, a piece,
  the bag.

## Brand Commitments

- Name: Street Royalty. Mark: a crown, drawn in code (`src/components/site/shell.tsx`).
- It has to be uniquely the founder's. **Open decision:** his taste has not been captured
  yet. He needs to be asked.
- The colour-blocked sweatsuits in the site's pictures are the first pieces he wants made
  for real: lilac with cream panels and orange piping, and mint with peach panels and
  blue piping (`public/brand/prod-*-hoodie.webp`, `prod-*-jogger.webp`).
- mkbhd.com is not a reference. Fourthwall came up while the owner was looking for good
  print on demand, and is not binding.

## Evidence on Hand

- Every brand and product picture in `public/brand/` is generated. No real garment
  exists yet.
- No customers, reviews, press, sales figures or founder story are on record. Future work
  must not invent them, and the founder's personal story is his to tell.

## Product Principles

1. Make clothes, not merch.
2. No rules about what goes together. The tool never corrects someone's taste.
3. Easy enough for someone who does not do tech. **(derived)**
4. Nothing generated is passed off as real. Previews say they are previews.
5. Anything that costs money asks first.

## Accessibility & Inclusion

No standard has been set. From the audience: plain words, few steps, big touch targets,
and it has to work on a phone. **(derived)** The site already works with motion reduced,
with WebGL off and with script off.
