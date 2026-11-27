# Seam kit skills

Instruction docs for AI agents, one folder per job. They're plain markdown with `name` / `description` frontmatter, so they work as Claude Code skills (copy a folder into `.claude/skills/`), as Cursor skills/rules, or pasted straight into any chat.

| Skill | Use it when | Phase |
| --- | --- | --- |
| blueprint-generator | turning the old app (the prototype) into a blueprint + manifest | explore -> blueprint |
| skeleton-writer | writing EVERY planned file as a skeleton (header, numbered pseudocode, signatures that throw SKELETON) and getting it reviewed, before any real code | blueprint -> skeleton |
| api-probe-runner | capturing real API answers as fixtures, then contracts and mocks from them | blueprint or skeleton (or a [contract-change] in build) |
| seam-builder | building or regenerating ONE file from its skeleton, blueprint, contract, and locked tests | build |
| drift-auditor | checking the code against the blueprint and updating the drift log | any time; before every phase change and cutover |
