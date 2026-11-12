import { getRequest } from "@tanstack/react-start/server";
import { type Sql } from "../db.ts";
import { getPodProvider, readPaymentsMode, readPodMode, readMarkup } from "../pod/index.ts";
import type { CatalogProduct } from "../pod/types.ts";
import { printFileAuthorized, printSigningSecret, signedPrintFileUrl } from "../pod/print-access.ts";
import { parseLayers } from "./validate.ts";
import type { DesignRecord, DesignSummary, StudioConfig } from "./models.ts";

export type DesignRow = {
  id: string;
  user_id: string;
  collection_id: string | null;
  collection_name?: string | null;
  title: string;
  slug: string;
  status: string;
  product_id: string;
  product_name: string;
  product_type: string;
  variant_id: string;
  variant_label: string;
  color_name: string;
  color_hex: string;
  size_label: string;
  placement: string;
  technique: string;
  layers_json: string;
  print_file_id: string | null;
  mockup_url: string | null;
  retail_cents: number;
  currency: string;
  provider_product_id: string | null;
  updated_at: string;
};

export function summary(row: DesignRow): DesignSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status === "published" ? "published" : "draft",
    collectionId: row.collection_id,
    collectionName: row.collection_name ?? undefined,
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    variantId: row.variant_id,
    variantLabel: row.variant_label,
    colorName: row.color_name,
    colorHex: row.color_hex,
    sizeLabel: row.size_label,
    placement: row.placement,
    technique: row.technique,
    mockupUrl: row.mockup_url,
    retailCents: Number(row.retail_cents),
    currency: row.currency,
    updatedAt: String(row.updated_at),
  };
}

export function record(row: DesignRow): DesignRecord {
  return {
    ...summary(row),
    layers: parseLayers(JSON.parse(row.layers_json)),
    printFileId: row.print_file_id,
  };
}

export function origin(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(getRequest().url).origin;
}

export function sumCents(lines: { unitCents: number; quantity: number }[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(line.unitCents) * Math.round(line.quantity),
    0,
  );
}

export function fileUrl(id: string): string {
  const secret = printSigningSecret(process.env, readPodMode(process.env));
  return signedPrintFileUrl(origin(), id, secret);
}

export function authorizePrintFile(id: string, token: string | null): boolean {
  try {
    const secret = printSigningSecret(process.env, readPodMode(process.env));
    return printFileAuthorized(id, token, secret);
  } catch {
    return false;
  }
}

export function readStudioConfig(): StudioConfig {
  const env = process.env;
  return {
    podMode: readPodMode(env),
    paymentsMode: readPaymentsMode(env),
    markup: readMarkup(env),
    currency: "USD",
  };
}

export async function loadCatalog(offset: number, limit: number) {
  const provider = getPodProvider();
  const page = await provider.listProducts({ offset, limit });
  return {
    ...readStudioConfig(),
    provider: provider.id,
    products: page.products.map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      brand: product.brand,
      imageUrl: product.imageUrl,
      placements: product.placements,
      colors: product.colors,
    })),
    total: page.total,
    offset: page.offset,
    limit: page.limit,
  };
}

export async function loadProduct(
  productId: string,
): Promise<CatalogProduct & { podMode: StudioConfig["podMode"] }> {
  const product = await getPodProvider().getProduct(productId);
  return { ...product, podMode: readStudioConfig().podMode };
}

export async function ownedDesign(sql: Sql, userId: string, designId: string): Promise<DesignRow | null> {
  const rows = await sql<DesignRow>`
    select d.*, c.name as collection_name
    from designs d
    left join collections c on c.id = d.collection_id
    where d.id = ${designId} and d.user_id = ${userId}
  `;
  return rows[0] ?? null;
}
