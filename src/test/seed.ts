import { getSql } from "@/lib/db.ts";
import { addToCart } from "@/lib/studio/cart.server.ts";
import { publishDesign, saveDesign } from "@/lib/studio/designs.server.ts";
import { pngDataUrl } from "./png.ts";

/** Sandbox catalog ids. The built-in blank list is the fixture. */
export const TEE = {
  productId: "tee-heavy",
  variantId: "tee-heavy-black-m",
  otherSize: "tee-heavy-black-l",
};

export const RECIPIENT = {
  name: "Ada Royal",
  address1: "1 Crown St",
  city: "Brooklyn",
  stateCode: "NY",
  countryCode: "US",
  zip: "11201",
  email: "ada@example.com",
};

export async function seedUser(id: string, email = `${id}@example.com`): Promise<string> {
  const sql = await getSql();
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified")
    values (${id}, ${id}, ${email}, true)
    on conflict ("id") do nothing
  `;
  return id;
}

/** A saved design with a print file and a mockup, made through the same code the studio calls. */
export async function seedDesign(
  userId: string,
  options: { title?: string; published?: boolean; variantId?: string; productId?: string } = {},
) {
  const design = await saveDesign(userId, {
    title: options.title ?? "Crown Tee",
    productId: options.productId ?? TEE.productId,
    variantId: options.variantId ?? TEE.variantId,
    placement: "front",
    layers: [{ id: "t1", type: "text", text: "CROWN", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
    printFile: pngDataUrl(1800, 2400),
    mockupUrl: "data:image/svg+xml;utf8,%3Csvg%2F%3E",
  });
  return options.published ? publishDesign(userId, design.id) : design;
}

/** A user with one design in the cart, ready for checkout. */
export async function seedCart(userId: string, quantity = 1) {
  await seedUser(userId);
  const design = await seedDesign(userId);
  for (let index = 0; index < quantity; index += 1)
    await addToCart(userId, design.id, TEE.variantId);
  return design;
}
