import { garmentMockupSvg } from "../gfx/garments/index.ts";
import { luminance } from "../color.ts";
import { getTemplate } from "../garments/panels.ts";
import { renderGarmentSvg } from "../garments/render.ts";
import { arcLayout, clampFx, isFlatText } from "../text/layout.ts";
import { AOP_DPI, aopOnSale } from "./aop-printful.ts";
import { aopFieldsFor, bindingsFor, printfulFactsForTemplate } from "./garment-map.ts";
import { HOUSE_BLANKS, houseAreas, sizeCode } from "./house-blanks.ts";
import { applyMarkup } from "./money.ts";
import type {
  CatalogPage,
  CatalogProduct,
  CatalogVariant,
  DesignLayer,
  DraftOrderRequest,
  FileUpload,
  MockupRequest,
  MockupResult,
  PodProvider,
  PrintArea,
  ProviderOrder,
  ShippingRate,
  SyncProductInput,
  WebhookRegistration,
} from "./types.ts";
import { PodError } from "./types.ts";

type SandboxOrder = {
  id: string;
  externalId?: string;
  status: string;
  confirmed: boolean;
};

const CHEST: PrintArea[] = [{ placement: "front", widthIn: 4, heightIn: 3, dpi: AOP_DPI }];

const APPAREL_SIZES = [
  { code: "s", name: "S" },
  { code: "m", name: "M" },
  { code: "l", name: "L" },
  { code: "xl", name: "XL" },
  { code: "2xl", name: "2XL" },
];

/** Variant ids use the codes, never the labels a buyer sees. */
export function sandboxVariantId(productId: string, colorCode: string, sizeCode: string): string {
  return `${productId}-${colorCode}-${sizeCode}`;
}

type BlankSize = { code: string; name: string };

type Blank = {
  id: string;
  name: string;
  type: string;
  brand: string;
  description: string;
  technique: string;
  techniqueTitle: string;
  placements: { placement: string; title: string; extraCents: number }[];
  areas: PrintArea[];
  colors: {
    code: string;
    name: string;
    hex: string;
    /** Wholesale cents and stock per size label. Missing means not made in that size. */
    sizes?: Record<string, { cents: number; inStock: boolean }>;
  }[];
  sizes: BlankSize[];
  wholesaleCents: number;
  shape: "tee" | "hoodie" | "hat" | "crew" | "tote" | "joggers" | "aop";
};

/** The regular pieces: the same Printful products, colours and sizes the live shop sells. */
function houseBlanks(): Blank[] {
  return HOUSE_BLANKS.map((blank) => ({
    id: blank.id,
    name: blank.name,
    type: blank.type,
    brand: blank.model,
    description: `${blank.description} Printful ${blank.printfulId}, ${blank.model}.`,
    technique: blank.technique,
    techniqueTitle: "DTG printing",
    placements: blank.placements.map((item) => ({
      placement: item.placement,
      title: item.title,
      extraCents: item.extraCents,
    })),
    areas: houseAreas(blank),
    colors: blank.colors.map((item) => ({
      code: item.code,
      name: item.name,
      hex: item.hex,
      sizes: Object.fromEntries(
        Object.entries(item.variants).map(([size, v]) => [size, { cents: v.cents, inStock: v.inStock }]),
      ),
    })),
    sizes: blank.sizes.map((name) => ({ code: sizeCode(name), name })),
    wholesaleCents: Math.min(
      ...blank.colors.flatMap((item) => Object.values(item.variants).map((v) => v.cents)),
    ),
    shape: blank.shape,
  }));
}

const BLANKS: Blank[] = [...houseBlanks(), ...aopBlanks()];

