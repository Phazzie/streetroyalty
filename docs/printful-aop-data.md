# Printful AOP catalog data (task C2)

Pulled 2026-11-19 for products 388 (AOP hoodie), 400 (AOP joggers) and 801 (AOP track jacket).
The first pass used the public v1 API with no key. The section right below was added the same day
with the owner's `PRINTFUL_API_KEY`, and it **supersedes every UNCONFIRMED note further down**.
Every number names the response it came from.

## Confirmed with the API key (v2 catalog, 2026-11-19)

Sources: `GET /v2/catalog-products/{id}`, `/v2/catalog-products/{id}/catalog-variants`
(`placement_dimensions`), and `/v2/catalog-products/{id}/mockup-templates` (template images with
the cut lines). The key is account-level and the account has **no store yet**, so the older
`/mockup-generator/printfiles` and `/mockup-generator/templates` endpoints refuse with "This
endpoint requires `store_id`". The v2 endpoints don't need one.

- **v2 variant ids are the same as the v1 ids** listed further down (10869–10875 and 18730–18733,
  11033–11039, 20370–20380).
- **Print sizes are the same for every size of a garment.** Printful scales the cut to the size
  itself. At 150 DPI:

| Product | Placement keys (v2) | Print size per placement | Pixels at 150 DPI | Printfile id |
| --- | --- | --- | --- | --- |
| 388 hoodie | `front`, `back`, `sleeve_left`, `sleeve_right`, `pocket`, `hood`, `label_panel` | 40 × 40 in | 6000 × 6000 | 200 |
| 388 hoodie | `label_inside` | 2.5 × 1 in | 375 × 150 | 64 |
| 400 joggers | `leg_left`, `leg_right` | 33 × 50 in | 4950 × 7500 | 213 |
| 400 joggers | `label_inside` | 2.5 × 1 in | 375 × 150 | 64 |
| 801 jacket | `front`, `back`, `sleeve_left`, `sleeve_right`, `details`, `pocket` | 44 × 46 in | 6600 × 6900 | 693 |
| 801 jacket | `label_inside` / `label_outside` | 2.5 × 1 in / 3 × 3 in | 375 × 150 / 450 × 450 | 64 / 400 |

### What is actually inside each file (read off the template images)

Solid lines on a template are cut lines, and dashed lines are the safe area. The files are listed
in mockup-templates with `role: "template"`, and each `image_url` is on `files.cdn.printful.com`.

**Hoodie (388).** Eight files, with **no side panels and no piping anywhere**:
- `front`: the front body, plus the front half of the waistband (a folded band, drawn below it).
  The safe area has a cut-out where the kangaroo pocket covers the body.
- `back`: the back body, plus the back half of the waistband.
- `sleeve_left` / `sleeve_right`: one sleeve, plus its cuff (the rectangle below it).
- `hood`: four pieces, the outer left and right and the lining left and right. The hood is double
  lined and printed on both sides.
- `pocket`: the kangaroo pocket.
- `label_panel`: a small curved panel at the back neck. `label_inside` is the printed neck label.

**Joggers (400).** Two files, one per leg. Each leg is **one piece that wraps the whole leg**, front and
back together. The waistband half is the strip across the top, and the cuff is the rectangle below.
There is **no separate seat, back or pocket piece**. The pockets are in the side seams and aren't
printed on their own.

**Track jacket (801).** Six files:
- `front`: two front halves split by the zip, a collar piece, two narrow pieces at the far left and
  right (unlabelled on the template; they look like under-arm or side pieces), and two hem bands.
- `back`: the back body, a collar piece, and the back hem band.
- `sleeve_left` / `sleeve_right`: one sleeve, plus its cuff.
- `details`: a collar piece and the two zip facings.
- `pocket`: four pocket-bag pieces.

The jacket is the only garment with real side pieces. **None of the three has piping.**

### Template geometry

Template images are 3000 × 3000 units (labels 560 × 560). The printable area inside each one
(`print_area_left/top/width/height`) is:
- hoodie `front` 182/−14/2636×2636 and `back` 180/0/2640×2633; the hoodie's other files cover the
  full 3000×3000;
