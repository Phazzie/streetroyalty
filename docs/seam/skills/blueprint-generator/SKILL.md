---
name: blueprint-generator
description: Read an existing prototype app and write the seam blueprint (BLUEPRINT.md + manifest.json), UI failure states, and locked feature list for a clean rewrite. Use at the start of a rewrite.
---

# Blueprint generator

> **Before you start:** this skill works inside a project that has the seam kit installed, meaning there is a `.seam/` folder at the project root. If there isn't one, stop and tell the human to run `/seam-driven:install` (Claude Code plugin) or `/seam-install` (Cursor plugin), or copy the kit in by hand (see the kit README). Every path below (`blueprint/`, `templates/`, `npm run seam:...`) is relative to the project root, not to this skill's folder.

**Goal:** turn a working-but-messy prototype into a written plan that a non-coder can review and an AI can build from, one file at a time. You are writing a plan, not code.

## Inputs
- The prototype repo (read-only; never edit it, it's frozen: see plan/FREEZE.md).
- The new repo with the seam kit installed (phase `explore` or `blueprint`).

## Steps
1. **Inventory the prototype.** List every screen, every outside service it calls (with the exact endpoints it uses), every place it stores data, and how auth works. Note anything weird ("the image API sometimes returns 202 and you have to poll").
2. **Write the feature list** in `plan/FEATURES.md`: every feature the prototype really has, in plain English. Mark anything half-built. Ask the human to confirm "Must have", "Dropped on purpose", and "Later". Do not continue until they confirm.
3. **Cut seams.** Group the app into **8-15 seams**: always `config`, `auth`, `state`, then storage, each outside service, and screen groups. A seam is a handoff point, not a button. If you have more than 15, merge seams that always change together. If you have fewer than 8 for a real app, a seam is probably doing too much.
4. **Fill in `blueprint/BLUEPRINT.md`** using its template. For **every** file the app will need: Purpose, Inputs, Outputs, Seams touched, Errors it throws, **numbered plain-English pseudocode (at least 3 real steps)**, and **test sentences** ("When X, it Y"). Keep each planned file under ~150 lines of eventual code; split if not. If you can't write the pseudocode for a file, the plan isn't finished: ask the human.
5. **Fill in `blueprint/manifest.json`** with the same files. `buildOrder`: config, auth, state first, then seams whose dependencies are already listed. Every seam with an outside service gets a `mock`, `fixtures`, and `realTests` entry. Set `status.blueprint: true` only for seams the human has reviewed.
6. **Fill in `blueprint/UI-FAILURE-STATES.md`**: for each seam the user can feel, what the screen shows on timeout, upload failed, rate limited, auth expired, empty. Pull real error cases from the prototype where you can.
7. **Draft `plan/MIGRATION.md`**: list the prototype's data stores and recommend shared vs fresh for each, with the reason. The human decides.
8. **Note open questions** at the bottom of the blueprint. Anything the prototype didn't answer.
9. Set the phase: `npm run seam:phase blueprint`, then commit. Run `npm run seam:check` and fix anything it blocks.

10. **Hand off to the skeleton-writer skill** (`skills/skeleton-writer/SKILL.md` in the project, or `/seam-driven:skeleton-writer` if you use the Claude Code plugin). Once the human has reviewed the blueprint, every planned file gets written as a skeleton (header + pseudocode + signatures) before any real code. Don't start writing real code from here; the hooks refuse it.

## Rules
- Don't copy prototype code into the new repo. Read it to learn; the rewrite is generated from the blueprint.
- Name every data shape that crosses a seam; those become the contracts (next skill).
- Plain English in all docs. The human must be able to review every line without reading code.

## Done when
- The human has reviewed the seam map, feature list, and test sentences.
- `npm run seam:check` has no BLOCK lines in blueprint phase.
