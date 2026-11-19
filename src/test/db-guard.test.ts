import { describe, expect, it } from "vitest";
import { disposableDatabaseProblem } from "./db-guard.ts";

describe("the guard in front of the tests that empty the database", () => {
  it.each([
    ["no database configured", undefined],
    ["an empty setting", "   "],
    ["a local test database", "postgres://postgres@127.0.0.1:5432/streetroyalty_test"],
    ["a CI test database", "postgres://postgres:postgres@127.0.0.1:5432/sr_test"],
    ["a database named test", "postgres://u:p@db.example.com/test"],
    ["a test database with options", "postgres://u:p@db.example.com/app-test-2?sslmode=require"],
  ])("lets the tests run with %s", (_what, url) => {
    expect(disposableDatabaseProblem(url)).toBeNull();
  });

  it.each([
    [
      "the production database",
      "postgres://u:p@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require",
    ],
    ["a database with no name", "postgres://u:p@db.example.com/"],
    ["a name that only happens to contain the letters", "postgres://u:p@db.example.com/contest"],
    [
      "a name that only happens to contain the letters, again",
      "postgres://u:p@db.example.com/latest",
    ],
    ["a test host but a real database", "postgres://u:p@test.example.com/streetroyalty"],
    ["something that is not a URL", "not a url"],
  ])("refuses to run against %s", (_what, url) => {
    expect(disposableDatabaseProblem(url)).toMatch(/DATABASE_URL/);
  });

  it("names the database and says what to do", () => {
    const problem = disposableDatabaseProblem("postgres://u:p@host/neondb");
    expect(problem).toContain('"neondb"');
    expect(problem).toContain("neondb_test");
    expect(problem).toContain("Unset DATABASE_URL");
  });
});
