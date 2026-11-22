# Seam-Driven Development

A way to build an app with AI coding tools **all the way to done**, even if you can't read code.

## Why this exists

AI tools get you 70-80% of the way, then the app falls apart. That isn't bad luck. Three things pile up:

1. **Decisions nobody wrote down.** The AI quietly decides data shapes, file layout, and error handling on every prompt. By prompt 90 it has forgotten what it decided on prompt 12 and starts contradicting itself.
2. **Silent failures.** AI tools are tuned to make things *look* like they work. They swallow errors and return fake empty values so the screen doesn't crash. Twenty of those hiding bugs finally collide around 80%.
3. **The visible part is the cheap part.** Screens are fast to make. The real work (errors, auth, saving data, outside services) comes last, so 80% "done" on screen can be 20% done underneath.

Seam-driven development fixes this by **writing the decisions down before code exists** and then **using machines, not polite requests, to enforce them.** Words are suggestions. Hooks are walls.

## Words you need

- **Seam**: a spot where one part of the app hands data to another (for example "the catalog service hands products to the closet screen"). Good seams let you build, test, swap, or regenerate one part without touching the rest. Aim for **8-15 seams** in a normal app: auth, storage, image generation, catalog, each screen group. Not one per button.
- **Contract**: the exact shape of the data that crosses a seam ("a product has an id number, a title, a price..."). Written once, as code (a Zod schema), in `contracts/`. Both the real code and the fake test versions use the same contract, so they can't disagree.
- **Probe**: a tiny script that calls a real outside service once and saves exactly what came back. Saved answers are **fixtures** (in `probes/fixtures/`).
- **Mock**: a fake version of a neighbor (an outside API, or another seam) built only from fixtures. Lets you test without the real thing.
- **Flip**: swapping a mock out for the real thing, and proving it still works.
- **Skeleton**: a planned file written as its plan only: the header, numbered plain-English pseudocode, and the exact function names and inputs, with every function body just `throw new Error('SKELETON: not built yet');`. No real code yet.
- **Phase**: `explore`, `blueprint`, `skeleton`, or `build`, stored in `.seam/phase`. Decides how strict the hooks are. You move forward one step at a time; the hooks refuse a skipped step.

## The process

### Step 1. Prototype (phase: explore)
Vibe-code it as far as it goes. The goal is to learn what the app really is: which screens matter, which outside services are weird, where it hurts. **This code gets thrown away.** For Fashion Studio, the existing app *is* the prototype.
Give it a time limit so it doesn't quietly become the real app.

### Step 2. UI sketch, including failure screens
Rough out every screen. The screens tell you what data each part of the app needs.
Also sketch what the user sees when things go wrong: timeout, upload failed, rate limited, login expired, nothing here yet. Fill in `blueprint/UI-FAILURE-STATES.md`. If you don't design these now, the AI will invent them later (usually as a blank screen).

### Step 3. Blueprint (phase: blueprint)
List every file the app needs, grouped by seam, in `blueprint/BLUEPRINT.md` and `blueprint/manifest.json`. For each file:
- a **top comment** (Purpose, Inputs, Outputs, Seams it touches)
- **plain-English pseudocode** of what it does, as numbered steps (at least 3)
And a **build order**: settings (`config`) first, then **auth and shared state**, then files with no dependencies, working outward. Auth and shared state touch everything, so they're locked first.

