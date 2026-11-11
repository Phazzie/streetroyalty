import type { DesignLayer } from "../pod/types.ts";

export type StudioConfig = {
  podMode: "live" | "sandbox";
  paymentsMode: "live" | "sandbox";
  markup: number;
  currency: "USD";
};

export type DesignSummary = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  collectionId: string | null;
  collectionName?: string;
  productId: string;
  productName: string;
  productType: string;
  variantId: string;
  variantLabel: string;
  colorName: string;
  colorHex: string;
  sizeLabel: string;
  placement: string;
  technique: string;
  mockupUrl: string | null;
  retailCents: number;
  currency: string;
  updatedAt: string;
};

export type DesignRecord = DesignSummary & {
  layers: DesignLayer[];
  printFileId: string | null;
};

export type CollectionRecord = {
  id: string;
  name: string;
  count: number;
};

export type CartLine = {
  id: string;
  designId: string;
  title: string;
  slug: string;
  mockupUrl: string | null;
  variantId: string;
  variantLabel: string;
  quantity: number;
  unitCents: number;
};

export type OrderSummary = {
  id: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingMethod: string;
  providerOrderId: string | null;
  providerStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  sandbox: boolean;
  failureReason: string | null;
  createdAt: string;
  items: { title: string; quantity: number; variantLabel: string; unitCents: number }[];
};
