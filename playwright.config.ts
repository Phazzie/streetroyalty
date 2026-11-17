import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * Browser journeys against the built app, not the dev server, because that is
 * what ships. With no E2E_BASE_URL this builds nothing itself: it starts the
 * production preview on 8081 (run `npm run build` first) or reuses one already
 * up. Point E2E_BASE_URL at a deployment to walk that instead. The journeys
 * that create accounts and orders are then skipped, unless E2E_ALLOW_WRITES=1
 * says the deployment is a disposable sandbox, and they still stop if the shop
 * does not show its sandbox badge.
 */

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:8081";

// Cloud sessions ship one Chromium that does not match the pinned Playwright build.
const bundled = "/opt/pw-browsers/chromium";
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync(bundled) ? bundled : undefined);

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "phone",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/with-app-env.mjs vite preview --host 127.0.0.1 --port 8081",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          // Sandbox printing and payments, real secrets for nothing.
          POD_MODE: "sandbox",
          PAYMENTS_MODE: "sandbox",
          // Sign-in refuses requests from any origin but this one.
          BETTER_AUTH_URL: baseURL,
          BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e",
          STRIPE_WEBHOOK_SECRET: "whsec_e2e",
          PRINTFUL_WEBHOOK_SECRET: "printful-e2e",
          XAI_API_KEY: "",
          FOURTHWALL_STOREFRONT_TOKEN: "",
        },
      },
});
