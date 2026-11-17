/** Imports nothing from the app, so it can run before the app opens a database connection. */

/**
 * These tests empty every table before each case. That is fine for the
 * in-memory database and for a throwaway one, and a disaster for a real one,
 * so a configured database has to say it is for tests in its own name.
 */
export function disposableDatabaseProblem(url: string | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  let name = "";
  try {
    name = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ""));
  } catch {
    return "DATABASE_URL is set but is not a URL the tests can read. Unset it to use the in-memory database.";
  }
  if (/(^|[_-])test($|[_-])/i.test(name)) return null;
  return (
    `DATABASE_URL points at the database "${name}". The integration tests delete every row before each test, ` +
    `so they only run against a database whose name contains "test" (for example "${name || "app"}_test"). ` +
    "Unset DATABASE_URL to use the in-memory database."
  );
}

export function assertDisposableDatabase(): void {
  const problem = disposableDatabaseProblem(process.env.DATABASE_URL);
  if (problem) throw new Error(problem);
}
