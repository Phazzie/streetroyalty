# UI failure states

What every screen shows when something goes wrong. Copy stays in the Street Royalty voice (short,
plain, no blame). Today's lines are kept where they already work.

Rules for every failure screen:
- Say what happened in plain words and what the person can do next.
- Never pretend it worked: no "Sandbox" guess when the config failed, no public view when the admin
  board failed, no empty rack when the rack failed to load.
- Keep the person's work (the design on the canvas, the address form, the look being built).
- A raw "Unauthorized" never reaches the screen. It maps to the auth-expired line.

| Seam | Timeout | Upload failed | Rate limited | Auth expired / signed out | Empty | Other |
| --- | --- | --- | --- | --- | --- | --- |
| config | n/a | n/a | n/a | n/a | n/a | Missing setting: server refuses to start and names the setting. Shell mode tag shows "Mode unknown" with a retry, never a guess |
| auth | "Still signing you in." then a retry after 10 s | n/a | "Too many tries. Wait a minute." | Send to `/login`, come back to the same page | n/a | Gate identity rejected: "Open Street Royalty from Grok again to sign in." |
| storage | "Saving is taking longer than usual." + retry, design kept | "That file did not save: <reason>. It is still on the canvas." | "Slow down a second, then try again." | Sign-in prompt, then resume the save | n/a | Database down: "The shop can't reach its records right now." |
| catalog | "The blanks did not load." + retry | n/a | n/a | n/a | "No blanks in this category yet." | Printful catalog error: show the blank list we have cached, labelled "from earlier today" |
| printing | "The printer is slow to answer." + retry | Print file rejected: "The printer turned this file down: <reason>." | "The printer asked us to wait. Try again in a minute." | n/a | n/a | All-over order: "Ordering opens once the printer's panel templates are set up." |
| payments | "Stripe is slow to answer." + retry, address kept | n/a | n/a | Sign-in prompt, cart kept | n/a | Payment declined at Stripe: back to `/checkout` with "Stripe did not take that payment." |
| ai | "Still drawing (this can take a minute)." then cancel / retry | Face photo rejected: "That photo could not be used. Try another." | "The lab hit today's limit. It resets at <time>." | "Sign in to draw." | "No looks yet. Make your first." | Provider refused the prompt: "The art machine would not draw that one." |
| studio | as storage | as storage | as storage | as auth | "Nothing saved yet." + Open the studio | Mockup failed: "The preview could not be made; your design is saved." |
| orders | "Your order is still being placed." + refresh | n/a | "Too many checkouts at once. Try again shortly." | as auth | "Nothing in the bag." / "No orders yet." | Print failed after payment: order row says so with Retry print; wrong amount: "Needs review, we will sort it." |
| rack | "The rack did not load." + retry | n/a | "Slow down a second." (crowns, remix, reports) | Acting signed out: "Sign in to crown / follow / remix." | "The rack is empty." / "You follow nobody yet." / "Nothing on the rack matches." | Unknown maker: the shut-window screen, found by error code, not by message text |
| admin | "The queue did not load." + retry | n/a | n/a | Non-admin: "Staff only." | "No reports. All quiet." | Go-live board failed: show the error, never the public checklist in its place |
| lab | "Still drawing." then cancel / retry | as ai | as ai | "Sign in to draw." | "Lock a face to start." | IndexedDB blocked (private window): "Looks won't be kept after you close this tab." |
| site | n/a | n/a | n/a | n/a | n/a | Any crash: "That broke." with the error message (today's error component) |

Each row becomes test sentences in the blueprint, for example: "When the rack server function throws
RackError with code `unavailable`, the rack page shows 'The rack did not load.' and a retry button."