### Step 4. Skeleton: every file, as its plan, before any code (phase: skeleton)
Run `npm run seam:phase skeleton` (it refuses until every seam's blueprint is reviewed). Then the AI writes **every** planned file as a skeleton, using the skeleton-writer skill: the header with numbered pseudocode at the top, then the imports, types, and function signatures, with every function body just `throw new Error('SKELETON: not built yet');`. You review the whole skeleton: one list per seam with each file's purpose and steps.

**Why this step can't be skipped.** AI tools want to jump straight to code, because code looks like progress. But that is exactly how decisions go unwritten: the AI picks file names, function shapes, and error handling on the fly, and forgets them later. The skeleton puts every decision on paper, in the file where it will live, where you can read it. Every later prompt then has a fixed target, and several AI agents can build different files at once because the handoffs between them already exist. A wrong step costs a sentence to fix now and a rewrite at 80%.

So the hooks make it impossible to skip:
- In the skeleton phase, a commit with real code in `src/` (anything beyond the header, imports, types, and SKELETON-throwing signatures) is refused. Contracts and mocks are exempt: they are real code by design.
- Every code file must have a `Pseudocode:` section with at least 3 real numbered steps. `TODO`, `TBD`, `...`, and filler are refused.
- The AI agent hooks refuse to create a file that isn't in the manifest, or to write a file without its header and pseudocode.
- `npm run seam:phase build` (and any commit that switches to build) is refused until every planned file exists and is a complete skeleton. Jumping from blueprint straight to build is refused, locally and in CI.

Steps 5-7 (probes, contracts, failing tests) happen while you're in the skeleton phase. The tests import the skeleton's real function names, so they line up with the plan from day one.

### Step 5. API probes
For every outside service, write a probe and run it (`npm run probe`). Save real answers, including real error answers (not found, bad request, rate limited). Nothing gets built on guesses about what a service returns.

### Step 6. Contracts
Turn the probe answers into Zod schemas in `contracts/`. One shared folder. The code and the mocks both import from it, so a mismatch breaks the build immediately instead of at 80%.

### Step 7. Failing tests, written first, as sentences
Every test starts as a plain-English sentence a non-coder can check:
> "When the catalog says the product does not exist, we get a loud error with status 404."
You review the sentences, not the code. That's your quality gate. Then the AI turns them into real tests, which fail because no code exists yet.
Also write the **real-mode** test sentences now (`tests/real/`), so the flip in step 9 has a finish line.

When steps 3-7 are done for every seam, run `npm run seam:phase build`. It refuses until every planned file is a complete skeleton and every seam has a reviewed blueprint, contract, tests, and fixtures. From then on tests, contracts, and fixtures are **locked**.

### Step 8. Mock pass (phase: build)
Build each seam, one at a time, in build order, against mocks. Each file is built **from its skeleton**: the pseudocode stays at the top, and the AI replaces each SKELETON throw by following the steps in order. If a step turns out to be wrong, fix the step first, then the code, and log it in the drift log. Deleting or hollowing out the pseudocode is refused. `npm run seam:report` lists files that are still skeletons. Mocks are built **only** from saved probe fixtures, never written from memory. Tests run with the network switched off, so a green test can only mean the code really works against the saved answers.
When a seam's tests pass, mark it `mockGreen` in the manifest and commit. From then on every commit re-runs its tests, so it can't silently break.

### Step 9. Flip each seam to real, right away
As soon as a seam is green on mocks, flip it: point it at the real service, run `npm run test:real`, and mark it `realGreen`. **Don't save all the flips for the end**: that's a mini 80% wall on flip day. `npm run seam:report` lists every seam that's green on mocks but not yet flipped, and the hooks nag when one sits too long.

### Step 10. Drift log
`blueprint/DRIFT-LOG.md` records every place the real app differs from the plan, and why. Updated every time they split. The drift auditor skill (skills/drift-auditor) checks the code against the blueprint for you.

## The rules

0. **Skeleton first, and the pseudocode stays.** Every file exists as a skeleton (header + numbered pseudocode + signatures) before any real code, and its pseudocode stays at the top for good. It's the file's plan and the prompt for regenerating it.
1. **Regenerate, don't debug.** If a file still fails after **2** fix attempts, stop fixing. Put it back to its skeleton and regenerate it from its pseudocode, contract, and tests, adding a note about what went wrong ("attempt 1 forgot the 404 case"). Or improve the blueprint pseudocode and regenerate. Untangling AI code nobody understands is the most expensive thing you can do.
2. **When the plan is wrong:**
   - The fix stays inside one file? Just fix it (or regenerate it).
   - The fix **crosses a seam** (a new field, a new file, a different handoff)? **Stop.** Update the blueprint and the contract first, log it in the drift log, then regenerate every file the change touches. Commit with `[contract-change]` in the message. The hooks enforce this: a commit that touches tests/contracts without the tag, the blueprint update, and the drift-log entry is refused.
3. **Fail loudly.** No swallowed errors, no fake empty results, no "just return null so it doesn't crash." If something is wrong, it crashes with a clear message, so you find it at 20%, not 80%. Enforced by the `no-silent-errors` check.
4. **One seam per prompt.** Each prompt to the AI covers one seam (ideally one file), and gives it that file's blueprint entry, its contract, and its locked tests. Nothing else. This keeps files regenerable and lets several AI agents work in parallel without stepping on each other.
5. **Small files.** 200 lines max by default. Big files are where AI starts quietly breaking things.
6. **Secrets and settings in one place.** Only `src/config/` reads environment variables. No keys in code, ever. `.env` is never committed.
7. **Never let the AI edit the tests to make them pass.** In build phase tests and contracts are locked by the git hooks, by the AI agent hooks, and by CI.
8. **Save checkpoints.** Commit every time a file goes green, so a bad regeneration is one `git checkout` away from undone.
9. **8-15 seams.** Fewer means seams are too big to regenerate. More means you're cutting one seam per button and the glue between them becomes its own mess.

## Phases (why the hooks don't drive you crazy)

Hooks that annoy people get turned off and never turned back on. So strictness grows with the project:

| | explore | blueprint | skeleton | build |
| --- | --- | --- | --- | --- |
| Hardcoded keys / .env committed | **block** | **block** | **block** | **block** |
| File header + listed in manifest | off | **block** | **block** | **block** |
| Pseudocode: 3+ real numbered steps in every code file | off | warn | **block** | **block** (can't delete or hollow it) |
| Real code in `src/` (only header, imports, types, SKELETON throws allowed) | off | off | **block** | allowed |
| Files still a skeleton | off | off | (expected) | warn (**block** if the seam is marked green) |
| Manifest lists a file that doesn't exist yet | off | warn | warn (**block** to leave) | **block** |
| Skipping a phase (e.g. blueprint straight to build) | **block** | **block** | **block** | **block** |
| Build order (config/auth/state first, deps first) | off | warn | warn | **block** |
| Silent errors, `any`, `@ts-ignore`, `eslint-disable` | off | warn | warn | **block** |
| File size over 200 lines | off | warn | warn | **block** |
| Env reads outside `src/config/` | off | warn | warn | **block** |
| Mocks import fixtures + contracts | off | warn | warn | **block** |
| Tests/contracts/fixtures locked | off | off | off | **block** (unless `[contract-change]` + blueprint + drift log) |
| Typecheck | off | off | warn | **block** |
| Tests for green seams | off | off | off | **block** |
| Seam count over 15 | off | warn | warn | warn |
| Unflipped seams | off | off | off | warn |

Leaving skeleton for build needs every planned file to exist as a complete skeleton (checked across the whole repo, by `seam:phase`, the commit hook, and CI). Leaving build phase needs `[phase-change]` in the commit message plus a drift-log entry, so "just switch it off" is a visible, logged decision.

## Rewriting an existing app side by side

- **Freeze the old app** (`plan/FREEZE.md`): emergency fixes only. Every fix also goes on the rewrite's list. Otherwise you chase a moving target.
- **Lock the feature list** (`plan/FEATURES.md`): the rewrite covers exactly this list. New ideas go to a "later" list.
- **Decide data early** (`plan/MIGRATION.md`): does the rewrite share the old database and file storage, or start fresh and migrate? Decide before building the storage seam.
- **Define cutover** (`plan/CUTOVER.md`): the exact must-do list before you switch users to the new app and retire the old one. Without it you polish forever.

## Known limits of the skeleton check

The skeleton check reads the code with the TypeScript parser (when `typescript` is installed; otherwise a rougher keyword scan). It is a good heuristic, not a proof:
- It checks each function **body**, not default values in a function's inputs (`deps = makeDeps()` slips through).
- For `.vue` and `.svelte` files it only checks the header and that the SKELETON throw is present; the markup isn't checked.
- Files in `contracts/` and `mocks/` are exempt, and so are files of seams already marked green (built in an earlier pass; their tests must really pass to enter build).
- Placeholder detection catches `TODO`, `TBD`, `...`, lorem ipsum, short filler, and repeated steps. It can't tell whether a well-written step is *true*; that's your review.
- The agent hooks can only check an edit when they can see the whole resulting file (a Write, or an Edit whose text they can apply). Anything else is caught at commit.

## What the machines enforce (summary)

See README.md for the full list. In short: git hooks check every commit, CI re-checks every push with the checks as they were *before* the push (so `--no-verify` and edits to the checks themselves don't help), and AI agent hooks stop Claude Code and Cursor from editing locked files in the first place.
