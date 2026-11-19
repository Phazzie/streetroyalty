import { ADDRESS, expect, publishTee, signUp, test, writesData } from "./fixtures";

/** Two people, two browsers. The second one goes looking for the first one's things. */
test("one account cannot see or reach another account's design, cart or order", async ({
  page,
  browser,
}) => {
  writesData();
  // Ada designs a tee, leaves one in her cart, and places an order.
  await signUp(page, "ada");
  const title = `Ada Private ${Date.now()}`;
  await publishTee(page, title);
  await page.getByRole("link", { name: title }).click();
  const slug = new URL(page.url()).pathname.split("/").pop() ?? "";
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.waitForURL("**/cart");
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  for (const [label, value] of Object.entries(ADDRESS)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Shipping rates" }).click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Test payment" })).toBeVisible();

  // Bo signs up in a separate browser with no shared cookies.
  const context = await browser.newContext();
  const bo = await context.newPage();
  await signUp(bo, "bo");

  await bo.goto("/cart");
  await expect(bo.getByText("Nothing in the bag.")).toBeVisible();

  await bo.goto("/orders");
  await expect(bo.getByText("No orders yet.")).toBeVisible();

  await bo.goto("/gallery");
  await expect(bo.getByRole("heading", { name: "Your rack" })).toBeVisible();
  await expect(bo.getByText(title)).toHaveCount(0);

  // What Ada published is public, by design. Bo can see it on the rack and buy it.
  await bo.goto(`/rack/${slug}`);
  await expect(bo.getByRole("heading", { name: title })).toBeVisible();

  // But it lands in Bo's cart, and Ada's is untouched.
  await bo.getByRole("button", { name: "Add to cart" }).click();
  await bo.waitForURL("**/cart");
  await expect(bo.getByText(title)).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText(/\$30\.69 before shipping/)).toBeVisible();

  await context.close();
});

test("the studio's private pages ask a signed-out visitor to sign in, and show nothing", async ({
  page,
}) => {
  for (const path of ["/cart", "/orders", "/gallery", "/checkout"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByText(/before shipping|Test payment/)).toHaveCount(0);
  }
});
