import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The slice of the suite mutation testing runs: plain unit tests for the code
 * that decides money and access. No database, no browser, so thousands of
 * mutants can each be checked in a few milliseconds.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: [
      "src/lib/pod/*.test.ts",
      "src/lib/payments/*.test.ts",
      "src/lib/studio/*.test.ts",
      "src/lib/ai/limits.test.ts",
    ],
    exclude: ["src/**/*.int.test.ts"],
  },
});
