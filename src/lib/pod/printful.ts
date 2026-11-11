import { applyMarkup, centsToDecimal, moneyToCents } from "./money.ts";
import { PodError, type CatalogPage, type CatalogProduct, type CatalogVariant, type DraftOrderRequest, type FileUpload, type MockupRequest, type MockupResult, type PodProvider, type PrintArea, type ProviderOrder, type Recipient, type ShippingItem, type ShippingRate, type SyncProductInput, type SyncedProduct, type UploadedFile, type WebhookRegistration } from "./types.ts";

type FetchLike = typeof fetch;

export type PrintfulClientOptions = {
  apiKey: string;
  storeId?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Poll budget for mockup tasks. Tests pass a zero delay. */
  mockupPoll?: { attempts: number; delayMs: number };
  markup?: number;
};

const DEFAULT_POLL = { attempts: 4, delayMs: 1200 };

type Envelope = {
  data?: unknown;
  result?: unknown;
  paging?: { total?: number; offset?: number; limit?: number };
  error?: { message?: string; reason?: string };
  secret_key?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : value != null && typeof value !== "object" ? String(value) : fallback;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPrintfulProvider(options: PrintfulClientOptions): PodProvider {
  const baseUrl = (options.baseUrl ?? "https://api.printful.com").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const markup = options.markup ?? 2.2;
  const poll = options.mockupPoll ?? DEFAULT_POLL;

  async function request(path: string, init?: { method?: string; body?: unknown }): Promise<Envelope> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.apiKey}`,
      Accept: "application/json",
    };
    if (options.storeId) headers["X-PF-Store-Id"] = options.storeId;
    let body: string | undefined;
    if (init?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, { method: init?.method ?? "GET", headers, body });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      throw new PodError(`Printful request failed: ${message}`, 502);
    }
    const raw = await response.text();
    let json: Envelope = {};
    if (raw) {
      try {
        json = JSON.parse(raw) as Envelope;
      } catch {
        throw new PodError(`Printful returned a non-JSON response (${response.status})`, response.status);
      }
    }
    if (!response.ok) {
      const record = asRecord(json.error) ?? asRecord(json);
      const message =
        text(record?.message) ||
        text(record?.reason) ||
        text(record?.error) ||
        `Printful error ${response.status}`;
      throw new PodError(message, response.status);
    }
    return json;
  }

  function payloadOf(envelope: Envelope): unknown {
    if (envelope.data !== undefined) return envelope.data;
    if (envelope.result !== undefined) return envelope.result;
    return envelope;
  }

  function mapVariant(raw: Record<string, unknown>, productId: string, priceCents: number | null, currency: string): CatalogVariant {
    const areas = asArray(raw.placement_dimensions).map((entry) => {
      const area = asRecord(entry);
      if (!area) return null;
      const widthIn = Number(area.width);
      const heightIn = Number(area.height);
      if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) return null;
      const spec: PrintArea = {
        placement: text(area.placement, "front"),
        widthIn,
        heightIn,
        dpi: 150,
      };
      return spec;
    }).filter((area): area is PrintArea => area !== null);
    const wholesale = priceCents;
    return {
      id: text(raw.id),
      productId,
      name: text(raw.name, "Variant"),
      size: text(raw.size, "One size"),
      color: text(raw.color, "Default"),
      colorHex: text(raw.color_code, "#111111"),
      wholesaleCents: wholesale,
      retailCents: wholesale == null ? null : applyMarkup(wholesale, markup),
      currency,
      printAreas: areas,
      imageUrl: text(raw.image) || undefined,
      inStock: raw.in_stock !== false && raw.available !== false,
    };
  }

  function collectPrices(node: unknown, into: Map<string, { technique: string; cents: number }[]>): void {
    if (Array.isArray(node)) {
      for (const entry of node) collectPrices(entry, into);
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    const id = record.id ?? record.catalog_variant_id;
    if ((typeof id === "number" || typeof id === "string") && Array.isArray(record.techniques)) {
      const prices = record.techniques.flatMap((entry) => {
        const technique = asRecord(entry);
        if (!technique) return [];
        const cents = moneyToCents(technique.discounted_price ?? technique.price);
        if (cents == null) return [];
        return [{ technique: text(technique.technique_key ?? technique.technique, "dtg"), cents }];
      });
      if (prices.length > 0) into.set(String(id), prices);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") collectPrices(value, into);
    }
  }

  function priceFor(prices: Map<string, { technique: string; cents: number }[]>, variantId: string, technique?: string): number | null {
    const list = prices.get(variantId);
    if (!list || list.length === 0) return null;
    if (technique) {
      const match = list.find((item) => item.technique === technique);
      if (match) return match.cents;
    }
    return list[0]?.cents ?? null;
  }

  function mapProduct(raw: Record<string, unknown>, variants: CatalogVariant[] = []): CatalogProduct {
    const techniques = asArray(raw.techniques).map((entry) => {
      const technique = asRecord(entry);
      return {
        key: text(technique?.key ?? technique?.technique_key, "dtg"),
        title: text(technique?.display_name ?? technique?.technique_display_name, "Print"),
        isDefault: technique?.is_default === true,
      };
    });
    const placements = asArray(raw.placements).map((entry) => {
      const placement = asRecord(entry);
      return {
        placement: text(placement?.placement ?? placement?.id, "front"),
        technique: text(placement?.technique ?? placement?.technique_key, techniques.find((item) => item.isDefault)?.key ?? techniques[0]?.key ?? "dtg"),
        title: text(placement?.title ?? placement?.placement, "Print"),
      };
    });
    return {
      id: text(raw.id),
      name: text(raw.name, "Untitled product"),
      type: text(raw.type, "Apparel"),
      brand: text(raw.brand) || undefined,
      description: text(raw.description),
      imageUrl: text(raw.image) || undefined,
      discontinued: raw.is_discontinued === true,
      techniques,
      placements,
      colors: asArray(raw.colors).map((entry) => {
        const color = asRecord(entry);
        return { name: text(color?.name, "Color"), hex: text(color?.value ?? color?.color_code, "#111111") };
      }),
      sizes: asArray(raw.sizes).map((size) => text(size)).filter(Boolean),
      variants,
    };
  }

  async function loadVariants(productId: string, technique?: string): Promise<{ variants: CatalogVariant[]; currency: string }> {
    const [variantEnvelope, priceEnvelope] = await Promise.all([
      request(`/v2/catalog-products/${encodeURIComponent(productId)}/catalog-variants?limit=100`),
      request(`/v2/catalog-products/${encodeURIComponent(productId)}/prices?currency=USD`).catch(() => ({ data: null }) as Envelope),
    ]);
    const prices = new Map<string, { technique: string; cents: number }[]>();
    collectPrices(payloadOf(priceEnvelope), prices);
    const currency = text(asRecord(payloadOf(priceEnvelope))?.currency, "USD") || "USD";
    const variants = asArray(payloadOf(variantEnvelope))
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => mapVariant(entry, productId, priceFor(prices, text(entry.id), technique), currency));
    return { variants, currency };
  }

  function layerPosition(area: PrintArea | undefined) {
    if (!area) return undefined;
    return {
      width: Number(area.widthIn.toFixed(2)),
      height: Number(area.heightIn.toFixed(2)),
      top: 0,
      left: 0,
    };
  }

  function orderItem(item: DraftOrderRequest["items"][number]) {
    return {
      source: "catalog",
      catalog_variant_id: Number(item.variantId),
      external_id: item.externalId,
      quantity: item.quantity,
      retail_price: centsToDecimal(item.retailCents),
      name: item.name,
      placements: [
        {
          placement: item.placement,
          technique: item.technique,
          layers: [
            {
              type: "file",
              url: item.fileUrl,
              position: layerPosition(item.printArea),
            },
          ],
        },
      ],
    };
  }

  function mapOrder(raw: unknown, confirmed: boolean): ProviderOrder {
    const record = asRecord(raw) ?? {};
    return {
      id: text(record.id),
      externalId: text(record.external_id) || undefined,
      status: text(record.status, confirmed ? "pending" : "draft"),
      confirmed,
    };
  }

  function mapMockup(raw: unknown): MockupResult {
    const records = asArray(raw);
    const record = asRecord(records[0] ?? raw) ?? {};
    const groups = asArray(record.catalog_variant_mockups);
    let mockupUrl = "";
    for (const group of groups) {
      const mockups = asArray(asRecord(group)?.mockups);
      const url = text(asRecord(mockups[0])?.mockup_url);
      if (url) {
        mockupUrl = url;
        break;
      }
    }
    const failures = asArray(record.failure_reasons);
    const failure = text(asRecord(failures[0])?.detail);
    const statusText = text(record.status, "pending");
    const status = statusText === "completed" || statusText === "failed" ? statusText : "pending";
    return {
      id: text(record.id),
      status,
      mockupUrl: mockupUrl || undefined,
      error: failure || undefined,
    };
  }

  return {
    id: "printful",
    async listProducts(input) {
      const limit = input?.limit ?? 24;
      const offset = input?.offset ?? 0;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const envelope = await request(`/v2/catalog-products?${params.toString()}`);
      const products = asArray(payloadOf(envelope))
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => mapProduct(entry))
        .filter((product) => !product.discontinued);
      return {
        products,
        total: envelope.paging?.total ?? products.length,
        offset: envelope.paging?.offset ?? offset,
        limit: envelope.paging?.limit ?? limit,
      } satisfies CatalogPage;
    },
    async getProduct(productId) {
      const envelope = await request(`/v2/catalog-products/${encodeURIComponent(productId)}`);
      const raw = asRecord(payloadOf(envelope));
      if (!raw) throw new PodError(`Printful product ${productId} was not found`, 404);
      const product = mapProduct(raw);
      const technique = product.techniques.find((item) => item.isDefault)?.key ?? product.techniques[0]?.key;
      const loaded = await loadVariants(productId, technique);
      return { ...product, variants: loaded.variants };
    },
    async uploadFile(file: FileUpload): Promise<UploadedFile> {
      const envelope = await request("/v2/files", {
        method: "POST",
        body: { url: file.url, filename: file.filename, role: "printfile", visible: false },
      });
      const record = asRecord(payloadOf(envelope)) ?? {};
      return { id: text(record.id), url: text(record.url, file.url), status: text(record.status, "ok") };
    },
    async createMockup(input: MockupRequest): Promise<MockupResult> {
      if (!input.fileUrl) throw new PodError("A public print-file URL is required for Printful mockups", 400);
      const envelope = await request("/v2/mockup-tasks", {
        method: "POST",
        body: {
          format: "jpg",
          mockup_width_px: 1000,
          products: [
            {
              source: "catalog",
              catalog_product_id: Number(input.productId),
              catalog_variant_ids: [Number(input.variantId)],
              placements: [
                {
                  placement: input.placement,
                  technique: input.technique,
                  layers: [
                    {
                      type: "file",
                      url: input.fileUrl,
                      position: layerPosition(input.printArea),
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      let task = mapMockup(payloadOf(envelope));
      for (let attempt = 0; attempt < poll.attempts && task.status === "pending" && task.id; attempt += 1) {
        await sleep(poll.delayMs);
        task = await this.getMockup(task.id);
      }
      return task;
    },
    async getMockup(taskId) {
      const envelope = await request(`/v2/mockup-tasks?id=${encodeURIComponent(taskId)}`);
      const task = mapMockup(payloadOf(envelope));
      return { ...task, id: task.id || taskId };
    },
    async shippingRates(input: { recipient: Recipient; items: ShippingItem[]; currency: string }) {
      const envelope = await request("/v2/shipping-rates", {
        method: "POST",
        body: {
          recipient: {
            name: input.recipient.name,
            address1: input.recipient.address1,
            address2: input.recipient.address2,
            city: input.recipient.city,
            state_code: input.recipient.stateCode,
            country_code: input.recipient.countryCode,
            zip: input.recipient.zip,
            phone: input.recipient.phone,
            email: input.recipient.email,
          },
          order_items: input.items.map((item) => ({
            source: "catalog",
            catalog_variant_id: Number(item.variantId),
            quantity: item.quantity,
            retail_price: centsToDecimal(item.retailCents),
          })),
          currency: input.currency,
        },
      });
      return asArray(payloadOf(envelope)).flatMap((entry) => {
        const rate = asRecord(entry);
        if (!rate) return [];
        const cents = moneyToCents(rate.rate);
        if (cents == null) return [];
        const mapped: ShippingRate = {
          id: text(rate.shipping, "STANDARD"),
          name: text(rate.shipping_method_name, "Shipping"),
          rateCents: cents,
          currency: text(rate.currency, input.currency),
          minDays: typeof rate.min_delivery_days === "number" ? rate.min_delivery_days : null,
          maxDays: typeof rate.max_delivery_days === "number" ? rate.max_delivery_days : null,
        };
        return [mapped];
      });
    },
    async createDraftOrder(input) {
      const envelope = await request("/v2/orders", {
        method: "POST",
        body: {
          external_id: input.externalId,
          shipping: input.shippingMethod,
          recipient: {
            name: input.recipient.name,
            address1: input.recipient.address1,
            address2: input.recipient.address2,
            city: input.recipient.city,
            state_code: input.recipient.stateCode,
            country_code: input.recipient.countryCode,
            zip: input.recipient.zip,
            phone: input.recipient.phone,
            email: input.recipient.email,
          },
          order_items: input.items.map(orderItem),
        },
      });
      // v2 creates drafts. Confirmation is a separate call so unpaid orders never ship.
      return mapOrder(payloadOf(envelope), false);
    },
    async confirmOrder(orderId) {
      const envelope = await request(`/v2/orders/${encodeURIComponent(orderId)}/confirmation`, { method: "POST" });
      return mapOrder(payloadOf(envelope), true);
    },
    async cancelOrder(orderId) {
      await request(`/v2/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" });
    },
    async getOrder(orderId) {
      const envelope = await request(`/v2/orders/${encodeURIComponent(orderId)}`);
      const order = mapOrder(payloadOf(envelope), false);
      const confirmed = order.status !== "draft" && order.status !== "failed" && order.status !== "canceled";
      return { ...order, confirmed };
    },
    async syncProduct(input: SyncProductInput): Promise<SyncedProduct> {
      // Store sync products are still v1. v2 catalog/orders do not manage them yet.
      const body = {
        sync_product: {
          external_id: input.externalId,
          name: input.name,
          thumbnail: input.thumbnailUrl,
        },
        sync_variants: input.variants.map((variant) => ({
          external_id: `${input.externalId}:${variant.catalogVariantId}`,
          variant_id: Number(variant.catalogVariantId),
          retail_price: variant.retailPrice,
          files: variant.files.map((file) => ({ type: file.placement, url: file.url })),
        })),
      };
      const path = input.existingId ? `/store/products/${encodeURIComponent(input.existingId)}` : "/store/products";
      const envelope = await request(path, { method: input.existingId ? "PUT" : "POST", body });
      const record = asRecord(payloadOf(envelope)) ?? {};
      const nested = asRecord(record.sync_product);
      const id = text(nested?.id ?? record.id ?? input.existingId);
      if (!id) throw new PodError("Printful did not return a sync product id", 502);
      return { id };
    },
    async registerWebhooks(url: string): Promise<WebhookRegistration> {
      const events = [
        "order_created",
        "order_updated",
        "order_failed",
        "order_canceled",
        "order_put_hold",
        "shipment_sent",
        "shipment_delivered",
        "shipment_canceled",
        "mockup_task_finished",
      ];
      const envelope = await request("/v2/webhooks", {
        method: "POST",
        body: {
          default_url: url,
          events: events.map((type) => ({ type })),
        },
      });
      const record = asRecord(payloadOf(envelope)) ?? asRecord(envelope) ?? {};
      return {
        url,
        events,
        secretHex: text(record.secret_key ?? envelope.secret_key) || undefined,
      };
    },
  };
}
