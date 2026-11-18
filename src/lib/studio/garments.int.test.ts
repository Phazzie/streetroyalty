import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { addToCart } from "./cart.server.ts";
import { getDesign, getShopDesign, saveDesign } from "./designs.server.ts";
import {
  createMatchedSet,
  getOwnedSet,
  getSetBySlug,
  publishSet,
  saveSetColorways,
} from "./garments.server.ts";
import { defaultGarment } from "./garments.ts";
import { startCheckout } from "./orders.server.ts";
import { truncateAll } from "../../test/db.ts";
import { pngDataUrl } from "../../test/png.ts";
import { RECIPIENT, seedUser } from "../../test/seed.ts";

/**
 * All-over ordering stays closed until the panel templates are confirmed. The
 * colorway lines below are what an order carries once it opens, so these tests
 * open it the one way the wiring job will: through `aopOrderable`.
 */
const ordering = vi.hoisted(() => ({ open: false }));
vi.mock("../pod/aop-printful.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pod/aop-printful.ts")>();
  return {
    ...actual,
    aopOrderable: (id: number, panels: readonly string[]) =>
      ordering.open || actual.aopOrderable(id, panels),
  };
});

const PRINT = pngDataUrl(600, 450);
const MOCK = "data:image/svg+xml;utf8,%3Csvg%2F%3E";

function piece(title: string, garment = defaultGarment("aop-hoodie")) {
  return {
    title,
    productId: "aop-hoodie",
    variantId: "aop-hoodie-printed-m",
    placement: "front",
    layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
    printFile: PRINT,
    mockupUrl: MOCK,
    garment,
  };
}

beforeEach(async () => {
  ordering.open = false;
  await truncateAll();
  await seedUser("ada");
  await seedUser("bo");
});

