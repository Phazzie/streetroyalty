import { expect, test as base, type Page } from "@playwright/test";

/** Console noise that is not the app's doing. */
const IGNORED = [
  /Download the React DevTools/,
  /grok\.com/,
  /favicon/,
  // Sign-up is limited to three every ten seconds per address. Parallel journeys hit that, and signUp() waits it out.
  /status of 429/,
];

export type Watched = {
  errors: string[];
  /** Call for a test where an error is the point, such as a page that is meant to be missing. */
  allow(pattern: RegExp): void;
};

/** Fail a test on any uncaught page error or console.error, which is how a blank page announces itself. */
export const test = base.extend<{ watched: Watched }>({
  watched: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: RegExp[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (IGNORED.some((pattern) => pattern.test(text))) return;
        errors.push(`console: ${text}`);
      });
      await use({ errors, allow: (pattern) => allowed.push(pattern) });
      const unexpected = errors.filter((error) => !allowed.some((pattern) => pattern.test(error)));
      expect(unexpected, "the page logged errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Pages are drawn on the server and become interactive once the script loads.
 * A click before that does nothing, so journeys wait for React to take over the
 * element they are about to use.
 */
export async function interactive(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const element = document.querySelector(target);
      return Boolean(element && Object.keys(element).some((key) => key.startsWith("__reactProps")));
    },
    selector,
    { timeout: 30_000 },
  );
}

/**
 * Journeys that create accounts, designs or orders. Against the local preview
 * that is a throwaway database in sandbox. Against a deployment named by
 * E2E_BASE_URL it would be real accounts, and in live mode real Printful
 * drafts and Stripe sessions, so those are skipped unless the deployment is a
 * disposable sandbox and E2E_ALLOW_WRITES=1 says so.
 */
export function writesData(): void {
  test.skip(
    Boolean(process.env.E2E_BASE_URL) && process.env.E2E_ALLOW_WRITES !== "1",
    "writes data; set E2E_ALLOW_WRITES=1 only for a disposable sandbox deployment",
  );
}

/** Stop before spending anything if the shop under test is not in sandbox, whatever the flags say. */
export async function expectSandbox(page: Page): Promise<void> {
  await expect(
    page
      .locator(".tag")
      .filter({ hasText: /^Sandbox$/i })
      .first(),
    "this journey places an order and only runs against a sandbox shop",
  ).toBeVisible();
}

let serial = 0;

/** A fresh account, signed in, landed on the studio. */
export async function signUp(
  page: Page,
  label = "ada",
): Promise<{ email: string; password: string }> {
  serial += 1;
  const email = `${label}-${Date.now()}-${serial}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "correct horse battery";
  await page.goto("/login");
  await interactive(page, "form");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Name").fill(label);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // Press until the account exists. A refusal here is the sign-up rate limit, which clears in seconds.
  await expect(async () => {
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/studio", { timeout: 5000 });
  }).toPass({ timeout: 50_000, intervals: [3000] });
  return { email, password };
}

/** Build and publish one tee in the studio. Publishing lands on the rack, where the piece is now for sale. */
export async function publishTee(page: Page, title: string): Promise<void> {
  await page.goto("/studio");
  await interactive(page, "#piece-title");
  await expectSandbox(page);
  await expect(page.getByText("Size", { exact: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(title);
  // The page can still be settling as fonts arrive, and a click that lands mid-shift misses.
  await expect(async () => {
    await page.getByRole("button", { name: "Mockup", exact: true }).click();
    await expect(page.getByRole("img", { name: "Product mockup" })).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.waitForURL("**/rack");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
}

export const ADDRESS = {
  "Full name": "Ada Royal",
  Email: "ada@example.com",
  Street: "1 Crown St",
  City: "Brooklyn",
  State: "NY",
  "Postal code": "11201",
  Country: "US",
};
