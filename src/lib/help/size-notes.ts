/**
 * Fit notes Printful prints on its own size guides (printful.com/custom-products/size-guide),
 * read 2026-11-26. Only what Printful says, by Printful product id.
 */
export const FIT_NOTES: Record<number, string> = {
  380: "Printful says this hoodie runs small. Most people go one size up.",
  411: "Printful says this crewneck runs small. Most people go one size up.",
  586: "Printful says measurements can vary by up to 2 inches.",
};

export function printfulSizeGuideUrl(printfulId: number): string {
  return `https://www.printful.com/custom-products/size-guide?productId=${printfulId}`;
}
