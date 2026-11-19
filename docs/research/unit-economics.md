# Street Royalty unit economics: AOP tracksuit

All sources were checked on **2026-11-19**. **[UNCONFIRMED]** marks a figure that comes only from a third party, a search snippet, or my own reading of an undocumented field.

## 1. Printful costs

**Base prices** (re-checked against the live Printful API: [v1 /products](https://api.printful.com/products/388), [v2 prices, north_america](https://api.printful.com/v2/catalog-products/388/prices?currency=USD&selling_region_name=north_america)):

| Product (ID) | XS–XL list | Largest size | v2 `discounted_price` (XS–XL) |
|---|---|---|---|
| AOP Recycled Hoodie (388) | $41.56 (2XS $40.75) | 6XL $51.56 | $36.01 |
| AOP Recycled Joggers (400) | $39.48 | 3XL $43.48 | $31.89 |
| AOP Recycled Track Jacket (801) | $62.41 | 6XL $72.41 | $55.62 |

- The brief's numbers hold for the **North America** selling region. In the Europe and worldwide regions, list prices are higher: hoodie $45.25, joggers $40.50, jacket $69.25 ([v2, worldwide](https://api.printful.com/v2/catalog-products/388/prices?currency=USD)).
- There is **no AOP placement surcharge**. All 8 hoodie placements (front, back, sleeves, hood, pocket, labels) return `price: 0.00` in the same v2 response. The "AOP premium" is already in the base price.
- **[UNCONFIRMED]** `discounted_price` is probably the Printful Growth member price, 11–19% below list. Printful does not document the field ([v2 docs](https://developers.printful.com/docs/v2-beta/)).

**Printful Growth** costs $24.99/mo with a 14-day trial. It gives "up to 33% off" products and 25% off samples (the Free plan gives 20% off samples). It becomes free for a year once yearly sales reach $12K ([printful.com/plans](https://www.printful.com/plans), [pricing-updates](https://www.printful.com/pricing-updates)). Printful does not publish a per-product AOP discount. If the API figures are Growth prices, one hoodie+joggers set saves $13.14, so the plan pays for itself at about 2 sets a month.

**Flat shipping** for AOP hoodies, joggers and jackets ([printful.com/shipping](https://www.printful.com/shipping)):

| Region | 1st item | Each additional |
|---|---|---|
| USA | $8.29 | +$2.50 |
| Canada | $9.79 | +$2.35 |
| EU / UK | $7.29 | +$2.40 |
| AU/NZ | $12.49 | +$2.25 |
| Worldwide | $17.69 | +$8.00 |

US orders carry an extra **$0.40 surcharge from Oct 15, 2026 to Jan 17, 2027** (same page).

**Fulfillment time:** 2–5 business days of production, then 3–4 business days of standard shipping in the US/CA, or 5–20 business days internationally. Express is 1–3 days (same page). **[UNCONFIRMED]** AOP cut-and-sew may run slower than the general range; I found no official AOP-specific figure.

**Tax:**
- **US:** Printful charges US sales tax on its invoice, based on the delivery address, unless you file a resale certificate for that state.
- **EU:** On EU-fulfilled orders to EU addresses, Printful charges destination VAT unless you have a VAT ID. It calculates VAT on Printful's price, not on your retail price ([help.printful.com: sales tax](https://help.printful.com/hc/en-us/articles/360014009920-How-does-sales-tax-affect-me), [VAT](https://help.printful.com/hc/en-us/articles/360014008360-What-is-VAT)).
- **Implication:** Street Royalty is the seller, so it must register and file resale certificates. Otherwise tax is paid twice: once to Printful and again when collected from the customer.

**Returns:** Printful reprints or refunds **misprints, damage, defects and lost parcels** if reported within 30 days of delivery, with a photo. It does **not** cover wrong size, wrong color or buyer's remorse ([help.printful.com](https://help.printful.com/hc/en-us/articles/360014006840-What-is-Printful-s-return-and-refund-policy)).

## 2. Stripe fees

Source: [stripe.com/pricing](https://stripe.com/pricing) and [stripe.com/connect/pricing](https://stripe.com/connect/pricing).

**Payments and tax:**
- **Cards:** 2.9% + 30¢. International cards add +1.5%, and currency conversion adds +1%.
- **Disputes:** $15 per dispute. A further $15 applies if you counter it, refunded only if you win.
- **Refunds:** the original processing fee is **not** returned.
- **Stripe Tax:** Basic is $0.50 per transaction over the API (10 calculations included), or 0.5% for no-code. Tax Complete starts at $90/mo.

**Connect:**

| Model | Platform pays |
|---|---|
| **Stripe handles pricing** (classic Standard, or Express with `fees[payer]=account`) | Nothing extra. The maker's account pays processing fees. |
| **You handle pricing** (classic Express/Custom) | **$2 per monthly active account**, **0.25% + 25¢ per payout**, 1% for Instant Payouts, cross-border payouts from 0.25%, and 1099s at $2.99 (IRS e-file) + $1.49 (state) |

- **New since 2026-06-24:** Express accounts can now use Stripe-owned pricing, and Stripe can absorb negative balances (`losses[payments]=stripe`) ([changelog](https://docs.stripe.com/changelog/dahlia/2026-06-24/express-connected-accounts-v1-stripe-owned-pricing-negative-balance-liability)).
- **What fits us:** Street Royalty takes the money and pays Printful, so it is the merchant of record. That means destination charges or separate charges and transfers, which falls under **"you handle pricing."** Plan for $2 per maker for each month they get paid, plus about 25¢ per payout. Batch payouts monthly with a minimum threshold, or a maker with one $9 sale costs the platform about a quarter of its cut.

## 3. Comparable retail

| Item | Price | Source |
|---|---|---|
| Same Printful AOP recycled hoodie, indie shop | $57.50–59.50 | [distroondemand.com](https://distroondemand.com/product/all-over-print-recycled-unisex-hoodie/) |
| Same hoodie, WIL Style | $49.99 (sale $42.99) | [wilstyle.com](https://wilstyle.com/en-usd/products/all-over-print-recycled-unisex-hoodie-wil-style-2) |
| Fourthwall AOP recycled zip hoodie | $49.95 (the page doesn't label it; possibly a creator base cost) **[UNCONFIRMED]** | [products.fourthwall.com](https://products.fourthwall.com/all-over-print-recycled-unisex-zip-hoodie-all-over-print) |
| Boohoo printed tracksuits (fast fashion) | $90–117 regular, heavily discounted | [us.boohoo.com](https://us.boohoo.com/buy/printed-tracksuits) |
| Etsy custom sublimated tracksuit set | $87.73 **[UNCONFIRMED, search snippet]** | [etsy.com](https://www.etsy.com/market/tracksuit_print) |
| adidas AOP track top | $90 **[UNCONFIRMED, snippet; page returned 403]** | [adidas.com](https://www.adidas.com/us/mv-allover-print-track-top/IU3958.html) |
| Sp5der hoodies (hype streetwear) | $200–240 retail **[snippet]** | [StockX](https://stockx.com/en-gb/sp5der-sp555-zip-hoodie-black) |
| Trapstar chenille tracksuit | $215 retail **[snippet]** | [StockX](https://stockx.com/ja-jp/trapstar-decoded-chenille-hooded-tracksuit-grey-green) |

**Read:**
- Shops selling the identical Printful hoodie price it at **$43–60**, which leaves them only $1–18 of margin.
- Mass-market printed sets sell for about $90–117.
- Brand-led streetwear sells for $200+.

## 4. How other creator platforms split revenue

| Platform | Model | Source |
|---|---|---|
| Fourthwall | **0% platform fee on physical goods**. The creator pays card processing of 2.9% + 30¢ (3.9% international), charged on the total *including shipping and tax*. Fourthwall's margin is inside the base cost. | [help.fourthwall.com](https://help.fourthwall.com/frequently-asked-questions/payments-and-pricing/transaction-fees) |
| Bonfire | "100% free". Profit = price − base cost. | [help.bonfire.com](https://help.bonfire.com/en/articles/1614156-pricing-fees) |
| Spring | Fee built into base cost; creator keeps price − base. **[UNCONFIRMED, third-party]** | [ecommerce-platforms.com](https://ecommerce-platforms.com/articles/best-teespring-alternatives) |
| Redbubble | Artist sets a markup over a base that includes Redbubble's fee. The 20% default and the 5% Standard-tier account fee are **[UNCONFIRMED]**; the $150/mo fee cap is official. | [help.redbubble.com](https://help.redbubble.com/hc/en/articles/202270799) |
| Printify | A supplier, not a revenue-share platform. Premium is $39/mo (from Feb 17, 2026), or $299/yr, for about 20% off. | [help.printify.com](https://help.printify.com/hc/en-us/articles/42641734110225) |

**Pattern:** none of them advertise a revenue split. They mark up the base cost and leave the creator "100%" of the rest. Fourthwall has said in other material that its base-cost markup is not published ([makeinfluence](https://www.makeinfluence.com/en/academy/fourthwall-vs-spring-how-creator-merch-platforms-work-and-what-they-mean-for-brand-deals)) **[UNCONFIRMED]**.

## 5. Worked unit economics (US order, size S–XL, Printful Free-plan list price)

**Assumptions:**
- The customer pays shipping at Printful's cost ($8.29 for one item, $10.79 for a set), so shipping nets to zero apart from the Stripe fee on it.
- Sales tax passes through: Stripe Tax is $0.50, and the 2.9% fee on the tax amount is ignored.
- **The 3% reserve for remakes and disputes is my assumption, not a sourced figure.**
- The split is 70% maker / 30% platform of net margin. The platform pays Connect's 0.25%. The $2/mo and 25¢ fixed Connect fees are not included.

| Item | Retail | Printful | Stripe | Tax + reserve | **Net margin** | **Maker 70%** | **Platform 30%** |
|---|---|---|---|---|---|---|---|
| Hoodie | $59 | 41.56 | 2.25 | 2.27 | **$12.92** (22%) | $9.04 | $3.85 |
| Hoodie | **$69** | 41.56 | 2.54 | 2.57 | **$22.33** (32%) | **$15.63** | **$6.66** |
| Hoodie | $79 | 41.56 | 2.83 | 2.87 | **$31.74** (40%) | $22.22 | $9.47 |
| Joggers | $55 | 39.48 | 2.14 | 2.15 | **$11.23** (20%) | $7.86 | $3.35 |
| Joggers | **$65** | 39.48 | 2.43 | 2.45 | **$20.64** (32%) | **$14.45** | **$6.16** |
| Joggers | $75 | 39.48 | 2.72 | 2.75 | **$30.05** (40%) | $21.04 | $8.96 |
| Set | $109 | 81.04 | 3.77 | 3.77 | **$20.42** (19%) | $14.29 | $6.09 |
| Set | **$125** | 81.04 | 4.24 | 4.25 | **$35.47** (28%) | **$24.83** | **$10.58** |
| Set | $145 | 81.04 | 4.82 | 4.85 | **$54.29** (37%) | $38.00 | $16.19 |

If the API `discounted_price` really is the Growth price, net margin rises by **$5.55** on a hoodie, **$7.59** on joggers and **$13.14** on a set. A $125 set would then net about $48.61.

## 6. Recommendation

**Default prices:**
- Hoodie **$69**, joggers **$65**, hoodie+joggers set **$125**. The set is $9 below buying both separately, which gives a reason to buy the bundle.
- Track jacket about **$99**: roughly $30 net at the US list price, by the same arithmetic.

**Why these prices:**
- $69 is above the $43–60 plain Printful resellers. That is defensible because each piece is a maker-branded design.
- It stays well under mass-market sets ($90–117) and hype brands ($200+).
- Below about $60 per piece, the net margin (about $11–13) is too thin to survive one remake.

**Split: 70% maker / 30% platform, of net margin** (retail − Printful − Stripe − tax fee − reserve). Show it to the maker in Fourthwall style: "your profit: $15.63", plus a transparent breakdown.
- Splitting margin rather than gross means makers who raise prices earn proportionally more, and the platform never loses money on a sale.
- Set a **floor price per SKU** so net margin can't fall below about $12. That blocks the $55 joggers case.
- Makers can set any price above the floor.

**Platform must-dos:**
- Subscribe to Growth once volume passes about 2 sets a month.
- File resale certificates.
- Batch maker payouts monthly with a minimum payout.
- Use Stripe Tax at $0.50 per transaction.

## 7. Risks and how they hit margin

**Wrong size or remorse returns.** Printful won't cover them, so an exchange costs a full remake plus shipping: **$49.85** for a hoodie, more than 2 hoodies' net margin.
- Mitigation: sell custom items as final sale for size and remorse, show a prominent size chart, and maybe offer one paid exchange.

**Misprints and lost parcels.** Printful covers these within 30 days. The cost is support time plus delay, not cash, as long as photos are filed in time.

**Chargebacks.** A lost dispute on a $69 hoodie costs about **$67**: $41.56 + $8.29 shipping + $2.54 unrecoverable Stripe fee + $15 dispute fee. That is roughly 3 hoodies' net margin, or 10 sales of platform revenue.
- Mitigation: hold maker earnings 14–30 days (assumption) so they can be clawed back. Use Radar and 3DS. Make sure the merchant name on card statements is recognizable.

**International orders.**
- Shipping outside US/EU/UK/CA/AU costs $17.69 for the first item, plus $8 per additional item.
- Stripe adds +1.5% for international cards, plus +1% for currency conversion.
- EU orders: Printful charges VAT unless you have a VAT ID. Selling B2C in the EU likely means registering for EU VAT OSS **[UNCONFIRMED, needs a tax advisor]**.
- Who pays customs duties on non-EU fulfillment: **[UNCONFIRMED]**.
- Mitigation: price international shipping at cost and launch US-first. Add EU once VAT registration is settled; Printful makes this hoodie in Latvia as well ([product spec](https://api.printful.com/v2/catalog-products/388)).

**Holiday surcharge and slower AOP production.** Peak season delivery can stretch past 2 weeks. That drives "where's my order" disputes.