- each jogger leg 510/0/1978×3000;
- every main jacket file 122/59/2756×2882.

Map that rectangle onto the print file's pixel size to place artwork.

## What the public API gives without a key

| Endpoint | Status | Notes |
|---|---|---|
| `GET https://api.printful.com/products/{388,400,801}` | 200 | Product, description, options, file placements, variants with price and stock. Main source for this doc. |
| `GET https://api.printful.com/products/variant/{id}` (checked 10871, 11035, 20373) | 200 | Same variant data, one at a time. |
| `GET https://api.printful.com/products/{388,400,801}/sizes` | 200 | Size guide tables in inches. |
| `GET https://api.printful.com/mockup-generator/printfiles/{id}` (also with `?technique=CUT-SEW`) | 401 `Unauthorized` | Needs a token. This is the call that returns print-file width, height and DPI. |
| `GET https://api.printful.com/mockup-generator/templates/{id}` | 401 | Needs a token. Mockup template ids and print-area offsets. |
| `GET https://api.printful.com/v2/catalog-products/{id}` and `/catalog-variants`, `/mockup-templates`, `/mockup-styles`, `/sizes`, `/prices`, `/availability` | 401 "This endpoint requires Oauth authentication!" | Every v2 catalog call needs a token. |
| `GET https://api.printful.com/v2/catalog-variants/10871` (and `/prices`, `/availability`) | 401 | Same. |
| `GET https://api.printful.com/v2/catalog-products`, `/v2/catalog-categories`, `/v2/mockup-tasks` | 401 | Same. |
| `GET https://api.printful.com/shipping/rates` | 401 | Not needed here. |

The public product pages (URLs in `src/lib/pod/aop-printful.ts`) and
`https://www.printful.com/custom/product/388` publish no print-file sizes, placements or template
downloads. Their only DPI figure is in a buyer review, not in a spec.

Raw JSON used here is saved outside the repo in
`/tmp/claude-0/-home-user-streetroyalty/0b113d1e-17da-5748-9186-e981b94bc095/scratchpad/printful/`
(`v1-products-*.json`, `ep-products_*_sizes.json`, `ep-products_variant_*.json`, and the 401 bodies).

## DPI and file format (all three products)

- **150 DPI minimum.** Printful's graphics guide says: "All files must be at least 300 DPI for paper prints and 150 DPI for everything else." It also says to avoid going over 600 DPI or under 150 DPI. Source: https://www.printful.com/graphics-and-embroidery-guide
- **Format.** The same guide says: "For all-over print (AOP), sublimation printing, and paper printing, JPG files work better." It says to use the sRGB color profile. https://www.printful.com/creating-aop-file says to use PNG or JPEG, JPEG when the design covers the whole product, and to keep key graphics inside the safe zone so they don't end up in seams.
- **Per-printfile DPI is UNCONFIRMED.** The printfiles response carries a `dpi` field for each printfile. Needs a key: `GET /mockup-generator/printfiles/{id}?technique=CUT-SEW`.

## Product 388: All-Over Print Recycled Unisex Hoodie

Source for this section unless noted: `GET https://api.printful.com/products/388`.

- `type` `CUT-SEW`. Technique `CUT-SEW`, shown as "All-over synthetic", the default. `main_category_id` 28. `is_discontinued` false. `variant_count` 11.
- **Fabric (from the API description):**
  - 96% recycled polyester, 4% elastane for manufacturing in the US/Mexico
  - 95% recycled polyester, 5% elastane for manufacturing in Latvia
  - Fabric weight 9.08 oz./yd.² (308 g/m²), may vary by 5%
  - Soft cotton-feel fabric face, brushed fleece inside
  - Double-lined hood with design on both sides
  - Drawstrings, overlock seams
  - Blank components: Mexico production sourced from Poland and Mexico, EU production from China and Poland
  - The API's disclaimer: where the fabric is double-layered (like pockets), the inner layer may show through, especially with light designs.
- **Options:**
  - `stitch_color` "Drawcord & Stitch color", radio: `white` or `black`, no extra price
  - `notes` "Printing notes", text
  - `license_type`, multi-select for licensing programs (not relevant here)

