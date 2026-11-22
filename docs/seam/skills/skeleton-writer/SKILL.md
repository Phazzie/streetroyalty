---
name: skeleton-writer
description: Turn the approved blueprint into a skeleton of EVERY planned file (header, numbered pseudocode, imports, types, and function signatures that only throw the SKELETON error) before any real code is written, then get the human to review it. Use right after the blueprint is approved, in the skeleton phase.
---

# Skeleton writer

> **Before you start:** this skill works inside a project that has the seam kit installed, meaning there is a `.seam/` folder at the project root. If there isn't one, stop and tell the human to run `/seam-driven:install` (Claude Code plugin) or `/seam-install` (Cursor plugin), or copy the kit in by hand (see the kit README). Every path below (`blueprint/`, `templates/`, `npm run seam:...`) is relative to the project root, not to this skill's folder.

**Goal:** every file in the plan exists on disk as its plan: what it's for, what goes in and out, which seams it touches, and step-by-step plain-English pseudocode, plus the exact function signatures. No real code yet. The whole app's shape becomes visible and checkable before a single line of logic exists.

**Why this step can't be skipped:** AI tools jump straight to code because code looks like progress. But code written without a file-by-file plan is where silent decisions pile up and the 80% wall comes from. A skeleton forces every decision (which files, which functions, which data shapes, which errors) to be written down where a human can read it, and gives every later prompt a fixed target. The hooks refuse real code in this phase, and refuse to enter build until every planned file is a complete skeleton.

## Inputs
- `blueprint/BLUEPRINT.md` and `blueprint/manifest.json`, already reviewed by the human (every seam has `status.blueprint: true`).
- `templates/FILE-HEADER.md` (the header format and a full skeleton example).
- `AGENTS.md`.

## Steps
1. Run `npm run seam:phase skeleton` and commit `.seam/phase`. It refuses if the blueprint isn't reviewed; if so, stop and ask the human to review it.
2. For **every** file listed under `files` in the manifest, in build order, write the skeleton. Do not skip any file, and do not add files that aren't in the manifest (the hooks block both).
   - **Header first**, copied from the file's blueprint entry: `Purpose:`, `Inputs:`, `Outputs:`, `Seams:`, and `Pseudocode:` with at least 3 numbered steps (`1.`, `2.`, `3.`...). Each step is a real plain-English sentence a non-coder can follow ("If the API answers with an error, throw a CatalogError with its status"). Never `TODO`, `TBD`, or `...`.
   - **Then the shape only:** imports, `type` / `interface` declarations, and every exported function with its exact name, inputs, and return type. Every function body is exactly:
     ```ts
     throw new Error('SKELETON: not built yet');
     ```
     A class constructor may call `super(...)` first. A value other files import can be declared as `export declare const config: Config;`.
   - **Nothing else.** No values, no schemas (those go in `contracts/`), no `if`, no loops, no `return`. If you feel the need to write logic, write it as a pseudocode step instead.
   - `.vue` / `.svelte` files: HTML comment header with the same lines, and the SKELETON throw inside `<script>`.
3. Files in `contracts/` and `mocks/` are real code by design (they're built from probe fixtures with the api-probe-runner skill). They still need the full header with pseudocode.
4. Run `npm run seam:check -- --all`. Fix every BLOCK line. `npx tsc --noEmit` should pass too: the signatures must fit together (the warnings tell you where they don't). A signature mismatch now is a five-second fix; at 80% it's a rewrite.
5. Commit. Then **ask the human to review the skeleton.** Give them a short list per seam: each file, its Purpose line, and its pseudocode steps. Ask: "Is anything missing? Does each step make sense? Is any file doing two jobs?" Change the blueprint and the skeleton together until they say yes.
6. While still in this phase, the probes, contracts, failing tests, and mocks get written (api-probe-runner skill, then test sentences turned into tests). The tests import the skeleton's real function names, so they typecheck against the plan.
7. When everything is reviewed: `npm run seam:phase build`. It refuses until every planned file exists, every header is complete with real pseudocode, no file has real code yet, and every seam has its contract, tests, and fixtures. Commit the phase change on its own.

## Never
- Write real code "to save time later". The hook blocks it, and it defeats the point.
- Leave a planned file out, or create a file that isn't in the manifest.
- Use placeholder steps, or copy the same step into every file.

## Done when
- `npm run seam:check -- --all` has no BLOCK lines in the skeleton phase.
- The human has read every file's pseudocode and said yes.
- `npm run seam:phase build` succeeds.
