import { beforeEach, describe, expect, it } from "vitest";
import { getSql } from "../db.ts";
import {
  addToCart,
  listCart,
  nudgeCart,
  priceCart,
  quoteShipping,
  updateCart,
} from "./cart.server.ts";
import { truncateAll } from "../../test/db.ts";
import { RECIPIENT, TEE, seedDesign, seedUser } from "../../test/seed.ts";

const TEE_PRICE = 3069; // sandbox wholesale 1395 at the default 2.2 markup, rounded the way the shop rounds

async function onlyLine(userId: string) {
  const lines = await listCart(userId);
  expect(lines).toHaveLength(1);
  const line = lines[0];
  if (!line) throw new Error("no cart line");
  return line;
}

beforeEach(async () => {
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("adding to the cart", () => {
  it("lets the owner buy their own unpublished design", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    expect(await onlyLine("ada")).toMatchObject({ designId: design.id, quantity: 1 });
  });

  it("refuses someone else's unpublished design", async () => {
    const design = await seedDesign("ada");
    await expect(addToCart("bo", design.id, TEE.variantId)).rejects.toThrow(/not for sale/);
    expect(await listCart("bo")).toEqual([]);
  });

  it("lets anyone buy a published design", async () => {
    const design = await seedDesign("ada", { published: true });
    await addToCart("bo", design.id, TEE.variantId);
    expect(await onlyLine("bo")).toMatchObject({ designId: design.id });
  });

  it("refuses a design that does not exist", async () => {
    await expect(addToCart("ada", "no-such-design", TEE.variantId)).rejects.toThrow(/not for sale/);
  });

  it("refuses a size in a different color than the design was made in", async () => {
    const design = await seedDesign("ada");
    await expect(addToCart("ada", design.id, "tee-heavy-bone-m")).rejects.toThrow(
      /size in this color/,
    );
  });

  it("refuses a variant from another product", async () => {
    const design = await seedDesign("ada");
    await expect(addToCart("ada", design.id, "hat-dad-black-one-size")).rejects.toThrow();
  });

  it("counts the same piece and size as one line, and a second size as another", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    await addToCart("ada", design.id, TEE.variantId);
    await addToCart("ada", design.id, TEE.otherSize);
    const lines = await listCart("ada");
    expect(lines.map((line) => line.quantity).sort()).toEqual([1, 2]);
  });

  it("stops at ten of one piece however many times it is added", async () => {
    const design = await seedDesign("ada");
    for (let index = 0; index < 13; index += 1) await addToCart("ada", design.id, TEE.variantId);
    expect((await onlyLine("ada")).quantity).toBe(10);
  });

  it("stops at ten when the adds arrive together", async () => {
    const design = await seedDesign("ada");
    await Promise.all(Array.from({ length: 15 }, () => addToCart("ada", design.id, TEE.variantId)));
    expect((await onlyLine("ada")).quantity).toBe(10);
  });
});

describe("changing a quantity", () => {
  async function lineFor(userId: string) {
    const design = await seedDesign(userId);
    await addToCart(userId, design.id, TEE.variantId);
    return onlyLine(userId);
  }

  it("sets an exact quantity, capped at ten", async () => {
    const line = await lineFor("ada");
    await updateCart("ada", line.id, 4);
    expect((await onlyLine("ada")).quantity).toBe(4);
    await updateCart("ada", line.id, 500);
    expect((await onlyLine("ada")).quantity).toBe(10);
  });

  it.each([0, -3])("removes the line when the quantity is set to %s", async (quantity) => {
    const line = await lineFor("ada");
    await updateCart("ada", line.id, quantity);
    expect(await listCart("ada")).toEqual([]);
  });

  it("refuses a quantity that is not a number", async () => {
    const line = await lineFor("ada");
    await expect(updateCart("ada", line.id, Number.NaN)).rejects.toThrow(/number/);
    expect((await onlyLine("ada")).quantity).toBe(1);
  });

  it("moves by one in either direction", async () => {
    const line = await lineFor("ada");
    await nudgeCart("ada", line.id, 1);
    await nudgeCart("ada", line.id, 1);
    await nudgeCart("ada", line.id, -1);
    expect((await onlyLine("ada")).quantity).toBe(2);
  });

  it("removes the line when the last one is taken away", async () => {
    const line = await lineFor("ada");
    await nudgeCart("ada", line.id, -1);
    expect(await listCart("ada")).toEqual([]);
  });

  it("refuses a step bigger than one", async () => {
    const line = await lineFor("ada");
    await expect(nudgeCart("ada", line.id, 5)).rejects.toThrow(/by one/);
    await expect(nudgeCart("ada", line.id, 0)).rejects.toThrow(/by one/);
  });

  it("counts every click when five land at once", async () => {
    const line = await lineFor("ada");
    await Promise.all(Array.from({ length: 5 }, () => nudgeCart("ada", line.id, 1)));
    expect((await onlyLine("ada")).quantity).toBe(6);
  });

  it("stops at ten when twenty clicks land at once", async () => {
    const line = await lineFor("ada");
    await Promise.all(Array.from({ length: 20 }, () => nudgeCart("ada", line.id, 1)));
    expect((await onlyLine("ada")).quantity).toBe(10);
  });

  it("never goes below one line or into negative numbers when minus is hammered", async () => {
    const line = await lineFor("ada");
    await updateCart("ada", line.id, 3);
    await Promise.all(Array.from({ length: 9 }, () => nudgeCart("ada", line.id, -1)));
    const lines = await listCart("ada");
    expect(lines.length === 0 || (lines[0]?.quantity ?? 0) >= 1).toBe(true);
  });
});