### Placements (v1 `files`)

| v1 file `id` | v1 `type` | Title |
|---|---|---|
| `default` | `front` | Front print |
| `back` | `back` | Back print |
| `sleeve_right` | `sleeve_right` | Right sleeve |
| `sleeve_left` | `sleeve_left` | Left sleeve |
| `pocket` | `pocket` | Pocket |
| `hood` | `hood` | Hood |
| `label_panel` | `label_panel` | Label panel |
| `label_inside` | `label_inside` | Inside label |
| `preview` | `mockup` | Mockup |

No placement has an `additional_price`. The v2 placement key strings are **UNCONFIRMED**. Needs a key: `GET /v2/catalog-products/388` (its `placements` list).

### Variants

All variants are color "White" (`#ffffff`), the undyed base the print goes on. All are `in_stock` in the EU, EU_LV (Latvia) and US regions. Price is v1 `price` in USD.

| Size | Variant ID | Price (USD) | v1 variant name |
|---|---|---|---|
| 2XS | 18730 | 40.75 | All-Over Print Recycled Unisex Hoodie (White / 2XS) |
| XS | 10869 | 41.56 | All-Over Print Unisex Hoodie (XS) |
| S | 10870 | 41.56 | All-Over Print Unisex Hoodie (S) |
| M | 10871 | 41.56 | All-Over Print Unisex Hoodie (M) |
| L | 10872 | 41.56 | All-Over Print Unisex Hoodie (L) |
| XL | 10873 | 41.56 | All-Over Print Unisex Hoodie (XL) |
| 2XL | 10874 | 43.56 | All-Over Print Unisex Hoodie (2XL) |
| 3XL | 10875 | 45.56 | All-Over Print Unisex Hoodie (3XL) |
| 4XL | 18731 | 47.56 | All-Over Print Recycled Unisex Hoodie (White / 4XL) |
| 5XL | 18732 | 49.56 | All-Over Print Recycled Unisex Hoodie (White / 5XL) |
| 6XL | 18733 | 51.56 | All-Over Print Recycled Unisex Hoodie (White / 6XL) |

The from-price of USD 40.75 in `aop-printful.ts` is the 2XS price. XS to XL cost 41.56.

### Size guide (product measured flat, inches)

Source: `GET https://api.printful.com/products/388/sizes`. A = 1/2 chest width, B = length, C = sleeve length.

| | 2XS | XS | S | M | L | XL | 2XL | 3XL | 4XL | 5XL | 6XL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 18.90 | 19.69 | 20.47 | 21.26 | 22.83 | 24.41 | 25.98 | 27.56 | 29.13 | 30.71 | 32.28 |
| B | 26.18 | 26.19 | 26.77 | 27.36 | 27.95 | 28.54 | 29.13 | 29.72 | 30.91 | 32.09 | 33.27 |
| C | 22.24 | 22.24 | 22.64 | 23.03 | 23.62 | 24.21 | 24.80 | 25.39 | 25.79 | 26.18 | 26.57 |

The size guide says items "may vary by up to 1"" because they are made by hand. These are garment sizes, **not print-file sizes**.

### Print areas and templates: UNCONFIRMED

Width × height in px and DPI per placement (front, back, sleeve_left, sleeve_right, pocket, hood, label_panel, label_inside) are **UNCONFIRMED**. Needs a key: `GET /mockup-generator/printfiles/388?technique=CUT-SEW`. It returns `printfiles[]` (`printfile_id`, `width`, `height`, `dpi`, `fill_mode`, `can_rotate`) and `variant_printfiles[]` (variant_id → placement → printfile_id). AOP print files can differ by size, so read the mapping for every variant.

Mockup template IDs are **UNCONFIRMED**. Needs a key: `GET /v2/catalog-products/388/mockup-templates` or `GET /mockup-generator/templates/388`.

## Product 400: All-Over Print Recycled Men's Joggers

Source: `GET https://api.printful.com/products/400`.

