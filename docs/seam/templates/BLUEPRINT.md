# Blueprint: <app name>

> Written BEFORE any real code. Every file the app needs, grouped by seam, in build order.
> Next step after review: the skeleton phase turns every entry below into a skeleton file (header + this pseudocode + signatures). The hooks won't let build start until every file listed here exists as one.
> The AI builds each file from its entry here + its contract + its locked tests, and nothing else.
> Keep this in sync with `blueprint/manifest.json` (the hooks check the manifest).

## 0. One-paragraph summary
What the app does, for whom, in plain English.

## 1. Seam map
Aim for 8-15 seams. A seam is a handoff point, not a button.

| Seam | What it owns | Talks to | Outside service? |
| --- | --- | --- | --- |
| config | all settings and secrets | everyone (read-only) | no |
| auth | sign in / out, session | config | yes (auth provider) |
| state | shared app state | auth | no |
| storage | database + file storage | config, auth | yes |
| ... | | | |

## 2. Build order
Foundation first, then dependency-free seams, then outward. Do not start a feature seam before these are green.
1. config
2. auth
3. state
4. storage
5. (feature seams, each only after the seams it depends on)

## 3. Files, seam by seam
Copy this block for every file.

### Seam: <name>
Contract: `contracts/<name>.ts` - Mock: `mocks/<name>.mock.ts` - Probe: `probes/<name>.probe.ts`
Failure screens: (from UI-FAILURE-STATES.md)

#### `src/<name>/<file>.ts`
- **Purpose:** one sentence.
- **Inputs:** what it receives, and from which seam (name the contract type).
- **Outputs:** what it hands off, and to which seam (name the contract type).
- **Seams touched:** <name>, ...
- **Errors:** what it throws, and when. (Never "returns empty".)
- **Pseudocode:** (numbered, at least 3 real steps; these get copied into the file's header and stay there)
  1. <first thing the file does, as a plain sentence>
  2. <next thing, including what happens when it fails>
  3. <what it hands back>
- **Test sentences:** (these become the locked tests)
  - When ..., it ...
  - When ... fails, it throws ...

## 4. Open questions
Things the prototype didn't answer. Resolve before entering build phase.
