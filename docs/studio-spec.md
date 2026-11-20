# Design studio spec: all-over panels, colorways, sets, print files

Last updated: Nov 19, 2026 · Task C4 in `docs/PARALLEL-WORK.md`

This is the contract Agent 3 builds the editor session module against, and the same
contract a future AI brand designer drives. It describes the target. Where today's code
differs, the "Today" notes say so. Type imports use `@/lib/garments`, the module PR #20
adds. Until #20 merges, the same types come from `@/lib/studio/garments`.

## 1. What a maker does

1. Opens the studio and picks a blank. All-over blanks are the hoodie (`aop-hoodie`),
   joggers (`aop-joggers`) and track jacket (`aop-track-jacket`). Placement blanks (tee,
   pullover hoodie, hat…) keep the current one-print-area editor.
2. On an all-over blank, sees the flat drawing front and back, picks a panel (click on the
   flat, or from the panel list) and gives it a fill: follow the colorway role, a solid
   color, a stripe or checker, or a picture.
3. Sets the four colorway roles (body, contrast, trim, mark). Every panel on "role" fill
   follows them.
4. Saves the current colors as a named colorway, makes another, and flips between them.
   The flat redraws at once.
5. Adds text and pictures on top (the chest mark, a back hit, a sleeve word).
6. Opens the matching partner piece as a set. Both pieces share the colorways.
7. Reads the print check, fixes what it flags, saves, publishes, and (once ordering opens)
   adds the piece or the whole set to the bag.

## 2. Panel editor behavior

**Selecting.** Clicking a panel on the flat selects it; clicking empty space clears the
selection. Panels with `face: "both"` are selectable from either face. A panel whose face
is not showing can still be picked from the list; the flat flips to its face.

**Fills.** `PanelFill` is one of:

| Kind | Meaning | Rules |
| --- | --- | --- |
| `role` | Follows the active colorway's color for the panel's role | Default for every panel |
| `color` | Fixed hex, ignores colorways | `#rrggbb` only |
| `pattern` | `stripe` or `checker`, two hexes | Both `#rrggbb` |
| `art` | A picture filling the panel | `data:image/png|jpeg|webp` or a stored file URL, at most `MAX_ART_SRC` |

A panel absent from `GarmentDesign.panels` is `role`. Setting a panel back to `role`
removes nothing from the colorways. A fill on a panel id the template does not have is
an error, never a silent no-op.

**Bulk actions.** "Apply to matching panels" sets the same fill on every panel with the
same role (for example both cuffs and the waistband for `trim`). Mirrored pairs
(`*_left`/`*_right`) get a "both sides" toggle that is on by default.

**Today:** selection is list-only in `aop-stage.tsx`; there is no bulk or mirror action.

## 3. Colorways and sets

- A garment has 1 to 8 colorways. Names are 2 to 40 characters. Ids are slugs, unique
  within the garment. On a clash, `addColorway` picks the lowest unused `-2`, `-3`, …
  suffix. **Today** it appends `-${count + 1}`, which can itself clash ("Night", "Night",
  then delete the first and add "Night" again); fix it with the session work.
- Adding a colorway copies the active one and makes the copy active.
- Removing the active colorway makes the first remaining one active. The last colorway
  cannot be removed.
- A colorway still referenced by a cart line cannot be removed without warning the maker
  that the bag line will lose its name (today `priceCart` handles it at checkout). The
  session is pure and knows nothing about carts, so this check belongs to the **adapter**:
  before it dispatches `removeColorway`, it asks the server whether any cart line uses that
  colorway, and asks the maker to confirm if one does.
