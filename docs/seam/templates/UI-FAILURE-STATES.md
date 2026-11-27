# UI failure states

For every seam the user can feel, decide what the screen shows when things go wrong. Sketch these **with** the happy screens, in step 2.
If a box is blank, the AI will invent something (usually a blank screen or an infinite spinner).

Rules for every failure screen:
- Say what happened in plain words, and what the user can do next.
- Never pretend it worked. No fake empty lists when the real answer was "failed to load".
- Keep the user's work (form input, uploaded image) when possible.

| Seam | Timeout | Upload failed | Rate limited | Auth expired | Empty state | Other |
| --- | --- | --- | --- | --- | --- | --- |
| auth | "Still signing you in..." then retry button after 10s | n/a | "Too many tries, wait 1 minute" | send to sign-in, keep where they were | n/a | wrong password |
| storage | "Saving is taking longer than usual" + retry | "Upload failed: <reason>. Your file is still selected." + retry | "Slow down, try again in a minute" | sign-in prompt, then resume | "Nothing saved yet" + how to add the first one | file too big |
| <image-gen> | "Still generating (this can take a minute)" then cancel / retry | n/a | "Generation limit reached until <time>" | sign-in prompt | "No looks yet. Generate your first." | content refused by provider |
| <seam> | | | | | | |

For each row, also note:
- **Which contract error** triggers it (for example `CatalogError` with status 404 -> "not found" screen).
- **Test sentence** proving it (for example "When the image service times out, the screen shows the retry button").