- `type` `CUT-SEW`. Technique `CUT-SEW`, "All-over synthetic", the default. `variant_count` 7. `is_discontinued` false.
- **Fabric (from the API description):**
  - 96% recycled polyester, 4% elastane for manufacturing in the US/Mexico
  - 95% recycled polyester, 5% spandex for manufacturing in Latvia
  - 9.08 oz./yd.² (308 g/m²), may vary by 5%
  - Soft cotton-feel fabric face, brushed fleece inside
  - Slim fit, cuffed legs, "practical pockets"
  - Elastic waistband with a **white** drawstring
  - Blank components sourced from China
  - The same double-layer (pockets) disclaimer as the hoodie
- **Options:**
  - `stitch_color` "Stitch color", radio: `white` or `black`
  - `notes`
  - `license_type`

### Placements (v1 `files`)

| v1 file `id` | v1 `type` | Title |
|---|---|---|
| `right_leg` | `leg_right` | Right leg |
| `left_leg` | `leg_left` | Left leg |
| `label_inside` | `label_inside` | Inside label |
| `preview` | `mockup` | Mockup |

The file `id` and `type` differ here (`left_leg` vs `leg_left`). There is **no** pocket, waistband, back or cuff placement. Those parts get their print from the two leg files. How the leg print file maps onto the pocket, waistband and cuff pieces is **UNCONFIRMED**: see the printfile and template for 400. The v2 placement keys are **UNCONFIRMED**. Needs a key: `GET /v2/catalog-products/400`.

### Variants

All White, in stock in EU, EU_LV and US.

| Size | Variant ID | Price (USD) |
|---|---|---|
| XS | 11033 | 39.48 |
| S | 11034 | 39.48 |
| M | 11035 | 39.48 |
| L | 11036 | 39.48 |
| XL | 11037 | 39.48 |
| 2XL | 11038 | 41.48 |
| 3XL | 11039 | 43.48 |

The v1 variant names still read "All-Over Print Men's Joggers ({size})". There is no 2XS or 4XL to 6XL, so a hoodie or jacket in 2XS or 4XL to 6XL has no matching jogger size.

### Size guide (flat, inches)

Source: `GET https://api.printful.com/products/400/sizes`. A = 1/2 waist width, B = front rise, C = side length, D = 1/2 cuff width.

| | XS | S | M | L | XL | 2XL | 3XL |
|---|---|---|---|---|---|---|---|
| A | 13.39 | 14.17 | 14.96 | 16.54 | 18.11 | 19.96 | 21.26 |
| B | 11.81 | 12.20 | 12.60 | 12.99 | 13.39 | 13.78 | 14.17 |
| C | 37.80 | 38.19 | 38.58 | 38.98 | 39.37 | 39.76 | 40.16 |
| D | 4.92 | 5.12 | 5.31 | 5.51 | 5.51 | 5.71 | 5.91 |

### Print areas and templates: UNCONFIRMED

Needs a key: `GET /mockup-generator/printfiles/400?technique=CUT-SEW` for px and DPI per leg and per variant. Template IDs need `GET /v2/catalog-products/400/mockup-templates`.

## Product 801: All-Over Print Recycled Unisex Track Jacket

Source: `GET https://api.printful.com/products/801`.

- `type` `CUT-SEW`. Technique `CUT-SEW`, "All-over synthetic", the default. `variant_count` 11. `is_discontinued` false.
- **Fabric (from the API description):**
  - 96% recycled polyester, 4% elastane for manufacturing in the US/Mexico
  - 95% recycled polyester, 5% elastane for manufacturing in Latvia
  - 9.08 oz./yd.² (308 g/m²)
  - Soft cotton-feel fabric face, brushed fleece inside
  - Relaxed unisex fit, "premium-quality zippers", zippered pockets
  - Recycled content certified under GRS (Global Recycled Standard)
  - Blank components sourced from China and the US
- **Options:**
  - `stitch_color` "Zipper & Stitch color", radio: `white` or `black`
  - `notes`
  - `license_type`

### Placements (v1 `files`)

