/** Identity of the pixels a mockup was rendered from. */
export function designVisualKey(input: {
  productId: string;
  variantId: string;
  placement: string;
  layers: unknown;
  /** Panels and colorways on an all-over piece. Absent or null on a placement print. */
  garment?: unknown;
}): string {
  return JSON.stringify({
    productId: input.productId,
    variantId: input.variantId,
    placement: input.placement,
    layers: input.layers,
    garment: input.garment ?? null,
  });
}
