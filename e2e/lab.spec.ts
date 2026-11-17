import { expect, interactive, test } from "./fixtures";

/** The lab and the crown with no xAI key: nothing can be generated, and nothing should pretend otherwise. */

const FACE = "e2e/assets/face.png";

test("the stylist plans an outfit from house picks and builds nothing until told to", async ({
  page,
}) => {
  const generation: string[] = [];
  page.on("request", (request) => {
    const body = request.postData() ?? "";
    if (
      request.method() === "POST" &&
      /generatePiece|generateLook|startRunway/.test(request.url() + body)
    ) {
      generation.push(request.url());
    }
  });

  await page.goto("/lab");
  await interactive(page, "main button, button");
  await page.getByRole("button", { name: "Open it" }).click();
  // Three photos lock a face. The same picture three times is enough to get past the door.
  for (let shot = 0; shot < 3; shot += 1) {
    await page.locator("#photo").setInputFiles(FACE);
    await expect(
      page.getByText(shot < 2 ? `${shot + 1} of 3.` : "The button turns on", { exact: false }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Use these photos" }).click();

  await page.getByRole("button", { name: "Dress me for an occasion" }).click();
  await page.getByLabel("The occasion").fill("A wedding in June");
  await page.getByRole("button", { name: "Plan", exact: true }).click();

  await expect(page.getByText("House picks, no key needed.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Build all [34]/ })).toBeVisible();
  expect(generation, "a paid picture was requested before Build was pressed").toEqual([]);

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("button", { name: "Dress me for an occasion" })).toBeVisible();
  expect(generation).toEqual([]);
});

test("the rack search answers from the words typed when there is no key", async ({ page }) => {
  await page.goto("/rack");
  await interactive(page, "form");
  await page.getByLabel("Search the rack").fill("pink hoodie");
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText("Matched with the words you typed.")).toBeVisible();
});