| v1 file `id` | v1 `type` | Title |
|---|---|---|
| `default` | `front` | Front print |
| `back` | `back` | Back print |
| `sleeve_left` | `sleeve_left` | Left sleeve |
| `sleeve_right` | `sleeve_right` | Right sleeve |
| `details` | `details` | Details |
| `pocket` | `pocket` | Pocket |
| `label_inside` | `label_inside` | Inside label |
| `label_outside` | `label_outside` | Outside label |
| `preview` | `mockup` | Mockup |

Which jacket pieces "Details" covers (collar, cuffs, hem or zipper facing) is **UNCONFIRMED**. Its printfile and template would show it: `GET /mockup-generator/printfiles/801?technique=CUT-SEW` and `GET /mockup-generator/templates/801`.

### Variants

All White, in stock in EU, EU_LV and US.

| Size | Variant ID | Price (USD) |
|---|---|---|
| 2XS | 20370 | 62.41 |
| XS | 20371 | 62.41 |
| S | 20372 | 62.41 |
| M | 20373 | 62.41 |
| L | 20374 | 62.41 |
| XL | 20375 | 62.41 |
| 2XL | 20376 | 64.41 |
| 3XL | 20377 | 66.41 |
| 4XL | 20378 | 68.41 |
| 5XL | 20379 | 70.41 |
| 6XL | 20380 | 72.41 |

### Size guide (flat, inches)

Source: `GET https://api.printful.com/products/801/sizes`. A = 1/2 chest width, B = length, C = sleeve length.

| | 2XS | XS | S | M | L | XL | 2XL | 3XL | 4XL | 5XL | 6XL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 19.49 | 20.28 | 21.06 | 21.85 | 23.43 | 25.00 | 26.57 | 28.15 | 29.72 | 31.30 | 32.87 |
| B | 25.39 | 25.39 | 26.57 | 26.57 | 27.76 | 27.76 | 28.94 | 28.94 | 30.51 | 30.51 | 30.51 |
| C | 22.64 | 22.64 | 23.23 | 23.82 | 24.41 | 25.00 | 25.59 | 26.18 | 26.38 | 26.57 | 26.77 |

### Print areas and templates: UNCONFIRMED

Needs a key: `GET /mockup-generator/printfiles/801?technique=CUT-SEW` and `GET /v2/catalog-products/801/mockup-templates`.

## Still UNCONFIRMED after the key (items 1, 2 and 4 are now answered at the top)

1. Print-file px width × height and DPI for each placement and variant. Needs `GET /mockup-generator/printfiles/{388,400,801}?technique=CUT-SEW`.
2. Mockup template IDs. Needs `GET /v2/catalog-products/{id}/mockup-templates` or `GET /mockup-generator/templates/{id}`.
3. v2 placement key strings, and whether v2 `catalog_variant_id` equals the v1 variant IDs above. I believe Printful kept the same IDs in v2, but I did not verify it. Check with `GET /v2/catalog-products/{id}/catalog-variants`.
4. What the jacket's `details` placement covers, and how the jogger leg files wrap the pocket, waistband and cuffs. Needs the templates in item 1 and item 2.
5. v2 prices per selling region. Needs `GET /v2/catalog-products/{id}/prices`. The v1 prices above are USD.

## Mapping to `src/lib/pod/aop-printful.ts`

### What to fill in so `aopOrderable()` returns true

`aopOrderable(id, panelIds)` needs two things:

1. `product.catalogVariantIds` must be truthy.
2. `panelPrintTarget(id, panelId).confirmed` must be true for every panel the studio passes.

Steps:

- **Variant IDs.** Change the `catalogVariantIds: null` type to something like `Record<Size, number>` and fill it from the tables above:
  - hoodie: `{ "2XS": 18730, XS: 10869, S: 10870, M: 10871, L: 10872, XL: 10873, "2XL": 10874, "3XL": 10875, "4XL": 18731, "5XL": 18732, "6XL": 18733 }`
  - joggers: `{ XS: 11033, S: 11034, M: 11035, L: 11036, XL: 11037, "2XL": 11038, "3XL": 11039 }`
  - jacket: `{ "2XS": 20370, XS: 20371, …, "6XL": 20380 }`

  These are confirmed v1 IDs. Re-check them against v2 before relying on them there (item 3 above).
