import { getSql, type Sql } from "@/lib/db.ts";
import { assertDisposableDatabase } from "./db-guard.ts";

/**
 * The app's own database handle. With no DATABASE_URL that is Postgres in
 * memory with every file in migrations/ applied, the same path the preview
 * takes. With DATABASE_URL set it is that server, migrated beforehand by
 * scripts/migrate.mjs, which is how CI checks the two backends agree.
 */
export function testSql(): Promise<Sql> {
  return getSql();
}

/** Quoted names, cached after the first lookup. The schema does not change during a run. */
let cachedTables: string | null = null;

function quoteTable(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error("Refusing to truncate a table whose name is not a plain identifier.");
  }
  return `"${name}"`;
}

async function tableList(sql: Sql): Promise<string> {
  if (cachedTables) return cachedTables;
  const tables = await sql<{ tablename: string }>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_migrations'
    order by tablename
  `;
  cachedTables = tables.map((table) => quoteTable(table.tablename)).join(", ");
  return cachedTables;
}

function transientTruncateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /deadlock|could not obtain lock|lock timeout|serialization|database is locked|40P01|55P03|40001/i.test(
    message,
  );
}

/** Empty every table but keep the schema, so each test starts from nothing. */
export async function truncateAll(): Promise<void> {
  assertDisposableDatabase();
  const sql = await getSql();
  let names = await tableList(sql);
  if (!names) return;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await sql.query(`truncate ${names} restart identity cascade`);
      return;
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      // A migration applied after the cache was taken. Read the list again once.
      if (/does not exist/i.test(message)) {
        cachedTables = null;
        names = await tableList(sql);
        if (!names) return;
        continue;
      }
      if (!transientTruncateError(error) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw last;
}
