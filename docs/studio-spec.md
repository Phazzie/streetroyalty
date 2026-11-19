# Design studio spec: all-over panels, colorways, sets, print files

Last updated: Nov 19, 2026 · Task C4 in `docs/PARALLEL-WORK.md`

This is the contract Agent 3 builds the editor session module against, and the same
contract a future AI brand designer drives. It describes the target. Where today's code
differs, the "Today" notes say so. Type names follow PR #20's `src/lib/garments` module.

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
  within the garment (`addColorway` suffixes a number on a clash).
- Adding a colorway copies the active one and makes the copy active.
- Removing the active colorway makes the first remaining one active. The last colorway
  cannot be removed.
- A colorway still referenced by a cart line cannot be removed without warning the maker
  that the bag line will lose its name (today `priceCart` handles it at checkout).
- **Sets.** A set is two or more pieces from the same printer, each with its own panels and
  layers, sharing one list of colorways and one active colorway. Changing a role color in
  one piece changes it in all. Partners: hoodie and joggers; track jacket and joggers.
  Pieces from different printers cannot be in one set (PR #20 enforces this).
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

Stored as an optional `surface` field on the layer. **Absent means
`{ kind: "placement", placement: "front" }`**, which is how every saved layer reads today,
so no migration is needed. On an all-over piece, a front-placement layer is drawn inside
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
| `orderable` | info, not a failure | `aopOrderable()` is false: the piece can be saved and published, not bought yet |

Numbers for cut line, bleed and safe margin come from Printful's print-file templates per
placement. Until they are known (`aop-printful.ts`, `docs/printful-aop-data.md`), `bleed`
and `safe-zone` say "not checked yet: the printer template isn't loaded" rather than pass.
A check that cannot run never reports pass.

## 6. The session API

One pure module, `src/lib/studio/session.ts`, with no React and no server calls. The editor
holds a `StudioSession` in a reducer; the AI designer holds one in memory. Both change it
only through `dispatch(session, command)`. Server calls (mockup, save, publish) live in a
thin adapter on top and take a `StudioDoc`.

```ts
import type { DesignLayer } from "@/lib/pod/types";
import type { ColorRole, Colorway, GarmentDesign, PanelFill } from "@/lib/garments";
import type { PrintCheck } from "@/lib/studio/preflight";

/** Everything that is saved. Serializable, no functions, no Dates. */
export type StudioDoc = {
  version: 1;
  title: string;
  /** Catalog product id: a sandbox/Printful id, or an all-over template id such as "aop-hoodie". */
  productId: string;
  variantId: string;
  /** Present exactly when the product is all-over. */
  garment: GarmentDesign | null;
  layers: StudioLayer[];
  collectionId: string | null;
  /** Saved id once the server has it. */
  designId: string | null;
  setId: string | null;
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
  /** True when doc differs from the last saved doc. */
  dirty: boolean;
};

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
  | { type: "markSaved"; designId: string };                  // not an undo step

export type DispatchResult =
  | { ok: true; session: StudioSession }
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

export function checks(doc: StudioDoc): PrintCheck[];

/** One entry per printer placement file. Empty until the placement map is confirmed. */
export type PrintFilePlan = {
  placement: string;      // printer placement key
  widthPx: number;
  heightPx: number;
  dpi: number;
  panels: string[];       // studio panels composited into this file
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
  `future`, except when its `coalesce` key equals `lastKey` (a drag or a slider): then it
  replaces the top state instead of pushing. `undo`/`redo` with an empty stack are `ok: true`
  no-ops.
- `setProduct` to a different all-over template keeps the colorways, resets panels to the
  new template's defaults, and keeps layers whose surface exists on the new product (the
  rest are dropped and the result says how many). Switching between all-over and placement
  runs the ink swap in `ink.ts` exactly as today.
- `doc` is the only thing the server sees. `savePiece` takes `StudioDoc` minus `designId`.
  The adapter maps it to today's save payload; nothing changes in the database.

**Tests that define done** (in `session.test.ts`): every command's happy path and each
refusal; undo after each command restores the exact previous doc (deep equal); a 50-step
drag coalesces to one undo; replaying a recorded command log gives the same doc; `load` of
every fixture saved under migrations 0005 and 0013 round-trips; `dirty` flips on change and
clears on `markSaved`.

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
  rect: { x: number; y: number; w: number; h: number }; // px inside that placement's file
};
```

Print files are then made per placement: paint each panel's fill into its rect, draw the
layers on their surfaces, extend art to the bleed, and export PNG at the placement's pixel
size and 150 DPI.

**Consequence for `aopOrderable()`:** today it waits for a confirmed template *per studio
panel*, which can never be true for panels like piping that have no file of their own. It
should instead be true when every **placement** the product needs has a confirmed size and
every studio panel has a `PanelPlacement`. That change belongs to Agent 4, using the data
in `docs/printful-aop-data.md`.

## 8. What this spec does not cover

Storage of the files (see `docs/print-files-plan.md`, task C6), the cart and order
interface across Fourthwall, Stripe and Printful (task C7), and pricing.
