/**
 * A live studio checkout opens a Printful draft, the same kind of paid side
 * effect as a live Fourthwall cart. Sandbox starts stay local and are not counted.
 * The numbers match the shop: 40 starts for one account, 5000 for the site, per day.
 */

export const CHECKOUT_START_CAP = { visitor: 40, global: 5000 };

export const CHECKOUT_LIMIT_MESSAGE = "Too many checkouts started today. Try again tomorrow.";

/** Only a live printer and a live card together open a Printful draft. */
export function metersLiveCheckout(
  podMode: "live" | "sandbox",
  paymentsMode: "live" | "sandbox",
): boolean {
  return podMode === "live" && paymentsMode === "live";
}

export async function assertCheckoutStartAllowed(
  podMode: "live" | "sandbox",
  paymentsMode: "live" | "sandbox",
  userId: string,
): Promise<void> {
  if (!metersLiveCheckout(podMode, paymentsMode)) return;
  const { count } = await import("../ai/guard.server.ts");
  const verdict = await count("checkout", CHECKOUT_START_CAP, userId);
  if (!verdict.ok) throw new Error(CHECKOUT_LIMIT_MESSAGE);
}

/**
 * A live start is counted only after the address parses and the cart can be priced.
 * A bad address or an empty cart throws here and does not use up a start.
 */
export async function gateLiveCheckout(
  userId: string,
  recipient: unknown,
  podMode: "live" | "sandbox",
  paymentsMode: "live" | "sandbox",
): Promise<void> {
  if (!metersLiveCheckout(podMode, paymentsMode)) return;
  const { parseRecipient } = await import("./validate.ts");
  const { priceCart } = await import("./cart.server.ts");
  parseRecipient(recipient);
  await priceCart(userId);
  await assertCheckoutStartAllowed(podMode, paymentsMode, userId);
}
