# The file header (required on every file in src/, contracts/, mocks/)

Every code file starts with this comment. It is the file's plan: what it is for, what goes in and out, which seams it touches, and **plain-English pseudocode** of what it does, step by step. The AI copies it from the file's blueprint entry.

```ts
/**
 * Purpose: One sentence on what this file is for.
 * Inputs: What it receives and from where (name the contract types).
 * Outputs: What it hands off and to whom (name the contract types). What it throws.
 * Seams: catalog, config
 * Pseudocode:
 *   1. Ask the catalog API for the product with this id.
 *   2. If the API answers with an error, throw a CatalogError with its status and message.
 *   3. Check the answer against the Product contract; throw if it doesn't match.
 *   4. Return the checked product.
 */
```

Rules the hooks enforce:

- `Seams:` must include the seam this file is listed under in `blueprint/manifest.json`, and only seams that exist there.
- `Pseudocode:` needs at least **3** numbered steps (`1.`, `2.`, `3.` in order; the minimum is `minPseudocodeSteps` in `.seam/config.json`). A step may run onto the next line.
- Steps must be real sentences. `TODO`, `TBD`, `...`, `lorem ipsum`, "implement logic", or anything under three words is refused.
- The pseudocode **stays** after the file is built. Deleting it or cutting it below the minimum is refused in build phase. If the plan was wrong, fix the steps and log it in `blueprint/DRIFT-LOG.md`.
- Other comment styles work too: `//` lines at the top of the file, or for `.vue` / `.svelte` files an HTML comment `<!-- ... -->` with the same lines.

## What a skeleton looks like (skeleton phase)

In the skeleton phase every planned file exists, but only as its plan: the header, imports, types, and function signatures whose body is exactly `throw new Error('SKELETON: not built yet');`. No real code yet.

```ts
/**
 * Purpose: Fetch one product from the outside catalog API and hand back data that matches the catalog contract.
 * Inputs: a product id; optional fetch function and base URL (tests pass a mock fetch built from probe fixtures).
 * Outputs: a Product (contracts/catalog.ts). Throws CatalogError on HTTP errors or wrong-shaped data.
 * Seams: catalog, config
 * Pseudocode:
 *   1. Use the fetch function and base URL passed in, or the real fetch and the address from config.
 *   2. Ask the catalog API for /products/{id} and read the answer as JSON.
 *   3. If the API answered with an error status, throw a CatalogError with that status and the API's message.
 *   4. Check the answer against the Product contract; if it doesn't match, throw a CatalogError saying what broke.
 *   5. Return the checked product.
 */
import type { CatalogClient } from '../../contracts/catalog';

export class CatalogError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    throw new Error('SKELETON: not built yet');
  }
}

export interface CatalogDeps {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export function createCatalogClient(deps: CatalogDeps = {}): CatalogClient {
  throw new Error('SKELETON: not built yet');
}
```

Allowed in a skeleton: imports and re-exports, `type` / `interface` / `enum`, `declare const x: T;`, functions, arrow functions, and class methods whose body is only the SKELETON throw (a constructor may call `super(...)` first). Everything else (values, schemas, `if`, loops, `return`) waits for the build phase. Files in `contracts/` and `mocks/` are exempt: they are real code by design.
