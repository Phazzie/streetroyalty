# Prompt template: build ONE file (one seam per prompt)

Paste this into your AI tool. Fill the brackets. Attach only the files listed.

---
You are building exactly one file: `[src/seam/file.ts]` for the **[seam]** seam.

Read these and nothing else:
1. The file's skeleton, already in the repo: header, pseudocode, and signatures
2. Its blueprint entry: [paste from blueprint/BLUEPRINT.md]
3. Its contract: `contracts/[seam].ts`
4. Its locked tests: `tests/[seam].test.ts` (you may NOT edit tests, contracts, or fixtures)
5. AGENTS.md (the rules)

Rules: start from the skeleton. Keep the header and its numbered Pseudocode steps at the top, unchanged, and keep the function names and signatures. Replace each `throw new Error('SKELETON: not built yet')` by doing the pseudocode steps in order. If a step is wrong, tell me and fix the step first; never delete the pseudocode. Under 200 lines. No `any`, no `@ts-ignore`, no empty or swallowing `catch`, no fake fallback values: throw clear errors. Read settings only by importing from `src/config`. Don't touch any other file. If the tests or contract look wrong, STOP and tell me why instead of working around them.

Done means: `npm test` passes for this seam and `npm run seam:check` shows no BLOCK lines.

[If this is a regeneration:] Previous attempts failed. Notes: [what went wrong each time]. Start fresh from the skeleton (header + pseudocode + signatures); do not reuse the old code.
---