function aopBlanks(): Blank[] {
  return bindingsFor("sandbox")
    .filter((binding) => getTemplate(binding.templateId))
    .map((binding) => {
    const template = getTemplate(binding.templateId);
    const facts = printfulFactsForTemplate(binding.templateId);
    if (!template || !facts || !binding.productId) {
      throw new Error(`Sandbox has no all-over template for ${binding.templateId}.`);
    }
    return {
      id: binding.productId,
      name: template.name,
      type: template.kind,
      description: `${facts.material.line} Matched to Printful ${facts.catalogProductId}, ${facts.name}. Panel colors are the print, not a dyed blank. Printful's template pixel sizes are not confirmed yet.`,
      technique: "sublimation",
      techniqueTitle: "Sublimation",
      brand: "Street Royalty",
      placements: [{ placement: "front", title: "Chest logo", extraCents: 0 }],
      areas: CHEST,
      colors: [{ code: "printed", name: "Printed", hex: "#c4a6e0" }],
      sizes: APPAREL_SIZES,
      wholesaleCents: facts.startingPriceCents,
      shape: "aop",
    };
  });
}

function sizePremium(size: string): number {
  if (size === "XL") return 200;
  if (size === "2XL") return 400;
  return 0;
}

function variantsFor(blank: Blank, markup: number): CatalogVariant[] {
  const variants: CatalogVariant[] = [];
  for (const color of blank.colors) {
    for (const size of blank.sizes) {
      const listed = color.sizes?.[size.name];
      if (color.sizes && !listed) continue;
      const wholesale = listed?.cents ?? blank.wholesaleCents + sizePremium(size.name);
      variants.push({
        id: sandboxVariantId(blank.id, color.code, size.code),
        productId: blank.id,
        name: `${blank.name} / ${color.name} / ${size.name}`,
        size: size.name,
        sizeCode: size.code,
        color: color.name,
        colorCode: color.code,
        colorHex: color.hex,
        wholesaleCents: wholesale,
        retailCents: applyMarkup(wholesale, markup),
        currency: "USD",
        printAreas: blank.areas,
        inStock: listed?.inStock ?? true,
      });
    }
  }
  return variants;
}