describe("pricing", () => {
  it("prices from the catalog", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    expect((await onlyLine("ada")).unitCents).toBe(TEE_PRICE);
  });

  it("ignores a price that was tampered with on the stored design", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    const sql = await getSql();
    await sql`update designs set retail_cents = 1 where id = ${design.id}`;
    expect((await onlyLine("ada")).unitCents).toBe(TEE_PRICE);
    expect((await priceCart("ada")).lines[0]?.unitCents).toBe(TEE_PRICE);
  });

  it("follows the markup that is set today, not the one a design was saved under", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    process.env.STUDIO_MARKUP = "3";
    expect((await priceCart("ada")).lines[0]?.unitCents).toBeGreaterThan(TEE_PRICE);
  });

  it("refuses to price an empty cart", async () => {
    await expect(priceCart("ada")).rejects.toThrow(/empty/);
  });

  it("refuses to price a piece with no print file", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    const sql = await getSql();
    await sql`update designs set print_file_id = null where id = ${design.id}`;
    await expect(priceCart("ada")).rejects.toThrow(/missing a print file/);
  });

  it("gives each line a signed print-file URL", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    const url = new URL((await priceCart("ada")).lines[0]?.fileUrl ?? "");
    expect(url.pathname).toMatch(/^\/api\/print-files\/[0-9a-f-]{36}$/);
    expect(url.searchParams.get("token")).toBeTruthy();
  });

  it("quotes shipping for what is in the cart", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    await addToCart("ada", design.id, TEE.variantId);
    const quote = await quoteShipping("ada", RECIPIENT);
    expect(quote.subtotalCents).toBe(TEE_PRICE * 2);
    expect(quote.rates.map((rate) => rate.id)).toEqual(["STANDARD", "EXPRESS"]);
    expect(quote.rates[0]?.rateCents).toBe(595 + 250);
  });

  it("refuses to quote an address it cannot ship to", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    await expect(quoteShipping("ada", { ...RECIPIENT, zip: "" })).rejects.toThrow(/postal code/);
  });
});

describe("one person's cart is not another's", () => {
  it("shows each person only their own lines", async () => {
    const design = await seedDesign("ada", { published: true });
    await addToCart("ada", design.id, TEE.variantId);
    await addToCart("bo", design.id, TEE.otherSize);
    expect((await listCart("ada")).map((line) => line.variantId)).toEqual([TEE.variantId]);
    expect((await listCart("bo")).map((line) => line.variantId)).toEqual([TEE.otherSize]);
  });

  it("ignores a change aimed at someone else's line", async () => {
    const design = await seedDesign("ada");
    await addToCart("ada", design.id, TEE.variantId);
    const line = await onlyLine("ada");
    await updateCart("bo", line.id, 9);
    await updateCart("bo", line.id, 0);
    await nudgeCart("bo", line.id, 1);
    await nudgeCart("bo", line.id, -1);
    expect((await onlyLine("ada")).quantity).toBe(1);
  });
});
