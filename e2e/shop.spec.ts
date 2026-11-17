import { expect, interactive, test } from "./fixtures";

test.describe("the shop, with no Fourthwall token", () => {
  test("says it is a preview on the shelf and on a product", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "The drop" })).toBeVisible();
    await page.goto("/shop/lilac-set-hoodie");
    await expect(page.getByRole("heading", { name: "The Lilac Hoodie" })).toBeVisible();
    await expect(page.getByText("Preview drop. This piece is not for sale yet.")).toBeVisible();
  });

  test("asks for a size before adding to the bag", async ({ page }) => {
    await page.goto("/shop/lilac-set-hoodie");
    await interactive(page, "h1");
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("alert")).toHaveText("Pick a size first.");
    await expect(page.getByRole("button", { name: "Open the bag", exact: true })).toBeVisible();
  });

  test("keeps the bag through a reload, and will not take money for a preview piece", async ({
    page,
  }) => {
    await page.goto("/shop/lilac-set-hoodie");
    await interactive(page, "h1");
    await page
      .getByRole("group", { name: /Size/ })
      .getByRole("button", { name: "M", exact: true })
      .click();
    await page.getByRole("button", { name: "Add to bag" }).click();

    const bag = page.getByRole("dialog");
    await expect(bag).toBeVisible();
    await expect(bag.getByText("The Lilac Hoodie")).toBeVisible();
    await bag.getByRole("button", { name: /One more/ }).click();

    await page.reload();
    await interactive(page, "h1");
    await page.getByRole("button", { name: "Open the bag, 2 pieces" }).click();
    await expect(page.getByRole("dialog").getByText("The Lilac Hoodie")).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: "Checkout" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText(/preview|not for sale|cannot be bought|nothing can be bought/i),
    ).toBeVisible();
    expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL ?? "").host);
  });

  test("answers a link to a piece that does not exist with a way back", async ({
    page,
    watched,
  }) => {
    watched.allow(/status of 404/);
    const response = await page.goto("/shop/no-such-piece");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Not on the shelf." })).toBeVisible();
    await expect(page.getByText("Back to the drop")).toBeVisible();
  });
});