- **Panel targets.** `panelPrintTarget` must return `{ confirmed: true, widthPx, heightPx, placementKey, dpi }`. `widthPx`, `heightPx` and the per-placement DPI can't be filled until the printfiles call is made with a key, so **`aopOrderable` cannot honestly turn true from public data.** Variant IDs and placement keys can be filled now.
- **Placements are not panels.** The studio's panel IDs (`src/lib/studio/garments.ts`) are colour regions, not Printful placements. The target needs a panel → placement map, and each print file must be composed from several panels:

| Studio panel(s) | Hoodie 388 placement | Jacket 801 placement | Joggers 400 placement |
|---|---|---|---|
| `body_front`, `side_*`, `piping_*`, `waistband` / `hem`, `mark` | `front` (v1 id `default`) | `front` (v1 id `default`); hem or trims possibly `details` (UNCONFIRMED) | n/a |
| `body_back` | `back` | `back` | no back placement: part of `leg_left` / `leg_right` |
| `sleeve_left` + `cuff_left` | `sleeve_left` (whether the cuff is in the sleeve file is UNCONFIRMED) | `sleeve_left`, or `details` (UNCONFIRMED) | n/a |
| `sleeve_right` + `cuff_right` | `sleeve_right` | `sleeve_right`, or `details` | n/a |
| `hood` | `hood` | n/a | n/a |
| `pocket` | `pocket` | `pocket` | no pocket placement |
| `collar` | n/a | probably `details` (UNCONFIRMED) | n/a |
| `leg_left` / `leg_right` (+ `cuff_*`, `waistband`) | n/a | n/a | `leg_left` / `leg_right` (v1 ids `left_leg` / `right_leg`) |
| (none in studio) | `label_panel`, `label_inside` | `label_inside`, `label_outside` | `label_inside` |

  `aopOrderable` asks every panel to have its own confirmed target. A rule like "each panel maps to a confirmed placement" fits Printful better, because several panels share one file.

### Mismatches with Printful's real data

1. **Joggers and jacket fabric is confirmed.** The file says the pages name no fabric, and sets `fabric: null, fabricConfirmed: false` for both. The public `GET /products/400` and `GET /products/801` descriptions say 96% recycled polyester / 4% elastane (US/Mexico) or 95% recycled polyester / 5% elastane or spandex (Latvia), 308 g/m², brushed fleece inside. The technique is "All-over synthetic", which means sublimation by the all-over print page the file quotes. Both can move to `fabricConfirmed: true`, and the "cotton lining" read from reviews is just the cotton-feel face and brushed fleece. `aop-printful.test.ts` checks that an unconfirmed line names no fabric (`fabricClaim` regex) and that `catalogVariantIds` is `null`, so update those tests along with the data.
2. **Hoodie fabric wording.** The file says "recycled polyester and spandex blend". The API says elastane, with the 96/4 vs 95/5 split depending on where it's made. Same fibre, but the exact mix depends on the factory.
3. **"The catalog API requires a key"** is only half true. v1 `/products/{id}`, `/products/variant/{id}` and `/products/{id}/sizes` are public, and they give the variant IDs, placements and fabric. Only print files, templates and all of v2 need a key.
4. **Sizes.** Hoodie and jacket run 2XS to 6XL. Joggers run only XS to 3XL. The hoodie + joggers and jacket + joggers sets (`SET_PARTNER`) have no jogger for 2XS or 4XL to 6XL.
5. **Joggers is a men's cut, slim fit.** That matches the file's note about using 400 over the unisex 784.
6. **Panels the studio has but Printful doesn't print separately:** cuffs, side panels, piping, waistband, hem, collar, and the joggers' back and pocket. The studio has no label panels. See the table above.
7. **Prices match.** The from-prices 4075, 3948 and 6241 cents equal the lowest v1 variant price for each product. For the hoodie that is 2XS (40.75); XS to XL cost 41.56.
8. **Stitch colour option.** All three have `stitch_color` (`white` | `black`). On the hoodie it also sets the drawcord, on the jacket the zipper. The joggers drawstring is always white (the description says "white drawstring"). The file doesn't model this option yet.
