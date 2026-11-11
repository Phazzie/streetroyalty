import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";

const optionalUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("../auth/client.ts");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { getSessionUser } = await import("../auth/verify.server.ts");
    const user = await getSessionUser(context.bearerToken);
    return next({ context: { userId: user?.id ?? null } });
  });

export const getStudioConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { readStudioConfig } = await import("./repo.server.ts");
  return readStudioConfig();
});

export const listCatalog = createServerFn({ method: "GET" })
  .validator((input: { offset?: number; limit?: number } | undefined) => ({
    offset: Math.max(0, Math.round(Number(input?.offset ?? 0)) || 0),
    limit: Math.min(48, Math.max(1, Math.round(Number(input?.limit ?? 24)) || 24)),
  }))
  .handler(async ({ data }) => {
    const { loadCatalog } = await import("./repo.server.ts");
    return loadCatalog(data.offset, data.limit);
  });

export const getCatalogProduct = createServerFn({ method: "GET" })
  .validator((input: { productId?: string }) => {
    const productId = String(input?.productId ?? "").trim();
    if (!productId) throw new Error("Pick a product.");
    return { productId };
  })
  .handler(async ({ data }) => {
    const { loadProduct } = await import("./repo.server.ts");
    return loadProduct(data.productId);
  });

export const makeMockup = createServerFn({ method: "POST" })
  .middleware([optionalUser])
  .validator((input: { productId?: string; variantId?: string; placement?: string; layers?: unknown; printFile?: unknown }) => ({
    productId: String(input?.productId ?? ""),
    variantId: String(input?.variantId ?? ""),
    placement: String(input?.placement ?? "front"),
    layers: input?.layers,
    printFile: input?.printFile,
  }))
  .handler(async ({ data, context }) => {
    const { generateMockup } = await import("./repo.server.ts");
    return generateMockup({ ...data, userId: context.userId ?? undefined });
  });

export const savePiece = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Record<string, unknown>) => input)
  .handler(async ({ data, context }) => {
    const { saveDesign } = await import("./repo.server.ts");
    return saveDesign(context.userId, {
      id: data.id ? String(data.id) : undefined,
      title: String(data.title ?? ""),
      collectionId: data.collectionId ? String(data.collectionId) : null,
      productId: String(data.productId ?? ""),
      variantId: String(data.variantId ?? ""),
      placement: String(data.placement ?? ""),
      layers: data.layers,
      printFile: data.printFile,
      mockupUrl: data.mockupUrl ? String(data.mockupUrl) : null,
    });
  });

export const publishPiece = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { designId?: string }) => ({ designId: String(input?.designId ?? "") }))
  .handler(async ({ data, context }) => {
    const { publishDesign } = await import("./repo.server.ts");
    return publishDesign(context.userId, data.designId);
  });

export const myDesigns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listDesigns } = await import("./repo.server.ts");
    return listDesigns(context.userId);
  });

export const myDesign = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { designId?: string }) => ({ designId: String(input?.designId ?? "") }))
  .handler(async ({ data, context }) => {
    const { getDesign } = await import("./repo.server.ts");
    return getDesign(context.userId, data.designId);
  });

export const myCollections = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listCollections } = await import("./repo.server.ts");
    return listCollections(context.userId);
  });

export const addCollection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string }) => ({ name: String(input?.name ?? "") }))
  .handler(async ({ data, context }) => {
    const { createCollection } = await import("./repo.server.ts");
    return createCollection(context.userId, data.name);
  });

export const shopList = createServerFn({ method: "GET" }).handler(async () => {
  const { listShop } = await import("./repo.server.ts");
  return listShop();
});

export const shopPiece = createServerFn({ method: "GET" })
  .validator((input: { slug?: string }) => ({ slug: String(input?.slug ?? "") }))
  .handler(async ({ data }) => {
    const { getShopDesign } = await import("./repo.server.ts");
    return getShopDesign(data.slug);
  });

export const cartAdd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { designId?: string; variantId?: string }) => ({
    designId: String(input?.designId ?? ""),
    variantId: String(input?.variantId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { addToCart } = await import("./repo.server.ts");
    await addToCart(context.userId, data.designId, data.variantId);
    return { ok: true };
  });

export const cartSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { cartId?: string; quantity?: number }) => ({
    cartId: String(input?.cartId ?? ""),
    quantity: Number(input?.quantity ?? 1),
  }))
  .handler(async ({ data, context }) => {
    const { updateCart } = await import("./repo.server.ts");
    await updateCart(context.userId, data.cartId, data.quantity);
    return { ok: true };
  });

export const cartList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listCart } = await import("./repo.server.ts");
    return listCart(context.userId);
  });

export const shippingQuote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { recipient?: unknown }) => ({ recipient: input?.recipient }))
  .handler(async ({ data, context }) => {
    const { quoteShipping } = await import("./repo.server.ts");
    return quoteShipping(context.userId, data.recipient);
  });

export const beginCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { recipient?: unknown; shippingMethod?: string }) => ({
    recipient: input?.recipient,
    shippingMethod: String(input?.shippingMethod ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { startCheckout } = await import("./repo.server.ts");
    return startCheckout(context.userId, data);
  });

export const paySandbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { orderId?: string }) => ({ orderId: String(input?.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { completeSandboxPayment } = await import("./repo.server.ts");
    return completeSandboxPayment(context.userId, data.orderId);
  });

export const confirmStripeReturn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { sessionId?: string }) => ({ sessionId: String(input?.sessionId ?? "") }))
  .handler(async ({ data, context }) => {
    const { syncStripeReturn } = await import("./repo.server.ts");
    return syncStripeReturn(context.userId, data.sessionId);
  });

export const myOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listOrders } = await import("./repo.server.ts");
    return listOrders(context.userId);
  });

export const retryPrint = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { orderId?: string }) => ({ orderId: String(input?.orderId ?? "") }))
  .handler(async ({ data, context }) => {
    const { retryFulfillment } = await import("./repo.server.ts");
    return retryFulfillment(context.userId, data.orderId);
  });

export const linkWebhooks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { connectWebhooks } = await import("./repo.server.ts");
    return connectWebhooks();
  });
