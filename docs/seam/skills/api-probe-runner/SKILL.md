---
name: api-probe-runner
description: Call every outside API once for real, save the exact answers (including errors) as fixtures, then write Zod contracts and fixture-based mocks from them. Use after the blueprint (blueprint or skeleton phase), before tests.
---

# API probe runner

> **Before you start:** this skill works inside a project that has the seam kit installed, meaning there is a `.seam/` folder at the project root. If there isn't one, stop and tell the human to run `/seam-driven:install` (Claude Code plugin) or `/seam-install` (Cursor plugin), or copy the kit in by hand (see the kit README). Every path below (`blueprint/`, `templates/`, `npm run seam:...`) is relative to the project root, not to this skill's folder.

**Goal:** nothing in the app is built on a guess about what an outside service returns.

## Steps
1. For each seam with an outside service (manifest entries that have `mock` + `fixtures`), write `probes/<seam>.probe.ts` using `probes/save-fixture.ts` (see `example/probes/catalog.probe.ts`). Probes read keys only through `src/config` (put real keys in `.env`, never in the probe).
2. Probe **the happy path and the failures**: success, not found, bad input, unauthorized/expired, rate limited, timeout or slow response if you can trigger it, empty list. Each answer becomes `probes/fixtures/<seam>.<case>.json` (request, status, body, capture time).
3. Add each probe to `probes/run-all.ts` and run `npm run probe`. Read the saved files. Strip anything personal or secret from fixtures (the secret scan will block keys and tokens it recognizes).
4. **Write the contract** in `contracts/<seam>.ts` with Zod, based on the fixtures, not on the docs. Only include fields the app actually uses. Include the error body shape too. Every contract file has the header block, including numbered `Pseudocode:` steps describing each shape.
5. **Write the mock** in `mocks/<seam>.mock.ts`: it imports the fixtures, parses them with the contract (so a stale fixture fails immediately), and replays them. Allowed: deriving a broken case from a real fixture (e.g. remove one field to test "wrong shape"). Not allowed: inventing data, or calling the network.
6. List the fixture, contract, and mock in the seam's manifest entry. Set `status.contract: true` after the human reviews the contract in plain English ("a product has: id (number), title (text), price (number)...").

## In build phase
Fixtures and contracts are locked. Re-probing is a **contract change**: update the blueprint, add a drift-log row ("catalog API added field X"), commit with `[contract-change]`, then regenerate the files that use the contract.

## Done when
- Every outside-service seam has fixtures for success and at least two failure cases.
- `npm run seam:check` shows no `mocks-from-fixtures` or `hardcoded-keys` problems.
