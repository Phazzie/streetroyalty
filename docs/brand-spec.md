# Brand spec: makers launch clothing brands

Last updated: Nov 19, 2026 · Task C9 in `AGENT-TALK.md` (coordinator, 20:55 UTC)

The product is **anyone can design clothing and launch a whole clothing brand**. The lilac
tracksuit is the first test. This spec defines what a brand is, how designs, sets and collections
belong to one, the brand storefront, payouts, and how the AI brand designer reads and edits a brand
through the same command style as the studio session (`docs/studio-spec.md` §6).

It rests on what exists today (`profiles`, `designs`, `collections`, `garment_sets`,
`/m/<handle>`) and on `docs/research/brand-platforms.md`. Questions for the owner are marked
**Owner:**.

## 1. Lessons from other platforms

The full comparison with sources is in `docs/research/brand-platforms.md`.

- **Several shops per login:** one login can run several separate shops, each with its own catalog
  and payouts.
- **Avoid:**
  - one store per account (Spring);
  - a store address that breaks when the store is renamed (Printify);
  - fees that punish new sellers (Redbubble's 50% Standard tier);
  - asking makers to wire two tools together (Shopify + Printful).
- **What nobody does well, and we can:** taking "who you are" through a brand kit, a coordinated
  all-over collection, a store and a printed neck label in one flow, and selling the **whole
  outfit** as one product to people with no design or tech background.

## 2. What a brand is

A brand is its own thing, separate from the person.

| Thing | Today | With brands |
| --- | --- | --- |
| Maker | `profiles` (handle, display name, bio), page at `/m/<handle>` | Unchanged. A maker's page lists their brands. |
| Brand | does not exist | `brands`, with a public storefront at `/b/<slug>` |
| Membership | n/a | `brand_members`: a maker can have many brands, and a brand can have several members |
| Collection | `collections` (owner, name) | Belongs to a brand and works as a **drop** (launch date, status) |
| Design | `designs` (owner, optional collection) | Optional `brand_id`. Personal designs stay personal until moved into a brand. |
| Set / outfit | `garment_sets` | Optional `brand_id`. A set is **one sellable look**. |

Rules:
- Every brand has exactly one **owner**. v1 only shows the owner. Editors come later (the table
  supports them from day one).
- A design or set belongs to **at most one** brand. Moving a piece into a brand copies nothing;
  it sets `brand_id`.
- Deleting a brand never deletes designs. Its pieces go back to personal, and its storefront shows
  a closed page.

## 3. The brand kit

The brand kit is the identity, stored once and used everywhere: the storefront, product pages, the
neck label, and as **constraints for the AI designer**.

```ts
export type BrandKit = {
  palette: {
    // Named after the studio's colorway roles, so the kit can become a colorway in one step.
    body: string; contrast: string; trim: string; mark: string;
    extra?: string[];                 // up to 4 more brand colours, "#rrggbb"
  };
  type: { display: string; body: string };   // from the studio's font list
  voice: string;                      // up to 280 characters: how the brand talks
  motifs: string[];                   // up to 8 short tags: "crowns", "chrome", "night drive"
  logo: { assetId: string | null; wordmarkAssetId: string | null };
  label: { assetId: string | null; text: string };  // the printed neck label, at most 24 characters
};
```

- **Kit → colorway:** "Apply brand colours" turns `palette.body/contrast/trim/mark` into a
  colorway on any piece. In the session API this is `setRoleColor` four times, as one undo step.
- **The neck label** is part of the kit. Printful prints inside labels for all-over pieces
  (`label_inside`, 2.5 × 1 in), and on the jacket an outside label too (`label_outside`, 3 × 3 in).
  A brand's pieces print its label by default, and the product page shows it.
- Every field is validated the same way the studio validates (hex, font list, lengths). Pictures
  use the studio's existing image caps.

## 4. Collections become drops

- A collection gets `brand_id`, `status` (`draft | scheduled | live | archived`) and `drop_at`.
  A scheduled drop shows a countdown on the storefront and opens for sale at `drop_at`.
- **Sets sell as one look.** A hoodie + joggers set is one product card and one "add the set"
  button. The rule from the owner applies: **sets only in XS–3XL**, single pieces in every size.
- Nothing in a drop is buyable until the piece itself is orderable. For all-over pieces that
  means the garment rebuild, then the physical sample approved (see `AGENT-TALK.md`).

## 5. The storefront

- **Address:** `/b/<slug>`. Slugs follow the same rules as maker handles (`checkHandle` in
  `src/lib/social/handles.ts`, reserved words included) but live in their own namespace.
  - Renaming keeps the old slug in `brand_slug_history`, and `/b/<old>` redirects (301) to the
    new one, so shared links never break.
  - Custom domains come later.
- **Layout:** preset themes filled from the brand kit, not free-form HTML. Every store looks good
  for someone with no design background.
- **v1 sections:**
  1. Hero / lookbook.
  2. The current drop, with a countdown if it's scheduled.
  3. Collections.
  4. Full outfits.
  5. "The maker" story.
  6. The neck label shown as proof it's a real brand.
- **The maker page `/m/<handle>`** keeps the maker's own feed and lists their live brands.
- **Visibility:** draft brands are visible only to members. `paused` hides the store behind a
  short "back soon" page.

## 6. Prices, margin and payouts

Numbers and sources are in `docs/research/unit-economics.md` (checked 2026-11-19, North America
base prices).

**Recommended defaults (Owner: decide):**
- Retail: hoodie **$69**, joggers **$65**, set **$125**.
  - At $125, the set's Printful base is about $81. After card fees (2.9% + 30¢) and Stripe Tax
    ($0.50 per order), about **$35** of margin is left.
- Split of net margin: **70% maker / 30% platform**. On the $125 set that's about $24.80 to the
  maker and $10.60 to us.
- A **floor price** per product, so no listing nets less than a set minimum. A $59 hoodie nets
  only about $13.
- **Risks the price has to cover:**
  - Printful won't remake a garment ordered in the wrong size (about $50 lost on a hoodie);
  - a lost card dispute costs about $67;
  - shipping is charged on top ($8.29 US, then $2.50 for each extra item).

The structure doesn't change with the numbers:

- **Listing price:** each sellable piece or set has a retail price set by the brand. The editor
  shows **base cost → platform cut → your payout** live, as every competitor does.
  `base_cost_snapshot` is stored on the order line, so a later Printful price change doesn't
  rewrite old orders.
- **Payouts:** Stripe Connect, the norm in this market (Printify). There's one
  connected account per payee (a user, not a brand). The ledger splits each order line between
  brand members by `revenue_share_bps`, and it all goes to the owner in v1.
  - **Owner:** cadence and minimum. Monthly with a $25 minimum is the market norm. We could
    choose faster.
  - **Owner:** the platform's cut. The recommendation is 30% of net margin, with a floor price per
    product.
- **Ledger, not balances:** every sale, refund, reprint and payout is a row. A balance is a sum,
  never a stored number.

## 7. Data model (migrations 0020–0029, Claude's range)

None of these migrations is destructive: they add tables and nullable columns. Existing rows
need no backfill and stay personal.

```sql
-- 0020_brands.sql
create table if not exists brands (
  id text primary key,
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  story text not null default '',
  status text not null default 'draft',        -- draft | live | paused
  kit_json text not null,                      -- BrandKit, validated on write
  theme_json text not null default '{}',       -- preset id + section settings
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists brand_slug_history (
  slug text primary key,                       -- an old slug is never handed out again
  brand_id text not null references brands (id) on delete cascade,
  retired_at timestamptz not null default now()
);
create table if not exists brand_members (
  brand_id text not null references brands (id) on delete cascade,
  user_id text not null,
  role text not null,                          -- owner | editor | viewer
  revenue_share_bps integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create unique index if not exists brand_one_owner on brand_members (brand_id) where role = 'owner';

-- 0021_brand_links.sql
alter table collections   add column if not exists brand_id text references brands (id) on delete set null;
alter table collections   add column if not exists status text not null default 'draft';
alter table collections   add column if not exists drop_at timestamptz;
alter table designs       add column if not exists brand_id text references brands (id) on delete set null;
alter table garment_sets  add column if not exists brand_id text references brands (id) on delete set null;
create index if not exists designs_brand_idx on designs (brand_id);
create index if not exists collections_brand_idx on collections (brand_id);

-- 0022_listings.sql (with pricing)  · 0023_ledger.sql (with Stripe Connect)
```

Notes:
- `slug` uniqueness covers live slugs and retired slugs together: on rename, the code checks both
  tables in one transaction.
- `kit_json` stays text like the rest of the schema (`garment_json`, `colorways_json`), and is
  parsed and validated in one place (`src/lib/brands/kit.ts`).
- **Authorization:** every server function uses the verified `context.userId`. Every brand write
  checks membership and role in the same query.
- **Old writers:** code that saves a design without knowing about brands must not clear
  `brand_id`. That's the same rule #23 applied to `garment_json`, and it needs a test.

## 8. The AI brand designer

The AI designer edits a brand the same way it edits a garment: it reads a `describe()` result and
sends plain JSON commands. Each command is validated, undoable and logged. It never writes to the
database or calls a provider directly.

```ts
export type BrandDoc = {
  version: 1;
  brandId: string | null;
  slug: string; name: string; tagline: string; story: string;
  status: "draft" | "live" | "paused";
  kit: BrandKit;
  collections: { id: string; name: string; status: string; dropAt: string | null; pieceIds: string[] }[];
};

export type BrandCommand =
  | { type: "setName"; name: string }
  | { type: "setSlug"; slug: string }                    // checked like a handle; refused when taken
  | { type: "setTagline"; tagline: string }
  | { type: "setStory"; story: string }
  | { type: "setPalette"; palette: BrandKit["palette"] }
  | { type: "setType"; display: string; body: string }
  | { type: "setVoice"; voice: string }
  | { type: "setMotifs"; motifs: string[] }
  | { type: "setLabel"; text: string; assetId: string | null }
  | { type: "createCollection"; name: string }
  | { type: "scheduleDrop"; collectionId: string; dropAt: string | null }
  | { type: "addToCollection"; collectionId: string; pieceId: string }
  | { type: "removeFromCollection"; collectionId: string; pieceId: string }
  | { type: "applyKitToPiece"; pieceId: string }          // opens that piece's studio session and
                                                         // dispatches setRoleColor ×4 as one step
  | { type: "undo" } | { type: "redo" };

export function describeBrand(doc: BrandDoc): { brand: BrandDoc; pieces: PieceSummary[]; checks: BrandCheck[] };
export function dispatchBrand(session: BrandSession, command: BrandCommand): DispatchResult;
```

- **Model vs code:** the model chooses (names, palette, motifs, which pieces go in a drop). Code
  checks (lengths, hex, fonts, slug rules, ownership, size rules) and runs the commands.
  Generating pictures goes only through the existing capped AI endpoints
  (`src/lib/ai/*`, #19's per-account caps).
- **Loop:** `describe` → plan → a batch of commands → `describe` again → show the maker a
  preview with **Accept / Undo all**. Nothing goes live without the maker pressing Publish.
  `status: live` is never set by the AI.
- **Names and logos:** before a brand goes live, its name and logo get a "check before you
  launch" step. The AI must not imitate existing marks. **Owner:** do we run an automated
  trademark lookup, or show a warning and a link?
- **Print-resolution art without giant generations** (sources in
  `docs/research/ai-brand-designer.md`):
  - Patterns are generated as **tiles** of about 2048 px. Code repeats them across the sheet:
    straight, mirrored or half-drop. At 150 DPI one 2048 px tile spans about 13.6 in. The image
    APIs checked have no "seamless" option, so code makes the repeat (mirroring, or an
    offset-and-repair pass).
  - Stripes, piping, type and wordmarks are drawn by **code as vectors**, never generated, so
    they print sharp.
  - Logos can be generated as rough drafts, then vectorised before printing.
  - Only placed art (a big back graphic) needs upscaling.
- **Cost:** image generation is the only paid command:
  - drafts at the lowest resolution;
  - every call through the existing per-account caps;
  - a per-session budget shown to the maker.
  - At the time of writing, xAI lists image generation at about $0.04 per image. Check the price
    before relying on it.
- **Edits are reviewable:** each AI turn is one undo step, and the maker sees a diff of what
  changed.

## 9. Build order

1. **0020 + 0021, `src/lib/brands/` (kit validation, membership checks), server functions**
   (create brand, edit kit, rename with redirects, move a piece into a brand), and tests.
2. **`/b/<slug>` storefront** with one preset theme and the v1 sections. Read-only and
   non-purchasable until pieces are orderable.
3. **Brand editor UI**, including "Apply brand colours" and the neck label.
4. **Drops:** scheduling and the countdown.
5. **Listings and pricing**, once the owner confirms §6.
6. **Ledger and Stripe Connect payouts**, after Stripe checkout lands.
7. **AI brand designer** on `dispatchBrand` and `dispatch`.

## 10. Questions for the owner

1. **Brands per maker:** unlimited, or a cap (say 3) to keep junk brands down?
2. **Payout cadence and minimum:** monthly / $25 (market norm) or faster?
3. **Prices and cut:** hoodie $69, joggers $65, set $125, split 70/30 of net margin (recommended, §6)?
4. **Neck labels on by default:** yes (recommended), knowing a printed label adds about $1–2.50
   per piece at Printful?
5. **Trademark checks:** an automated lookup or a warning?
6. **Address:** `/b/<slug>` for brands and `/m/<handle>` for makers (recommended), or one
   namespace for both?
