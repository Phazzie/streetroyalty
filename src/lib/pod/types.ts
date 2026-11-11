/** Shared print-on-demand types. Safe to import from client code. */

export type PodMode = "live" | "sandbox";

export type PlacementId = "front" | "back" | "sleeve_left" | "sleeve_right" | string;

export type CatalogColor = {
  name: string;
  hex: string;
};

export type PrintArea = {
  placement: string;
  widthIn: number;
  heightIn: number;
  dpi: number;
};

export type CatalogVariant = {
  id: string;
  productId: string;
  name: string;
  size: string;
  color: string;
  colorHex: string;
  wholesaleCents: number | null;
  retailCents: number | null;
  currency: string;
  printAreas: PrintArea[];
  imageUrl?: string;
  inStock: boolean;
};

export type CatalogPlacement = {
  placement: string;
  technique: string;
  title: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  type: string;
  brand?: string;
  description: string;
  imageUrl?: string;
  discontinued: boolean;
  techniques: { key: string; title: string; isDefault: boolean }[];
  placements: CatalogPlacement[];
  colors: CatalogColor[];
  sizes: string[];
  variants: CatalogVariant[];
};

export type CatalogPage = {
  products: CatalogProduct[];
  total: number;
  offset: number;
  limit: number;
};

export type DesignLayer =
  | {
      id: string;
      type: "image";
      src: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
    }
  | {
      id: string;
      type: "text";
      text: string;
      font: string;
      color: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
    };

export type MockupRequest = {
  productId: string;
  variantId: string;
  placement: string;
  technique: string;
  fileUrl?: string;
  colorHex: string;
  productType: string;
  layers: DesignLayer[];
  printArea?: PrintArea;
};

export type MockupResult = {
  id: string;
  status: "pending" | "completed" | "failed";
  mockupUrl?: string;
  error?: string;
};

export type FileUpload = {
  url: string;
  filename: string;
};

export type UploadedFile = {
  id: string;
  url: string;
  status: string;
};

export type Recipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
  phone?: string;
  email?: string;
};

export type ShippingItem = {
  variantId: string;
  quantity: number;
  retailCents: number;
};

export type ShippingRate = {
  id: string;
  name: string;
  rateCents: number;
  currency: string;
  minDays: number | null;
  maxDays: number | null;
};

export type DraftOrderItem = {
  externalId: string;
  variantId: string;
  quantity: number;
  retailCents: number;
  name: string;
  placement: string;
  technique: string;
  fileUrl: string;
  printArea?: PrintArea;
};

export type DraftOrderRequest = {
  externalId: string;
  recipient: Recipient;
  shippingMethod: string;
  items: DraftOrderItem[];
  currency: string;
};

export type ProviderOrder = {
  id: string;
  externalId?: string;
  status: string;
  confirmed: boolean;
};

export type SyncVariant = {
  catalogVariantId: string;
  retailPrice: string;
  files: { placement: string; url: string }[];
};

export type SyncProductInput = {
  externalId: string;
  name: string;
  thumbnailUrl?: string;
  existingId?: string;
  variants: SyncVariant[];
};

export type SyncedProduct = {
  id: string;
};

export type WebhookRegistration = {
  url: string;
  events: string[];
  /** Hex secret returned by Printful. Present only when the provider created one. */
  secretHex?: string;
};

export interface PodProvider {
  readonly id: "printful" | "sandbox";
  listProducts(input?: { offset?: number; limit?: number }): Promise<CatalogPage>;
  getProduct(productId: string): Promise<CatalogProduct>;
  uploadFile(file: FileUpload): Promise<UploadedFile>;
  createMockup(input: MockupRequest): Promise<MockupResult>;
  getMockup(taskId: string): Promise<MockupResult>;
  shippingRates(input: { recipient: Recipient; items: ShippingItem[]; currency: string }): Promise<ShippingRate[]>;
  createDraftOrder(input: DraftOrderRequest): Promise<ProviderOrder>;
  confirmOrder(orderId: string): Promise<ProviderOrder>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<ProviderOrder>;
  syncProduct(input: SyncProductInput): Promise<SyncedProduct>;
  registerWebhooks(url: string): Promise<WebhookRegistration>;
}

export class PodError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "PodError";
    this.status = status;
  }
}
