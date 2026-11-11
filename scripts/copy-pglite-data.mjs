import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Nitro inlines @electric-sql/pglite and drops the sibling wasm/data files
 * the module loads via import.meta.url. Copy them next to the bundled module
 * so the production server can boot the embedded database when DATABASE_URL
 * is unset. Neon is used instead when that variable is set.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "node_modules/@electric-sql/pglite/dist");
const targetDir = join(root, ".vercel/output/functions/__server.func/_libs");

if (!existsSync(sourceDir) || !existsSync(targetDir)) {
  console.log("[pglite] package or build output missing — skipping copy");
  process.exit(0);
}

const names = readdirSync(sourceDir).filter((name) => name.endsWith(".wasm") || name.endsWith(".data"));
for (const name of names) {
  copyFileSync(join(sourceDir, name), join(targetDir, name));
}
console.log(`[pglite] copied ${names.join(", ")}`);
