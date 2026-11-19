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

/** Empty every table but keep the schema, so each test starts from nothing. */
export async function truncateAll(): Promise<void> {
  assertDisposableDatabase();
  const sql = await getSql();
  const tables = await sql<{ tablename: string }>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map((table) => `"${table.tablename}"`).join(", ");
  await sql.query(`truncate ${names} restart identity cascade`);
}