- **Sets.** A set is two or more pieces from the same printer, each with its own panels and
  layers, sharing one list of colorways and one active colorway. Changing a role color in
  one piece changes it in all. Partners: hoodie and joggers; track jacket and joggers.
  Pieces from different printers cannot be in one set (PR #20 enforces this).
- In a set, the colorways live on the set, not on each piece (section 6, `StudioDoc.set`).
  Every colorway command changes that one list, and the piece garments mirror it, so a
  role color can't drift between pieces.
- Saving a set's colorways must update the set row and every piece together. **Today**
  `saveSetColorways` writes them one by one with no transaction, so two overlapping saves,
  or a failure partway, can leave pieces with different colors. Fix this on the server:
  use one transaction, or one write of the set row that pieces read from, plus a version
  check (section 6, saving).
- A buyer picks one colorway for the whole set; every piece in the bag carries the same
  colorway id.

## 4. Layers on an all-over piece

Today a layer (`DesignLayer`: text or image) lives in one print area, placement `front`,
with `x`/`y` as 0–1 fractions of that area. On an all-over piece that area is the chest.

Target: each layer names the surface it sits on.

```ts
type LayerSurface =
  | { kind: "placement"; placement: string } // placement blanks: "front", "back", ...
  | { kind: "panel"; panelId: string };      // all-over: "body_back", "sleeve_left", ...
```

Stored as an optional `surface` field on the layer. **Absent means the doc's placement**
(today always `front`), which is how every saved layer reads today, so no migration is
needed. `parseLayers` in `validate.ts` must parse and keep `surface` (both kinds, with a
known placement or panel id). **Today** it rebuilds each layer field by field and would
silently drop `surface`, so a panel layer would come back on the chest after a reload.
Round-trip it in a test. On an all-over piece, a front-placement layer is drawn inside
the `mark` panel's box, which is where it prints today.

## 5. Print-ready checks

The existing checks in `preflight.ts` (inside the area, sharp enough, ink contrast,
something to print) keep their meaning per surface. All-over pieces add:

| Key | Level | Rule |
| --- | --- | --- |
| `panel-dpi` | fail under 60% of 150 DPI, warn under 150 | Each `art` fill: picture pixels ÷ the panel's printed size in inches (from the placement map, section 7) |
| `bleed` | warn | An `art` fill or a layer that touches a panel's cut line must reach the bleed edge, or a white sliver shows after sewing |
| `seam-split` | warn | A text layer that crosses a seam (spans two panels' print rects) will be cut and may misalign |
| `safe-zone` | warn | Text within the safe margin of a cut line or under the hood/zip/pocket hem |
| `mark-contrast` | warn/fail | The `mark` role against `body`, same thresholds as ink contrast |

Numbers for cut line, bleed and safe margin come from Printful's print-file templates per
placement. Until they are known (`aop-printful.ts`, `docs/printful-aop-data.md`), `bleed`
and `safe-zone` say "not checked yet: the printer template isn't loaded" rather than pass.
A check that cannot run never reports pass.

Whether the piece can be bought is **not** a print check, because `CheckLevel` is only
pass/warn/fail and a closed shop isn't the maker's fault. It is a separate field,
`orderable`, on the result of `checks()` (section 6). The UI shows it as a note.

## 6. The session API

One pure module, `src/lib/studio/session.ts`, with no React and no server calls. The editor
holds a `StudioSession` in a reducer; the AI designer holds one in memory. Both change it
only through `dispatch(session, command)`. Server calls (mockup, save, publish) live in a
thin adapter on top and take a `StudioDoc`.

```ts
import type { DesignLayer } from "@/lib/pod/types";
import type { ColorRole, Colorway, GarmentDesign, PanelFill } from "@/lib/garments"; // @/lib/studio/garments before #20
import type { PrintCheck } from "@/lib/studio/preflight";
import type { InkSwap } from "@/lib/studio/ink";

/** Everything that is saved. Serializable, no functions, no Dates. */
export type StudioDoc = {
  version: 1;
  title: string;
  /** Catalog product id: a sandbox/Printful id, or an all-over template id such as "aop-hoodie". */
  productId: string;
  variantId: string;
  /** The design's print area on a placement blank ("front", "back", ...). "front" on all-over pieces. */
  placement: string;
  /** Present exactly when the product is all-over. */
  garment: GarmentDesign | null;
  layers: StudioLayer[];
  collectionId: string | null;
  /** Server id. On a first save it is null and `clientId` is used, see "Saving". */
  designId: string | null;
  /** Made by the client when the doc is created. Lets a retried first save find the same design. */
  clientId: string;
  /** The server's `updated_at` this doc was loaded from or last saved as. Null before the first save. */
  baseVersion: string | null;
  /** Inks moved off lime when the doc went to an all-over blank, so going back can restore them. */
  inkSwap: InkSwap;
  /** Present when this piece belongs to a set. The set owns the colorways. */
  set: {
    id: string;
    colorways: Colorway[];
    activeColorwayId: string;
    pieces: { designId: string; templateId: string; title: string }[];
  } | null;
};

export type StudioLayer = DesignLayer & { surface?: LayerSurface };

/** UI-only state. Never saved, never undone. */
export type StudioView = {
  face: "front" | "back";
  selectedPanelId: string | null;
  selectedLayerId: string | null;
};

export type StudioSession = {
  doc: StudioDoc;
  view: StudioView;
  past: StudioDoc[];   // capped at 100
  future: StudioDoc[];
  /** The last command's coalesce key, so a drag is one undo step. */
  lastKey: string | null;
  /** The doc as the server last confirmed it. Null for a doc never saved. */
  saved: StudioDoc | null;
};

/** Derived, never stored: deep-compare `doc` with `saved` (ignoring `baseVersion`). */
export function isDirty(session: StudioSession): boolean;

export type StudioCommand =
  | { type: "load"; doc: StudioDoc }                          // clears history
  | { type: "setProduct"; productId: string; variantId: string }
  | { type: "setTitle"; title: string }
  | { type: "setPanelFill"; panelId: string; fill: PanelFill; mirror?: boolean }
  | { type: "fillRole"; role: ColorRole; fill: PanelFill }    // every panel with that role
  | { type: "setRoleColor"; role: ColorRole; hex: string }    // active colorway
  | { type: "addColorway"; name: string }
  | { type: "renameColorway"; id: string; name: string }
  | { type: "removeColorway"; id: string }
  | { type: "selectColorway"; id: string }
  | { type: "addLayer"; layer: StudioLayer; index?: number }
  | { type: "updateLayer"; id: string; patch: Partial<StudioLayer>; coalesce?: string }
  | { type: "moveLayer"; id: string; x: number; y: number; coalesce?: string }
  | { type: "reorderLayer"; id: string; toIndex: number }
  | { type: "removeLayer"; id: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved"; doc: StudioDoc; designId: string; version: string }; // not an undo step

export type DispatchResult =
  /** `notice` tells the maker about a side effect, e.g. "2 layers didn't fit the joggers and were removed." */
  | { ok: true; session: StudioSession; notice?: string }
  | { ok: false; session: StudioSession; error: string };     // session unchanged

export function createSession(doc: StudioDoc): StudioSession;
export function dispatch(session: StudioSession, command: StudioCommand): DispatchResult;
export function setView(session: StudioSession, patch: Partial<StudioView>): StudioSession;

/** Read model for UIs and the AI designer. */
export function describe(doc: StudioDoc): {
  product: { id: string; name: string; construction: "aop" | "placement" };
  panels: { id: string; title: string; role: ColorRole; face: string; fill: PanelFill }[];
  colorways: Colorway[];
  activeColorwayId: string | null;
  layers: StudioLayer[];
};

export function checks(doc: StudioDoc): {
  checks: PrintCheck[];
  /** False with a reason while the printer can't take this piece yet. Not a failure. */
  orderable: { ok: true } | { ok: false; reason: string };
};

/** One entry per printer placement file. Empty until the placement map is confirmed. */
export type PrintFilePlan = {
  placement: string;      // printer placement key
  widthPx: number;
  heightPx: number;
  dpi: number;
  panels: PanelPlacement[]; // studio panels composited into this file (section 7)
};
export function printFilePlan(doc: StudioDoc): { ready: boolean; files: PrintFilePlan[]; todo: string[] };
```

**Rules every command obeys**

- Commands are plain JSON. A log of commands replayed on the same starting doc gives the
  same doc. That is what makes undo, the AI designer, and tests cheap.
- Validation lives in the command, not the UI: a bad hex, an unknown panel, a ninth
  colorway, or a layer id that does not exist returns `ok: false` with a sentence a maker
  can read, and the session is unchanged.
- Every successful doc-changing command pushes the previous doc onto `past` and clears
  `future`. The exception is a command whose `coalesce` key equals `lastKey`, which happens
  during a drag or a slider move. That command pushes nothing: `past` keeps the doc from
  *before the drag started*, and only `doc` changes. So one undo returns to where the drag
  began, not to a midpoint. Any command with a different key, or none, ends the run.
  `undo`/`redo` with an empty stack are `ok: true` no-ops. `undo`, `redo` and `load` reset
  `lastKey`.
- **Colorways in a set.** When `doc.set` is present, `setRoleColor`, `addColorway`,
  `renameColorway`, `removeColorway` and `selectColorway` change `doc.set` and copy the
  result into `doc.garment`. The adapter saves set colorways through `saveSetColors`, which
  updates every piece. A partner piece that's open elsewhere picks up the change on its
  next `load`.
- `setProduct` to a different all-over template keeps the colorways, resets panels to the
  new template's defaults, and keeps layers whose surface exists on the new product. The
  rest are dropped, and the result's `notice` says how many, so nothing vanishes silently.
  Moving onto an all-over blank runs `swapForAllOver` and stores its map in `doc.inkSwap`.
  Moving back runs `restoreInk` with that map, which skips any layer the maker recolored in
  between, then clears it. Because `inkSwap` lives in the doc, undo and redo carry it
  along.
- A product switch inside a set is refused. A set's pieces are fixed when the set is built.

**Saving** (the adapter, not the session)

- `doc` is the only thing the server sees. The adapter maps it to today's save payload,
  plus `clientId`, `baseVersion`, `placement` and the layers' `surface`.
- **First save.** `designId` is null, so the server creates the row with id = `clientId`,
  or returns the existing row if that id is already the caller's. A retry after a lost
  response then finds the same draft instead of making a second one.
- **Later saves.** The update runs `where id = … and updated_at = baseVersion`. No row
  updated means someone saved since this doc was loaded, and the save is refused with
  "This piece changed in another tab. Reload to see it." **Today** `saveDesign` overwrites
  unconditionally, so whichever save finishes last wins, even if it is the older one.
- On success the adapter dispatches `markSaved` with **the doc it sent**, not the current
  one. `saved` becomes that doc, so edits made while the save was in flight still count as
  unsaved. A response for an older save than the one already recorded is ignored.

**Tests that define done** (in `session.test.ts`): every command's happy path and each
refusal; undo after each command restores the exact previous doc (deep equal); a 50-step
drag coalesces to one undo that lands on the pre-drag doc; replaying a recorded command log
gives the same doc; `load` of every fixture saved under migrations 0005 and 0013
round-trips; `isDirty` is false after undoing back to the saved doc, and stays true when an
edit lands while a save is in flight; a placement design on `back` reloads on `back`; a
layer with a panel `surface` survives save and reload; lime ink swapped onto an all-over
blank comes back when the maker returns to a tee; colorway edits in a set reach every
piece.

## 7. Studio panels vs. printer placements

Printful does not print one file per studio panel. It takes one file per *placement* (for
example front, back, each sleeve, the hood) and cuts the panels out of those files. The
studio's piping, side panels and cuffs are regions inside those files. The joggers are
the extreme case: Printful takes only two files, one per leg, and the waistband, pocket,
seat and cuffs all come out of those (`docs/printful-aop-data.md`).

So the missing piece is a map from each studio panel to a rectangle inside a placement
file:

```ts
export type PanelPlacement = {
  panelId: string;
  placement: string;                      // printer placement key
  /** Bounding box in px inside that placement's file, used for DPI and layer positions. */
  rect: { x: number; y: number; w: number; h: number };
  /** The panel's real cut outline in that file's px, as an SVG path, traced from the printer's template. */
  clip: string;
  /** The same outline grown by the bleed. Fills and art paint up to this. */
  bleedClip: string;
};
```

A rectangle isn't enough on its own. Sleeves, cuffs and the hood aren't rectangles, and
neighboring panels can share a file, so a fill painted into the bare `rect` would spill
onto its neighbor. Print files are made per placement:

1. Clip to each panel's `bleedClip` and paint that panel's fill.
2. Draw the layers on their surfaces, clipped the same way.
3. Export a PNG at the placement's pixel size and 150 DPI.

The outlines come from the printer's print-file template for that placement (a template
image with the cut lines). They are traced once per product and checked against a sample
order. The studio's own drawing paths (`AopPanel.d`) are only for the preview.

**Consequence for `aopOrderable()`:** today it waits for a confirmed template *per studio
panel*, which can never be true for panels like piping that have no file of their own. It
should instead be true when **all** of these hold:
- the product's catalog variant ids are known (today's first condition, kept);
- every **placement** the product needs has a confirmed pixel size;
- every studio panel has a `PanelPlacement` with a traced `clip`. That change belongs to Agent 4, using the data
in `docs/printful-aop-data.md`.

## 8. What this spec does not cover

Storage of the files (see `docs/print-files-plan.md`, task C6), the cart and order
interface across Stripe and Printful (task C7), and pricing.
