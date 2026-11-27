import { ADDRESS, expect, publishTee, signUp, test, writesData } from "./fixtures";

test.describe("from nothing to a placed order", () => {
  writesData();

  test("a new account designs a tee, buys it, and sees it on its way to print", async ({
    page,
  }) => {
    await signUp(page);
    const title = `Crown Tee ${Date.now()}`;
    await publishTee(page, title);

    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "L", exact: true }).click();
    await page.getByRole("button", { name: /add to (cart|bag)/i }).click();

    await page.waitForURL("**/cart");
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: `More ${title}` }).click();
    await expect(page.getByText(/before shipping/)).toContainText("$70");

    await page.getByRole("link", { name: "Checkout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    for (const [label, value] of Object.entries(ADDRESS)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByRole("button", { name: "Shipping rates" }).click();
    await expect(page.getByText("Standard (sandbox)")).toBeVisible();
    await page.getByRole("button", { name: "Place order" }).click();

    await expect(page.getByRole("heading", { name: "Test payment" })).toBeVisible();
    await expect(page.getByText(/is a draft for \$78\.45/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm test payment" }).click();

    await page.waitForURL("**/orders");
    await expect(page.getByText("submitted", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("$78.45")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("orders.png"), fullPage: true });

    await page.goto("/cart");
    await expect(page.getByText("Nothing in the bag.")).toBeVisible();
  });
});