describe("all-over pieces and sets", () => {
  it("stores colorways on an all-over piece and ignores them on a tee", async () => {
    const saved = await saveDesign("ada", piece("Lilac set"));
    expect(saved.garment?.colorways.map((item) => item.name)).toEqual([
      "Lilac / cream",
      "Lilac / white",
      "Black / gold",
    ]);
    const again = await getDesign("ada", saved.id);
    expect(again.garment?.activeColorwayId).toBe("lilac-cream");

    const tee = await saveDesign("ada", {
      title: "Plain tee",
      productId: "tee-heavy",
      variantId: "tee-heavy-black-m",
      placement: "front",
      layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
      garment: defaultGarment("aop-hoodie"),
    });
    expect(tee.garment).toBeNull();
    const bare = await saveDesign("ada", { ...piece("Bare hoodie"), garment: undefined });
    expect(bare.garment).toBeNull();
    const kept = await saveDesign("ada", {
      ...piece("Lilac set"),
      id: saved.id,
      garment: undefined,
    });
    expect(kept.garment?.activeColorwayId).toBe("lilac-cream");
    const namedByDefault = await createMatchedSet("ada", bare.id);
    expect(namedByDefault.title).toMatch(/Bare hoodie set/);
    const sql = await getSql();
    const partner = namedByDefault.pieces.find((item) => item.productId === "aop-joggers");
    await sql`update designs set garment_json = null where id = ${partner?.id ?? ""}`;
    const reread = await getOwnedSet("ada", namedByDefault.id);
    expect(reread.pieces.find((item) => item.id === partner?.id)?.garment.templateId).toBe(
      "aop-joggers",
    );
    await expect(
      saveDesign("ada", { ...piece("Bad"), garment: { templateId: "nope" } }),
    ).rejects.toThrow(/template/);
  });

  it("pairs a hoodie and joggers from one maker and sells the chosen colorway", async () => {
    const hoodie = await saveDesign("ada", piece("Night track"));
    await expect(createMatchedSet("ada", hoodie.id, "x")).rejects.toThrow(/Name the set/);
    await expect(
      createMatchedSet(
        "ada",
        (
          await saveDesign("ada", {
            title: "Plain tee",
            productId: "tee-heavy",
            variantId: "tee-heavy-black-m",
            placement: "front",
            layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
            printFile: pngDataUrl(1800, 2400),
            mockupUrl: MOCK,
          })
        ).id,
      ),
    ).rejects.toThrow(/all-over/);

    const set = await createMatchedSet("ada", hoodie.id, "Night track set");
    expect(set.provider).toBe("sandbox");
    expect(set.pieces.map((item) => item.productId).sort()).toEqual(["aop-hoodie", "aop-joggers"]);
    expect(await createMatchedSet("ada", hoodie.id)).toMatchObject({ id: set.id });
    await expect(getOwnedSet("bo", set.id)).rejects.toThrow(/not yours/);
    await expect(publishSet("ada", set.id)).rejects.toThrow(/print file/);

    const joggers = set.pieces.find((item) => item.productId === "aop-joggers");
    expect(joggers).toBeTruthy();
    await saveDesign("ada", {
      id: joggers?.id,
      title: joggers?.title ?? "Joggers",
      productId: "aop-joggers",
      variantId: "aop-joggers-printed-m",
      placement: "front",
      layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
      printFile: PRINT,
      garment: joggers?.garment,
    });
    await expect(publishSet("ada", set.id)).rejects.toThrow(/mockup/);
    await saveDesign("ada", {
      id: joggers?.id,
      title: joggers?.title ?? "Joggers",
      productId: "aop-joggers",
      variantId: "aop-joggers-printed-m",
      placement: "front",
      layers: [{ id: "t", type: "text", text: "SR", x: 0.5, y: 0.4, scale: 1, rotation: 0 }],
      printFile: PRINT,
      mockupUrl: MOCK,
      garment: joggers?.garment,
    });

    expect(await getSetBySlug(set.slug)).toBeNull();
    const published = await publishSet("ada", set.id);
    expect(published.status).toBe("published");
    expect((await publishSet("ada", set.id)).status).toBe("published");
    const shop = await getShopDesign(hoodie.slug);
    expect(shop.construction).toBe("aop");
    expect(shop.materialNote).toMatch(/not sewn cotton/);
    expect(shop.colorways).toHaveLength(3);
    expect(shop.set?.pieces).toHaveLength(2);
    expect(shop.set?.provider).toBe("sandbox");

    const shifted = await saveSetColorways("ada", set.id, published.colorways, "black-gold");
    expect(shifted.activeColorwayId).toBe("black-gold");
    expect((await getDesign("ada", hoodie.id)).garment?.activeColorwayId).toBe("black-gold");
    expect(await getSetBySlug(published.slug)).toMatchObject({ id: set.id });

    await expect(addToCart("ada", hoodie.id, "aop-hoodie-printed-m", "black-gold")).rejects.toThrow(
      /Ordering opens once/,
    );
    ordering.open = true;
    await expect(addToCart("ada", hoodie.id, "aop-hoodie-printed-m", "nope")).rejects.toThrow(
      /colorway/,
    );
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", "black-gold");
    const started = await startCheckout("ada", {
      recipient: RECIPIENT,
      shippingMethod: "STANDARD",
    });
    const sql = await getSql();
    const orders = await sql<{
      items_json: string;
    }>`select items_json from orders where id = ${started.orderId}`;
    const items = JSON.parse(orders[0]?.items_json ?? "[]") as {
      colorwayId: string;
      colorwayName: string;
    }[];
    expect(items[0]).toMatchObject({ colorwayId: "black-gold", colorwayName: "Black / gold" });
  });

  it("keeps the same size in two colorways as two cart lines", async () => {
    const hoodie = await saveDesign("ada", piece("Two Ways Hoodie"));
    const [first, second] = hoodie.garment?.colorways ?? [];
    if (!first || !second) throw new Error("the house colorways are missing");
    ordering.open = true;
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", first.id);
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", second.id);
    await addToCart("ada", hoodie.id, "aop-hoodie-printed-m", second.id);
    const sql = await getSql();
    const lines = await sql<{ colorway_id: string; quantity: number }>`
      select colorway_id, quantity from cart_items where user_id = 'ada' order by colorway_id
    `;
    expect(lines).toEqual(
      [
        { colorway_id: first.id, quantity: 1 },
        { colorway_id: second.id, quantity: 2 },
      ].sort((a, b) => a.colorway_id.localeCompare(b.colorway_id)),
    );
  });
});
