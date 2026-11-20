# Parallel work plan: Claude alongside the Cursor agents

Last updated: Nov 19, 2026 (status refreshed 19:55 UTC by Claude)

Goal: get the clothing design studio (lilac two-tone AOP tracksuit first, then whole brands) working on the live site, faster and with fewer bugs, without agents stepping on each other.

## Who is doing what right now

| Lane | Owner | Branch / PR | Files it owns |
| --- | --- | --- | --- |
| Agent 1: safety fixes | Cursor cloud agent | **merged** #19, #24 | `src/lib/ai/*`, `src/lib/lab-api.ts`, checkout guards in `src/lib/studio/orders.server.ts`, `vitest.config.ts` |
| Agent 2: garment foundation | Cursor cloud agent | **merged** #20, #23 | `src/lib/studio/garments*.ts`, `src/lib/pod/*` (types, sandbox, printful, aop-printful), garment ID fallbacks in `src/components/studio/editor.tsx` |
| Agent 3: editor session module | Cursor cloud agent | **go** (thread settled 20:55 UTC): `editor.tsx` + `src/lib/studio/session*`, contract is `docs/studio-spec.md` | `src/components/studio/*`, new `src/lib/studio/session*` |
| Agent 4: live Printful tracksuit | Cursor cloud agent | **go** (thread settled 20:55 UTC): `src/lib/pod/*`; data in `docs/printful-aop-data.md`, outlines in `src/lib/garments/outlines/` (C8) | `src/lib/pod/aop-printful.ts` data |

The tracking board with each lane's status is in Grok Bot (the Street Royalty build board).

## Ground rules for every agent, including Claude

1. Stay in your lane. Don't edit files another lane owns. If you must, keep it to the smallest possible change and say so in your PR.
2. One small PR per task, against `main`. Nothing merges without Taurean's OK.
3. Plan first, tests first, self-review before opening the PR, and record the self-review findings in the PR description.
4. Quality gates must pass: `tsc --noEmit`, `eslint .`, the full test suite (run it twice to catch flakes), coverage floors in `vitest.config.ts` not lowered, `npm run build`, and no new cycles from `npx madge --circular`.
5. Proof in every PR: a test summary, plus screenshots for anything visible.
6. Leave notes for other agents in `AGENT-TALK.md`.

## What Claude can take on in parallel (no file overlap with Agents 1 and 2)

Ranked by how much they speed things up or improve quality.

### C1. Independent PR reviewer (start now)
Review every PR from Agents 1 to 4 as a second, adversarial reviewer: bugs, missed edge cases, security, data compatibility with saved designs and carts, new coupling. Post findings as PR review comments. Different models catch different bugs, so this is the cheapest quality boost available.

### C2. Printful AOP data research for Agent 4 (start now, read-only)
Use the Printful API catalog (v2 `/catalog-products/{id}`, variants, mockup templates and print-file specs) for products 388 (AOP hoodie), 400 (AOP joggers) and 801 (AOP track jacket). Produce `docs/printful-aop-data.md` with every variant ID by size, each panel's print area (width and height in px at the required DPI), placement keys, template IDs, fabric and blank details, and the source of each number. Agent 4 then only has to wire the data in, which removes its slowest step. Don't edit `src/`.

### C3. End-to-end tests for the design studio (start now, new files only)
Write Playwright tests in `e2e/studio-aop.spec.ts` for the target flow: open the studio, pick the AOP hoodie, set panel colors (body, sleeves, hood, pocket, cuffs), save two colorways, switch between them, open the hoodie and joggers as a set, sign in, save, add to cart. Use stable selectors (`data-testid`) and list any the UI is missing in the PR so Agent 3 can add them. Tests that fail today are fine if they're marked `test.fixme` with a reason. This gives every later PR a real definition of done.

### C4. Design studio product spec (start now, docs only)
Write `docs/studio-spec.md`: the exact panel editor behavior, colorway and set rules, the print-ready checks (resolution, seams, bleed), and the session API Agent 3 will build (load product, set panel fill, add or remove colorway, add or move layer, undo and redo, export print files, save). Write that API as TypeScript interfaces so it can also be the contract for the future AI brand designer.

### C5. Security dependency upgrades (start now, its own PR)
Upgrade `better-auth` past the `~1.6.30` pin to at least `1.7.26`, `zod` to at least `4.6.6`, and get `seroval` out of 1.5.5 to 1.6.10 (likely via a TanStack Start update). Touch only `package.json`, the lockfile and any required call-site fixes. Run all the gates. If it conflicts with Agent 1's PR, rebase after Agent 1 merges.

### C6. Print-file storage design (start now, docs only, code later)
Write `docs/print-files-plan.md`: move print files from base64 in Postgres (`print_files.data_base64`) to object storage (for example Vercel Blob), use expiring signed URLs instead of the current never-expiring HMAC plus a one-year cache, clean up old files, and raise the size cap enough for 150 DPI all-over panels. Include a migration plan. Build it after Agent 2 merges.

### C7. Later, once Agents 2 and 3 merge
- The studio cart is the only cart. Stripe takes payment and Printful fulfills.
- Fix the two social cycles (`activity-api` with `activity.server`, and `makers.server` with `rack.server`) before creator stores.
- Split the look-lab store (`src/lib/store.ts`) so try-on and studio art tools don't depend on it.

## Ways to go faster without lowering quality

- Hand off by contract: C4's session interfaces let Agent 3 and the AI designer work against an agreed API.
- Data first: C2 turns Agent 4 from research plus code into just code.
- Tests as the definition of done: C3's end-to-end tests tell every agent when the studio actually works.
- Two reviewers on every PR (Claude plus Grok Bot) and small PRs, so reviews take minutes, not hours.
- Vercel preview deploys on every PR, checked by a person before merging.
- Merge order: Agent 1 and Agent 2 (done), then C5. Agents 3 and 4 now run in parallel; the garment-model thread in `AGENT-TALK.md` was settled at 20:55 UTC.

## How Claude reports back

Open a PR per task (or review comments for C1), add a short note to `AGENT-TALK.md` with the PR link, and flag any question for Taurean at the top of the PR description.
