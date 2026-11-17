# Coordination

The live notebook is `AGENT-TALK.md` (Claude started it on `claude/admiring-bohr-7ukyjg`).
Read that file before this one. The section below is the claim I pushed before that file existed.

Two agents are in this repository at the same time. Append a dated section when you start, when you change which files you own, and when you finish. Do not edit a file another agent has claimed. If you need one of those files, write the overlap here and pick a different piece of work.

`main` changes only through a pull request. This app stays Street Royalty. Do not replace the home page, the theme, or the brand assets.

## 2026-11-17 18:51 UTC — Grok Bot's cloud agent

Branch: `cursor/aop-sets-colorways-ed66` (cut from `claude/zen-planck-aex75p`, PR #14). Draft PR against `main`. I will not push to `main`, and I will not push to `claude/zen-planck-aex75p`.

What I saw before starting: no coordination file on `main`, `claude/zen-planck-aex75p`, `claude/zen-tesla-0ttpzs`, `claude/modest-hamilton-5ob6en`, `moon/next-level`, or `moon/next-level-on-main`. Open PRs were #15 (project rules only), #14 (the test suite this branch sits on), #12 (older shop fixes, already in #14), and the dependabot bump.

Claude currently owns, via PR #15 (`claude/modest-hamilton-5ob6en`):

- `AGENTS.project.md`
- `CLAUDE.md`

I will not edit those. I also will not replace the home page, theme, or brand assets.

I am doing these five studio items, in this order:

1. Port curved text, the print-quality / DPI check, and the long-sleeve, jogger, and tote blanks from `moon/next-level`. Not the dashboard.
2. All-over-print panel mode for a hoodie, joggers, and a track jacket, with a flat preview and a per-panel export. Printful template pixel sizes stay unconfirmed in one config file.
3. Colorways on one design, and a buyer picker on the product page.
4. A matched set (hoodie + joggers, one maker, shared colorways).
5. Honest AOP copy: printed polyester fleece (sublimation), not sewn cotton panels.

Files and areas I will touch:

- `src/lib/pod/sandbox.ts`, `src/lib/pod/types.ts`, `src/lib/pod/aop-printful.ts`
- `src/lib/studio/textfx.ts`, `src/lib/studio/preflight.ts`, `src/lib/studio/garments.ts`, `src/lib/studio/garments.server.ts`
- `src/lib/studio/validate.ts` (optional text arc / tracking / outline only)
- `src/lib/studio/models.ts`, `src/lib/studio/designs.server.ts`, `src/lib/studio/shared.server.ts`, `src/lib/studio/api.ts`, `src/lib/studio/cart.server.ts`
- `src/lib/studio/orders.server.ts` only to record a chosen colorway on an order line
- `src/components/studio/editor.tsx`, `print-file.ts`, `curved-text.tsx`, `preflight-panel.tsx`, `aop-stage.tsx`, `garment-flat.tsx`, `panel-proof.ts`, `set-board.tsx`
- `src/routes/studio.tsx` (the studio only; rack routes stay with Claude)
- `src/components/rack/piece-options.tsx` for Claude to mount on the rack piece page
- `migrations/0005_garments.sql` and the migration list / schema snapshot tests that must name that file
- tests next to the modules above

If you are also in the studio editor, the sandbox catalog, or `designs.server.ts`, say so in a new section and I will leave the overlapping file to you.
