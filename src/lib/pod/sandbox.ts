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

const TEE: PrintArea[] = [
  { placement: "front", widthIn: 12, heightIn: 16, dpi: 150 },
  { placement: "back", widthIn: 12, heightIn: 16, dpi: 150 },
  { placement: "sleeve_left", widthIn: 3.5, heightIn: 3.5, dpi: 150 },
  { placement: "sleeve_right", widthIn: 3.5, heightIn: 3.5, dpi: 150 },
];

const HOODIE: PrintArea[] = [
  { placement: "front", widthIn: 12, heightIn: 12, dpi: 150 },
  { placement: "back", widthIn: 12, heightIn: 16, dpi: 150 },
];

const HAT: PrintArea[] = [{ placement: "front", widthIn: 4, heightIn: 2, dpi: 150 }];

const CREW: PrintArea[] = [
  { placement: "front", widthIn: 12, heightIn: 14, dpi: 150 },
  { placement: "back", widthIn: 12, heightIn: 16, dpi: 150 },
];

type Blank = {
  id: string;
  name: string;
  type: string;
  description: string;
  technique: string;
  techniqueTitle: string;
  placements: { placement: string; title: string }[];
  areas: PrintArea[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  wholesaleCents: number;
  shape: "tee" | "hoodie" | "hat" | "crew";
};

const BLANKS: Blank[] = [
  {
    id: "tee-heavy",
    name: "Heavyweight Street Tee",
    type: "T-Shirt",
    description: "240gsm cotton tee with a wide front print area. The house blank.",
    technique: "dtg",
    techniqueTitle: "DTG printing",
    placements: [
      { placement: "front", title: "Front" },
      { placement: "back", title: "Back" },
      { placement: "sleeve_left", title: "Left sleeve" },
      { placement: "sleeve_right", title: "Right sleeve" },
    ],
    areas: TEE,
    colors: [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
      { name: "Hot Pink", hex: "#ff2d95" },
      { name: "Royal", hex: "#2f5bff" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    wholesaleCents: 1395,
    shape: "tee",
  },
  {
    id: "hoodie-pullover",
    name: "Pullover Hoodie",
    type: "Hoodie",
    description: "Fleece pullover. Front print sits above the pocket.",
    technique: "dtg",
    techniqueTitle: "DTG printing",
    placements: [
      { placement: "front", title: "Front" },
      { placement: "back", title: "Back" },
    ],
    areas: HOODIE,
    colors: [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
      { name: "Lime", hex: "#d6ff3c" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    wholesaleCents: 2895,
    shape: "hoodie",
  },
  {
    id: "hat-dad",
    name: "Dad Hat",
    type: "Hat",
    description: "Unstructured cap with a small front embroidery.",
    technique: "embroidery",
    techniqueTitle: "Embroidery",
    placements: [{ placement: "front", title: "Front" }],
    areas: HAT,
    colors: [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
      { name: "Hot Pink", hex: "#ff2d95" },
    ],
    sizes: ["One size"],
    wholesaleCents: 1195,
    shape: "hat",
  },
  {
    id: "crew-sweat",
    name: "Crewneck Sweatshirt",
    type: "Sweatshirt",
    description: "Heavy crew with room for a back print.",
    technique: "dtg",
    techniqueTitle: "DTG printing",
    placements: [
      { placement: "front", title: "Front" },
      { placement: "back", title: "Back" },
    ],
    areas: CREW,
    colors: [
      { name: "Black", hex: "#141414" },
      { name: "Bone", hex: "#efe6d6" },
      { name: "Royal", hex: "#2f5bff" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    wholesaleCents: 2495,
    shape: "crew",
  },
];

function sizePremium(size: string): number {
  if (size === "XL") return 200;
  if (size === "2XL") return 400;
  return 0;
}

function variantsFor(blank: Blank, markup: number): CatalogVariant[] {
  const variants: CatalogVariant[] = [];
  for (const color of blank.colors) {
    for (const size of blank.sizes) {
      const wholesale = blank.wholesaleCents + sizePremium(size);
      variants.push({
        id: `${blank.id}-${color.name.toLowerCase().replace(/\s+/g, "-")}-${size.toLowerCase().replace(/\s+/g, "-")}`,
        productId: blank.id,
        name: `${blank.name} / ${color.name} / ${size}`,
        size,
        color: color.name,
        colorHex: color.hex,
        wholesaleCents: wholesale,
        retailCents: applyMarkup(wholesale, markup),
        currency: "USD",
        printAreas: blank.areas,
        inStock: true,
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
    brand: "Street Royalty",
    description: blank.description,
    imageUrl: blankImage(blank),
    discontinued: false,
    techniques: [{ key: blank.technique, title: blank.techniqueTitle, isDefault: true }],
    placements: blank.placements.map((placement) => ({
      placement: placement.placement,
      technique: blank.technique,
      title: placement.title,
    })),
    colors: blank.colors,
    sizes: blank.sizes,
    variants: withVariants ? variantsFor(blank, markup) : [],
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
  return "M148 72 L188 44 H252 L292 72 L368 112 L334 162 L292 140 V420 H148 V140 L106 162 L72 112 Z";
}

function printWindow(
  shape: Blank["shape"],
  placement: string,
): { x: number; y: number; w: number; h: number } {
  if (shape === "hat") return { x: 150, y: 118, w: 140, h: 52 };
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
        return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" fill="${escapeXml(layer.color)}" font-family="Arial Black, sans-serif" font-size="${size}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${layer.rotation.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">${escapeXml(layer.text).slice(0, 80)}</text>`;
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

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blankImage(blank: Blank): string {
  return buildMockupSvg({
    shape: blank.shape,
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
      if (sandboxGlobal.__srSandboxSeq == null) {
        let max = 1000;
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
      const products = BLANKS.map((blank) => toProduct(blank, markup, false));
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
      return {
        id: nextId(),
        status: "completed",
        mockupUrl: buildMockupSvg({
          shape: blank.shape,
          colorHex: input.colorHex,
          placement: input.placement,
          layers: input.layers,
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
