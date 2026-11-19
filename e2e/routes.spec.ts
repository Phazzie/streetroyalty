import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** Every page a visitor can land on, and the heading that proves it rendered. */
const ROUTES: [path: string, heading: string][] = [
  ["/", "Crown never"],
  ["/shop", "The drop"],
  ["/shop/lilac-set-hoodie", "The Lilac Hoodie"],
  ["/lab", "Street Royalty"],
  ["/studio", "Build the piece"],
  ["/rack", "The rack"],
  ["/gallery", "Your rack"],
  ["/cart", "Cart"],
  ["/orders", "Orders"],
  ["/checkout", "Checkout"],
  ["/login", "Sign in"],
  ["/battles", "Which one would you wear"],
  ["/say", "Say it"],
  ["/patterns", "Make the cloth first"],
  ["/clash", "The clash machine"],
  ["/made", "How it's made"],
  ["/math", "Do the math"],
  ["/episodes", "Episodes"],
  ["/episodes/episode-0", "Episode 0"],
  ["/m/nobody-here", "Nobody trades here"],
  ["/me", "Your name on the rack"],
  ["/go-live", "Go live"],
  ["/reports", "The report queue"],
];

for (const [path, heading] of ROUTES) {
  test.describe(path, () => {
    test("renders, with nothing in the console", async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });

    test("fits the screen without scrolling sideways", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "pixels of sideways scroll").toBeLessThanOrEqual(1);
    });

    test("has no serious accessibility problems", async ({ page }) => {
      // Contrast is measured on the finished page. Mid fade-in, text is see-through on
      // purpose, and on a busy machine the scan can land on such a frame.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // The "Created with Grok" pill is injected by the platform, not this app.
        .exclude("[data-grok-app-builder]")
        .analyze();
      const serious = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map(
          (violation) =>
            `${violation.id}: ${violation.nodes.length} × ${violation.nodes[0]?.target.join(" ")}`,
        );
      expect(serious).toEqual([]);
    });
  });
}

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, heading] of ROUTES.filter(([route]) =>
    ["/", "/shop", "/shop/lilac-set-hoodie"].includes(route),
  )) {
    test(`${path} still shows its content`, async ({ page }) => {
      await page.goto(path);
      const title = page.getByRole("heading", { name: heading }).first();
      await expect(title).toBeVisible();
      const opacity = await title.evaluate((element) => getComputedStyle(element).opacity);
      expect(Number(opacity)).toBeGreaterThan(0.9);
    });
  }
});
