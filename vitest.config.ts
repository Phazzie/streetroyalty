import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Tests run on their own config. The app's vite.config.ts loads the TanStack
 * and Nitro plugins, which a test run neither needs nor survives.
 *
 * Projects, by file name:
 *   *.test.ts          unit: pure logic, node
 *   *.int.test.ts      integration: real SQL on in-memory Postgres, mocked network
 *   *.dom.test.tsx     components in happy-dom
 *   *.browser.test.ts  code that needs a real canvas, in Chromium
 *   *.live.test.ts     real paid APIs, only with LIVE=1
 */

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Cloud sessions ship one Chromium that does not match the pinned Playwright build.
const bundledChromium = "/opt/pw-browsers/chromium";
const chromiumPath =
  process.env.PW_CHROMIUM_PATH || (existsSync(bundledChromium) ? bundledChromium : undefined);

const special = [
  "src/**/*.int.test.ts",
  "src/**/*.dom.test.tsx",
  "src/**/*.browser.test.ts",
  "src/**/*.live.test.ts",
];

const moneyAndAccess = { lines: 90, branches: 85 };

export default defineConfig({
  resolve: { alias },
  test: {
    // A flaky test is a broken test. Nothing below the browser journeys retries.
    retry: 0,
    sequence: { shuffle: Boolean(process.env.CI) },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/components/studio/print-file.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**", "src/routeTree.gen.ts"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        "src/lib/pod/**": moneyAndAccess,
        "src/lib/payments/**": moneyAndAccess,
        "src/lib/studio/*.server.ts": moneyAndAccess,
        "src/lib/ai/guard.server.ts": moneyAndAccess,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
          exclude: special,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          setupFiles: ["src/test/setup/integration.ts"],
          // One database per file, and the files share nothing.
          pool: "forks",
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.dom.test.tsx"],
          setupFiles: ["src/test/setup/dom.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright({
              launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
            }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "live",
          environment: "node",
          include: process.env.LIVE === "1" ? ["src/**/*.live.test.ts"] : [],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
