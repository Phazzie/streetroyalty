import { http, HttpResponse } from "msw";
import { server } from "./server.ts";

const API = "https://api.printful.com";

export const PRINTFUL_TEE = { productId: "71", variantId: "4011" };

type FakeOrder = { id: number; external_id: string; status: string };

/**
 * A stand-in for Printful's API with one tee in its catalog. It keeps orders
 * the way Printful does: a draft until confirmed, pending after. `confirms`
 * counts confirmation requests so a test can say the wallet was billed once.
 */
export function fakePrintful() {
  const orders = new Map<number, FakeOrder>();
  const state = {
    orders,
    confirms: [] as number[],
    canceled: [] as number[],
    synced: [] as unknown[],
    webhooks: [] as unknown[],
    /** Print-file links Printful was asked to download. */
    files: [] as string[],
    /** Set to make the mockup task come back failed. */
    mockupFails: false,
    /** Set to make draft creation fail, as when a print file cannot be fetched. */
    refuseDrafts: false,
  };
  let nextId = 9000;
  const found = (id: unknown) => orders.get(Number(id));

  server.use(
    http.get(`${API}/v2/catalog-products/:id`, () =>
      HttpResponse.json({
        data: {
          id: 71,
          name: "Softstyle Tee",
          type: "T-Shirt",
          techniques: [{ key: "dtg", display_name: "DTG", is_default: true }],
          placements: [{ placement: "front", technique: "dtg", title: "Front" }],
        },
      }),
    ),
    http.get(`${API}/v2/catalog-products/:id/catalog-variants`, () =>
      HttpResponse.json({
        data: [
          {
            id: 4011,
            name: "Tee Black M",
            size: "M",
            color: "Black",
            color_code: "#141414",
            placement_dimensions: [{ placement: "front", width: 12, height: 16 }],
          },
        ],
      }),
    ),
    http.get(`${API}/v2/catalog-products/:id/prices`, () =>
      HttpResponse.json({
        data: {
          currency: "USD",
          variant: { id: 4011, techniques: [{ technique_key: "dtg", discounted_price: "13.95" }] },
        },
      }),
    ),
    http.post(`${API}/v2/shipping-rates`, () =>
      HttpResponse.json({
        data: [
          {
            shipping: "STANDARD",
            shipping_method_name: "Flat Rate",
            rate: "4.75",
            currency: "USD",
            min_delivery_days: 4,
            max_delivery_days: 7,
          },
        ],
      }),
    ),
    http.post(`${API}/v2/orders`, async ({ request }) => {
      if (state.refuseDrafts) {
        return HttpResponse.json(
          { error: { message: "File could not be downloaded" } },
          { status: 400 },
        );
      }
      const body = (await request.json()) as { external_id: string };
      nextId += 1;
      const order = { id: nextId, external_id: body.external_id, status: "draft" };
      orders.set(order.id, order);
      return HttpResponse.json({ data: order });
    }),
    http.post(`${API}/v2/orders/:id/confirmation`, ({ params }) => {
      const order = found(params.id);
      if (!order) return HttpResponse.json({ error: { message: "Not found" } }, { status: 404 });
      state.confirms.push(order.id);
      if (order.status !== "draft") {
        return HttpResponse.json(
          { error: { message: "Order is not in a draft state" } },
          { status: 409 },
        );
      }
      order.status = "pending";
      return HttpResponse.json({ data: order });
    }),
    http.get(`${API}/v2/orders/:id`, ({ params }) => {
      const order = found(params.id);
      return order
        ? HttpResponse.json({ data: order })
        : HttpResponse.json({ error: { message: "Not found" } }, { status: 404 });
    }),
    http.delete(`${API}/v2/orders/:id`, ({ params }) => {
      const order = found(params.id);
      if (order) {
        order.status = "canceled";
        state.canceled.push(order.id);
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${API}/v2/files`, async ({ request }) => {
      const body = (await request.json()) as { url: string };
      state.files.push(body.url);
      return HttpResponse.json({ data: { id: 501, url: body.url, status: "ok" } });
    }),
    http.post(`${API}/v2/mockup-tasks`, () =>
      HttpResponse.json({
        data: [
          state.mockupFails
            ? { id: 7, status: "failed", failure_reasons: [{ detail: "File is too small" }] }
            : {
                id: 7,
                status: "completed",
                catalog_variant_mockups: [
                  { mockups: [{ mockup_url: "https://cdn.printful.test/m.jpg" }] },
                ],
              },
        ],
      }),
    ),
    http.post(`${API}/store/products`, async ({ request }) => {
      state.synced.push(await request.json());
      return HttpResponse.json({ result: { id: 3301 } });
    }),
    http.post(`${API}/v2/webhooks`, async ({ request }) => {
      state.webhooks.push(await request.json());
      return HttpResponse.json({ data: { secret_key: "abcdef0123456789" } });
    }),
  );
  return state;
}