function toProduct(blank: Blank, markup: number, withVariants: boolean): CatalogProduct {
  return {
    id: blank.id,
    name: blank.name,
    type: blank.type,
    brand: blank.brand,
    description: blank.description,
    imageUrl: blankImage(blank),
    discontinued: false,
    techniques: [{ key: blank.technique, title: blank.techniqueTitle, isDefault: true }],
    placements: blank.placements.map((placement) => ({
      placement: placement.placement,
      technique: blank.technique,
      title: placement.title,
      ...(placement.extraCents > 0
        ? {
            extraRetailCents: applyMarkup(placement.extraCents, markup),
            extraWholesaleCents: placement.extraCents,
          }
        : {}),
    })),
    colors: blank.colors.map((color) => ({ code: color.code, name: color.name, hex: color.hex })),
    sizes: blank.sizes.map((size) => size.name),
    variants: withVariants ? variantsFor(blank, markup) : [],
    ...aopFieldsFor("sandbox", blank.id),
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeHref(src: string): string | null {
  if (
    src.startsWith("data:image/png") ||
    src.startsWith("data:image/jpeg") ||
    src.startsWith("data:image/webp")
  ) {
    return src.replaceAll('"', "");
  }
  if (/^https:\/\/[^\s"]+$/.test(src)) return escapeXml(src);
  return null;
}

function garmentPath(shape: Blank["shape"]): string {
  if (shape === "hat") {
    return "M70 150 C70 70 330 70 330 150 C360 160 370 190 340 200 L300 190 V230 H100 V190 L60 200 C30 190 40 160 70 150 Z";
  }
  if (shape === "hoodie") {
    return "M150 78 L200 48 H240 L290 78 L360 118 L328 168 L286 146 V250 H250 V210 H190 V250 H154 V146 L112 168 L80 118 Z";
  }
  if (shape === "crew") {
    return "M150 70 Q220 40 290 70 L348 108 L322 156 L286 136 V400 H154 V136 L118 156 L92 108 Z";
  }
  if (shape === "tote") {
    return "M170 130 C170 70 270 70 270 130 M140 130 H300 L316 400 H124 Z";
  }
  if (shape === "joggers") {
    return "M150 60 H290 V110 L306 400 H244 L224 190 L216 400 H134 L134 110 Z";
  }
  return "M148 72 L188 44 H252 L292 72 L368 112 L334 162 L292 140 V420 H148 V140 L106 162 L72 112 Z";
}

function printWindow(
  shape: Blank["shape"],
  placement: string,
): { x: number; y: number; w: number; h: number } {
  if (shape === "hat") return { x: 150, y: 118, w: 140, h: 52 };
  if (shape === "tote") return { x: 160, y: 180, w: 120, h: 120 };
  if (shape === "joggers") {
    return placement === "back"
      ? { x: 165, y: 120, w: 110, h: 44 }
      : { x: 168, y: 128, w: 52, h: 52 };
  }
  if (placement === "sleeve_left") return { x: 86, y: 150, w: 48, h: 48 };
  if (placement === "sleeve_right") return { x: 306, y: 150, w: 48, h: 48 };
  if (placement === "back") return { x: 155, y: 120, w: 130, h: 180 };
  if (shape === "hoodie") return { x: 165, y: 130, w: 110, h: 90 };
  return { x: 160, y: 128, w: 120, h: 150 };
}

export function buildMockupSvg(input: {
  shape: Blank["shape"];
  colorHex: string;
  placement: string;
  layers: DesignLayer[];
}): string {
  const window = printWindow(input.shape, input.placement);
  const ink = luminance(input.colorHex) > 0.6 ? "#141018" : "#f6f1ff";
  const layers = input.layers
    .map((layer) => {
      const cx = window.x + layer.x * window.w;
      const cy = window.y + layer.y * window.h;
      if (layer.type === "text") {
        const byWidth = (window.w * 0.88) / Math.max(layer.text.length * 0.62, 1);
        const byHeight = window.h * 0.42 * layer.scale;
        const size = Math.max(8, Math.min(byWidth, byHeight));
        const fx = clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking });
        const paint = fx.outline
          ? `fill="none" stroke="${escapeXml(layer.color)}" stroke-width="${Math.max(1, size * 0.07).toFixed(1)}"`
          : `fill="${escapeXml(layer.color)}"`;
        const spacing = fx.tracking ? ` letter-spacing="${(fx.tracking * size).toFixed(1)}"` : "";
        if (isFlatText(fx) || Math.abs(fx.arc) < 0.001) {
          return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" ${paint}${spacing} font-family="Arial Black, sans-serif" font-size="${size}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${layer.rotation.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">${escapeXml(layer.text).slice(0, 80)}</text>`;
        }
        return arcLayout(layer.text, fx)
          .map((cell) => {
            const x = cx + cell.along * size;
            const y = cy + cell.lift * size;
            const rotate = layer.rotation + cell.rotate;
            return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${paint} font-family="Arial Black, sans-serif" font-size="${size}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${escapeXml(cell.char)}</text>`;
          })
          .join("");
      }
      const href = safeHref(layer.src);
      if (!href) return "";
      const width = window.w * 0.62 * layer.scale;
      const height = width * 0.75;
      return `<image href="${href}" x="${(cx - width / 2).toFixed(1)}" y="${(cy - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" transform="rotate(${layer.rotation.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" />`;
    })
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 480">
  <rect width="440" height="480" fill="#120a1c"/>
  <path d="${garmentPath(input.shape)}" fill="${escapeXml(input.colorHex)}" stroke="${ink}" stroke-width="3"/>
  <path d="${garmentPath(input.shape)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="8" transform="translate(0 6)"/>
  <clipPath id="print"><rect x="${window.x}" y="${window.y}" width="${window.w}" height="${window.h}" rx="6"/></clipPath>
  <g clip-path="url(#print)">${layers}</g>
  <rect x="${window.x}" y="${window.y}" width="${window.w}" height="${window.h}" fill="none" stroke="${ink}" stroke-dasharray="4 4" opacity="0.45"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The drawn garment for a placement blank. The long-sleeve blank shares the tee's print windows. */
function mockupShape(blank: Blank): string {
  return /long/i.test(blank.type) ? "longsleeve" : blank.shape;
}

function blankImage(blank: Blank): string {
  // An all-over blank is its panels; the house colorway shows what the garment is.
  const templateId = aopTemplateOf(blank.id);
  if (templateId) return renderGarmentSvg({ templateId });
  return garmentMockupSvg({
    shape: mockupShape(blank),
    colorHex: blank.colors[0]?.hex ?? "#141414",
    placement: "front",
    layers: [
      {
        id: "mark",
        type: "text",
        text: "SR",
        font: "Archivo Black",
        color: luminance(blank.colors[0]?.hex ?? "#000") > 0.6 ? "#141018" : "#d6ff3c",
        x: 0.5,
        y: 0.5,
        scale: 1.1,
        rotation: 0,
      },
    ],
  });
}

function aopTemplateOf(productId: string): string | undefined {
  const linked = aopFieldsFor("sandbox", productId);
  return linked.construction === "aop" ? linked.aopTemplateId : undefined;
}

function findBlank(productId: string): Blank {
  const blank = BLANKS.find((item) => item.id === productId);
  if (!blank) throw new PodError(`Unknown sandbox product ${productId}`, 404);
  return blank;
}

function findVariant(blank: Blank, variantId: string, markup: number): CatalogVariant {
  const variant = variantsFor(blank, markup).find((item) => item.id === variantId);
  if (!variant) throw new PodError(`Unknown sandbox variant ${variantId}`, 404);
  return variant;
}

const sandboxGlobal = globalThis as typeof globalThis & {
  __srSandboxOrders?: Map<string, SandboxOrder>;
  __srSandboxSeq?: number;
};

function nextIdFor(orders: Map<string, SandboxOrder>): () => string {
  const shared = sandboxGlobal.__srSandboxOrders;
  if (shared && orders === shared) {
    return () => {
      // Each server copy starts its counter at a random point, so two copies (on Vercel)
      // do not hand out the same draft id and confirm each other's orders.
      if (sandboxGlobal.__srSandboxSeq == null) {
        let max = 1000 + Math.floor(Math.random() * 1e9) * 1000;
        for (const key of shared.keys()) {
          const match = /^sb-(\d+)$/.exec(key);
          if (match) max = Math.max(max, Number(match[1]));
        }
        sandboxGlobal.__srSandboxSeq = max;
      }
      sandboxGlobal.__srSandboxSeq += 1;
      return `sb-${sandboxGlobal.__srSandboxSeq}`;
    };
  }
  let sequence = 1000;
  return () => {
    sequence += 1;
    return `sb-${sequence}`;
  };
}

export function createSandboxProvider(
  orders: Map<string, SandboxOrder> = new Map(),
  markup = 2.2,
): PodProvider {
  const nextId = nextIdFor(orders);

  return {
    id: "sandbox",
    async listProducts(input) {
      const offset = input?.offset ?? 0;
      const limit = input?.limit ?? 24;
      // An off-sale all-over blank still loads by id, for designs and orders made before.
      const products = BLANKS.filter((blank) => aopOnSale() || blank.shape !== "aop").map((blank) =>
        toProduct(blank, markup, false),
      );
      return {
        products: products.slice(offset, offset + limit),
        total: products.length,
        offset,
        limit,
      } satisfies CatalogPage;
    },
    async getProduct(productId) {
      return toProduct(findBlank(productId), markup, true);
    },
    async uploadFile(file: FileUpload) {
      return { id: nextId(), url: file.url, status: "ok" };
    },
    async createMockup(input: MockupRequest): Promise<MockupResult> {
      const blank = findBlank(input.productId);
      findVariant(blank, input.variantId, markup);
      const allowed = blank.placements.some((placement) => placement.placement === input.placement);
      if (!allowed) throw new PodError(`${blank.name} has no ${input.placement} placement`, 400);
      const label = input.layers.find((layer) => layer.type === "text")?.text;
      const templateId = aopTemplateOf(blank.id);
      return {
        id: nextId(),
        status: "completed",
        mockupUrl: templateId
          ? renderGarmentSvg({ templateId, garment: input.garment, label })
          : garmentMockupSvg({
              shape: mockupShape(blank),
              colorHex: input.colorHex,
              placement: input.placement,
              layers: input.layers,
              printArea: input.printArea,
            }),
      };
    },
    async getMockup(taskId) {
      return { id: taskId, status: "completed" };
    },
    async shippingRates(input): Promise<ShippingRate[]> {
      const pieces = input.items.reduce((sum, item) => sum + item.quantity, 0);
      const standard = 595 + Math.max(0, pieces - 1) * 250;
      return [
        {
          id: "STANDARD",
          name: "Standard (sandbox)",
          rateCents: standard,
          currency: "USD",
          minDays: 5,
          maxDays: 8,
        },
        {
          id: "EXPRESS",
          name: "Express (sandbox)",
          rateCents: standard + 900,
          currency: "USD",
          minDays: 2,
          maxDays: 4,
        },
      ];
    },
    async createDraftOrder(input: DraftOrderRequest): Promise<ProviderOrder> {
      if (input.items.length === 0) throw new PodError("Order needs at least one item", 400);
      for (const item of input.items) {
        const blank = BLANKS.find((entry) => item.variantId.startsWith(entry.id));
        if (!blank) throw new PodError(`Sandbox cannot print variant ${item.variantId}`, 400);
        if (!item.fileUrl) throw new PodError("Print file URL is required", 400);
      }
      const id = nextId();
      const order: SandboxOrder = {
        id,
        externalId: input.externalId,
        status: "draft",
        confirmed: false,
      };
      orders.set(id, order);
      return { ...order };
    },
    async confirmOrder(orderId) {
      const order = orders.get(orderId);
      if (!order && orders === sandboxGlobal.__srSandboxOrders && /^sb-\d+$/.test(orderId)) {
        // The shared practice printer lives in one server's memory. On a host that runs
        // several copies (Vercel), a Stripe test payment can come back to a copy that never
        // saw the draft. Nothing real is printed either way, so it is taken as confirmed
        // instead of holding a paid practice order for review.
        const revived: SandboxOrder = { id: orderId, status: "pending", confirmed: true };
        orders.set(orderId, revived);
        return { ...revived };
      }
      if (!order) throw new PodError(`Sandbox order ${orderId} was not found`, 404);
      if (order.confirmed) throw new PodError("Order is already confirmed", 409);
      if (order.status === "canceled")
        throw new PodError("Canceled orders cannot be confirmed", 409);
      order.confirmed = true;
      order.status = "pending";
      return { ...order };
    },
    async cancelOrder(orderId) {
      const order = orders.get(orderId);
      if (!order) return;
      if (order.confirmed)
        throw new PodError("Confirmed sandbox orders cannot be canceled here", 409);
      order.status = "canceled";
    },
    async getOrder(orderId) {
      const order = orders.get(orderId);
      if (!order) throw new PodError(`Sandbox order ${orderId} was not found`, 404);
      return { ...order };
    },
    async syncProduct(input: SyncProductInput) {
      return { id: input.existingId || `sync-${input.externalId}` };
    },
    async registerWebhooks(url: string): Promise<WebhookRegistration> {
      return {
        url,
        events: [
          "order_updated",
          "shipment_sent",
          "shipment_delivered",
          "order_failed",
          "order_canceled",
        ],
        secretHex: undefined,
      };
    },
  };
}

export function sharedSandboxOrders(): Map<string, SandboxOrder> {
  sandboxGlobal.__srSandboxOrders ??= new Map();
  return sandboxGlobal.__srSandboxOrders;
}
