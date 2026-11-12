/** Identity of the pixels a mockup was rendered from. */
export function designVisualKey(input: {
  productId: string;
  variantId: string;
  placement: string;
  layers: unknown;
}): string {
  return JSON.stringify({
    productId: input.productId,
    variantId: input.variantId,
    placement: input.placement,
    layers: input.layers,
  });
}
